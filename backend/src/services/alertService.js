const Alert   = require('../models/Alert');
const { sendAlertEmail } = require('./emailService');
const { broadcast } = require('../utils/websocket');
const logger  = require('../utils/logger');
const crypto  = require('crypto');

/**
 * Generate a deduplication fingerprint.
 * Same device + same rule within a time window = same fingerprint.
 * Prevents alert storms from rapid condition changes.
 */
const makeFingerprint = (deviceId, ruleId, metric) => {
  const key = `${deviceId}|${ruleId}|${metric}|${Math.floor(Date.now() / (5 * 60 * 1000))}`; // 5-min window
  return crypto.createHash('md5').update(key).digest('hex');
};

/**
 * Create a new alert or increment count on an existing duplicate.
 * This is the main entry point — called by rule engine, anomaly service, ping service.
 */
const createAlert = async ({
  title, message, severity = 'info', category = 'rule',
  source = 'rule', ruleId = null, ruleName = null,
  deviceId = null, deviceName = null, ipAddress = null,
  metric = null, sendEmail = false, emailTo = [],
}) => {
  try {
    // Deduplication check
    const fingerprint = deviceId && ruleId
      ? makeFingerprint(deviceId, ruleId, metric?.name || '')
      : null;

    if (fingerprint) {
      const existing = await Alert.findOne({ fingerprint, status: 'active' });
      if (existing) {
        // Increment count instead of creating duplicate
        await Alert.findByIdAndUpdate(existing._id, { $inc: { count: 1 }, firedAt: new Date() });
        logger.debug(`[Alert] Deduplicated: "${title}" (count: ${existing.count + 1})`);
        return existing;
      }
    }

    // Create new alert
    const alert = await Alert.create({
      title, message, severity, category, source,
      ruleId, ruleName, deviceId, deviceName, ipAddress,
      metric, fingerprint,
      // Set escalation time: critical=15min, warning=60min, info=never
      nextEscalationAt: severity === 'critical'
        ? new Date(Date.now() + 15 * 60 * 1000)
        : severity === 'warning'
        ? new Date(Date.now() + 60 * 60 * 1000)
        : null,
    });

    logger.warn(`[Alert] Created: [${severity.toUpperCase()}] ${title}`);

    // Broadcast to WebSocket clients
    broadcast('NEW_ALERT', {
      alertId:    alert._id,
      title,
      message,
      severity,
      category,
      deviceName,
      ipAddress,
      firedAt:    alert.firedAt,
    });

    // Send email if configured
    if (sendEmail && emailTo.length > 0) {
      const emailResult = await sendAlertEmail(alert, emailTo);
      if (emailResult.sent) {
        await Alert.findByIdAndUpdate(alert._id, {
          emailSent:   true,
          emailSentAt: new Date(),
          emailTo,
        });
        if (emailResult.preview) {
          logger.info(`[Alert] Email preview (dev): ${emailResult.preview}`);
        }
      }
    }

    return alert;

  } catch (err) {
    logger.error(`[Alert] Creation failed: ${err.message}`);
    throw err;
  }
};

/**
 * Create alert from a fired rule (called by actionExecutor)
 * This bridges Phase 7 rules → Phase 8 alerts
 */
const createAlertFromRule = async (rule, device, triggerInfo) => {
  const severityMap = {
    critical: 'critical',
    high:     'critical',
    warning:  'warning',
    info:     'info',
  };

  const emailConfig = process.env.ALERT_EMAIL_TO
    ? process.env.ALERT_EMAIL_TO.split(',').map((e) => e.trim())
    : [];

  return createAlert({
    title:      `${rule.name} — ${device?.name || device?.deviceName || 'Unknown Device'}`,
    message:    `Rule "${rule.name}" fired: ${triggerInfo.metric} is ${triggerInfo.actualValue} (threshold: ${triggerInfo.threshold})`,
    severity:   severityMap[triggerInfo.severity] || 'warning',
    category:   'rule',
    source:     'rule',
    ruleId:     rule._id?.toString(),
    ruleName:   rule.name,
    deviceId:   (device?._id || device?.deviceId)?.toString(),
    deviceName: device?.name || device?.deviceName,
    ipAddress:  device?.ipAddress,
    metric: {
      name:      triggerInfo.metric,
      value:     triggerInfo.actualValue,
      threshold: triggerInfo.threshold,
    },
    sendEmail:  severity === 'critical' && emailConfig.length > 0,
    emailTo:    emailConfig,
  });
};

/**
 * Get unread alert count — used by Navbar badge
 */
const getUnreadCount = async () => {
  return Alert.countDocuments({ read: false, status: { $in: ['active', 'acknowledged'] } });
};

/**
 * Mark alerts as read
 */
const markAsRead = async (alertIds = []) => {
  if (alertIds.length === 0) {
    return Alert.updateMany({ read: false }, { read: true });
  }
  return Alert.updateMany({ _id: { $in: alertIds } }, { read: true });
};

/**
 * Acknowledge an alert
 */
const acknowledgeAlert = async (alertId, acknowledgedBy = 'operator') => {
  return Alert.findByIdAndUpdate(
    alertId,
    { status: 'acknowledged', acknowledgedBy, acknowledgedAt: new Date(), read: true },
    { new: true }
  );
};

/**
 * Resolve an alert
 */
const resolveAlert = async (alertId) => {
  return Alert.findByIdAndUpdate(
    alertId,
    { status: 'resolved', resolvedAt: new Date(), read: true },
    { new: true }
  );
};

/**
 * Get alert statistics
 */
const getAlertStats = async () => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);

  const [
    bySeverity, byStatus, total24h,
    unread, active, resolved7d,
  ] = await Promise.all([
    Alert.aggregate([
      { $match: { firedAt: { $gte: since24h } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Alert.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Alert.countDocuments({ firedAt: { $gte: since24h } }),
    Alert.countDocuments({ read: false, status: { $in: ['active', 'acknowledged'] } }),
    Alert.countDocuments({ status: 'active' }),
    Alert.countDocuments({ status: 'resolved', resolvedAt: { $gte: since7d } }),
  ]);

  const severity = { critical: 0, warning: 0, info: 0 };
  bySeverity.forEach(({ _id, count }) => { if (_id in severity) severity[_id] = count; });

  const statusMap = { active: 0, acknowledged: 0, resolved: 0, dismissed: 0 };
  byStatus.forEach(({ _id, count }) => { if (_id in statusMap) statusMap[_id] = count; });

  return { severity, status: statusMap, total24h, unread, active, resolved7d };
};

module.exports = {
  createAlert,
  createAlertFromRule,
  getUnreadCount,
  markAsRead,
  acknowledgeAlert,
  resolveAlert,
  getAlertStats,
};