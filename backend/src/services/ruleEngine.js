const Rule    = require('../models/Rule');
const Device  = require('../models/Device');
const Metric  = require('../models/Metric');
const Anomaly = require('../models/Anomaly');
const Forecast = require('../models/Forecast');
const { executeAllActions } = require('./actionExecutor');
const logger  = require('../utils/logger');

/**
 * Evaluate a single condition against a value.
 * Returns true if the condition is met (rule should fire).
 */
const evaluateCondition = (operator, actual, threshold) => {
  const a = parseFloat(actual);
  const t = parseFloat(threshold);

  switch (operator) {
    case 'gt':       return a >  t;
    case 'lt':       return a <  t;
    case 'gte':      return a >= t;
    case 'lte':      return a <= t;
    case 'eq':       return String(actual) === String(threshold);
    case 'neq':      return String(actual) !== String(threshold);
    case 'contains': return String(actual).toLowerCase().includes(String(threshold).toLowerCase());
    default:         return false;
  }
};

/**
 * Get the current value of a metric for a device.
 * This is the "data layer" of the rule engine.
 */
const getMetricValue = async (metric, device) => {
  switch (metric) {

    case 'status':
      return device.status;

    case 'responseTime': {
      const latest = await Metric.findOne({
        deviceId: device._id, type: 'ping',
      }).sort({ timestamp: -1 });
      return latest?.ping?.responseTime ?? null;
    }

    case 'packetLoss': {
      const latest = await Metric.findOne({
        deviceId: device._id, type: 'ping',
      }).sort({ timestamp: -1 });
      return latest?.ping?.packetLoss ?? null;
    }

    case 'cpuUsage': {
      const latest = await Metric.findOne({
        deviceId: device._id, type: 'snmp',
      }).sort({ timestamp: -1 });
      return latest?.snmp?.cpuUsage ?? null;
    }

    case 'memoryUsage': {
      const latest = await Metric.findOne({
        deviceId: device._id, type: 'snmp',
      }).sort({ timestamp: -1 });
      if (!latest?.snmp?.memoryUsed || !latest?.snmp?.memoryTotal) return null;
      return (latest.snmp.memoryUsed / latest.snmp.memoryTotal) * 100;
    }

    case 'uptimePercent': {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const metrics = await Metric.find({
        deviceId: device._id, type: 'ping', timestamp: { $gte: since },
      }).select('ping.alive');
      if (!metrics.length) return null;
      const up = metrics.filter((m) => m.ping?.alive).length;
      return (up / metrics.length) * 100;
    }

    case 'anomalyScore': {
      const latest = await Anomaly.findOne({ deviceId: device._id.toString() })
        .sort({ analyzedAt: -1 });
      return latest?.anomalyScore ?? null;
    }

    case 'healthScore': {
      const latest = await Forecast.findOne({
        deviceId: device._id.toString(), metric: 'health',
      }).sort({ generatedAt: -1 });
      return latest?.healthScore ?? null;
    }

    default:
      return null;
  }
};

/**
 * Get all devices that a rule applies to
 */
const getScopedDevices = async (rule) => {
  switch (rule.scope) {
    case 'all':
      return Device.find({ monitoringEnabled: true });
    case 'device':
      return Device.find({ _id: rule.deviceId });
    case 'type':
      return Device.find({ type: rule.deviceType, monitoringEnabled: true });
    default:
      return Device.find({ monitoringEnabled: true });
  }
};

/**
 * Check throttle — don't fire a rule more than once per throttleSeconds
 */
const isThrottled = (rule) => {
  if (!rule.lastFiredAt) return false;
  const elapsed = (Date.now() - new Date(rule.lastFiredAt).getTime()) / 1000;
  return elapsed < rule.throttleSeconds;
};

/**
 * Evaluate ONE rule against its scoped devices.
 * Returns array of fires that happened.
 */
const evaluateRule = async (rule) => {
  if (!rule.enabled) return [];
  if (isThrottled(rule)) {
    logger.debug(`[RuleEngine] Rule "${rule.name}" throttled — skipping`);
    return [];
  }

  const devices = await getScopedDevices(rule);
  const { metric, operator, value: threshold, consecutiveCount = 1 } = rule.condition;
  const fires = [];

  for (const device of devices) {
    const actualValue = await getMetricValue(metric, device);

    if (actualValue === null || actualValue === undefined) continue;

    const conditionMet = evaluateCondition(operator, actualValue, threshold);

    // ── Consecutive count tracking ─────────────────────────────────────────
    const deviceKey = device._id.toString();
    const currentCount = (rule.violationCounts?.get?.(deviceKey) || 0);

    if (conditionMet) {
      const newCount = currentCount + 1;
      rule.violationCounts?.set?.(deviceKey, newCount);

      if (newCount < consecutiveCount) {
        logger.debug(`[RuleEngine] "${rule.name}" violation ${newCount}/${consecutiveCount} for ${device.name}`);
        continue;  // Not enough consecutive violations yet
      }

      // ── FIRE ──────────────────────────────────────────────────────────────
      logger.warn(`[RuleEngine] ⚡ Rule "${rule.name}" fired for ${device.name} — ${metric} is ${actualValue} (${operator} ${threshold})`);

      const triggerInfo = { metric, operator, threshold, actualValue };
      const actionResults = await executeAllActions(rule, device, triggerInfo);

      fires.push({ device: device.name, ipAddress: device.ipAddress, actualValue, actionResults });

      // Reset violation count after firing
      rule.violationCounts?.set?.(deviceKey, 0);

    } else {
      // Condition not met — reset violation count
      rule.violationCounts?.set?.(deviceKey, 0);
    }
  }

  // Update rule fire metadata
  if (fires.length > 0) {
    await Rule.findByIdAndUpdate(rule._id, {
      lastFiredAt:    new Date(),
      $inc: { fireCount: fires.length },
      violationCounts: Object.fromEntries(rule.violationCounts || new Map()),
    });
  } else {
    // Persist updated violation counts even if no fire
    await Rule.findByIdAndUpdate(rule._id, {
      violationCounts: Object.fromEntries(rule.violationCounts || new Map()),
    });
  }

  return fires;
};

/**
 * Evaluate ALL enabled rules.
 * Called by the scheduler every N seconds.
 */
const evaluateAllRules = async () => {
  const rules = await Rule.find({ enabled: true });

  if (!rules.length) {
    logger.debug('[RuleEngine] No enabled rules to evaluate');
    return;
  }

  logger.debug(`[RuleEngine] Evaluating ${rules.length} rule(s)...`);

  let totalFires = 0;
  for (const rule of rules) {
    try {
      const fires = await evaluateRule(rule);
      totalFires += fires.length;
    } catch (err) {
      logger.error(`[RuleEngine] Error evaluating rule "${rule.name}": ${err.message}`);
    }
  }

  if (totalFires > 0) {
    logger.info(`[RuleEngine] Evaluation complete — ${totalFires} action(s) triggered`);
  }
};

module.exports = { evaluateAllRules, evaluateRule, evaluateCondition };