const cron    = require('node-cron');
const Alert   = require('../models/Alert');
const { sendAlertEmail } = require('./emailService');
const { broadcast } = require('../utils/websocket');
const logger  = require('../utils/logger');

/**
 * Escalation Engine — runs every 5 minutes
 *
 * Logic:
 * 1. Find active alerts past their nextEscalationAt time
 * 2. Increment escalationLevel
 * 3. Re-send email (if configured)
 * 4. Broadcast escalation event
 * 5. Set next escalation time (or stop at level 2)
 */
const runEscalation = async () => {
  const now = new Date();

  const overdueAlerts = await Alert.find({
    status:           'active',
    nextEscalationAt: { $lte: now },
    escalationLevel:  { $lt: 2 },   // Max 2 escalations
  });

  if (!overdueAlerts.length) return;

  logger.warn(`[Escalation] Processing ${overdueAlerts.length} overdue alert(s)`);

  for (const alert of overdueAlerts) {
    const newLevel = alert.escalationLevel + 1;

    const escalationMessages = {
      1: `ESCALATION L1: "${alert.title}" has been active for ${getMinutesSince(alert.firedAt)} minutes without acknowledgement`,
      2: `ESCALATION L2 (FINAL): "${alert.title}" — URGENT: Unacknowledged critical alert`,
    };

    await Alert.findByIdAndUpdate(alert._id, {
      escalated:       true,
      escalatedAt:     now,
      escalationLevel: newLevel,
      // Level 1 → escalate again in 30 min; Level 2 → no more
      nextEscalationAt: newLevel < 2
        ? new Date(now.getTime() + 30 * 60 * 1000)
        : null,
    });

    // Broadcast escalation
    broadcast('ALERT_ESCALATED', {
      alertId:         alert._id,
      title:           alert.title,
      escalationLevel: newLevel,
      message:         escalationMessages[newLevel],
      deviceName:      alert.deviceName,
      severity:        alert.severity,
    });

    // Re-send email for escalations
    const emailTo = process.env.ALERT_EMAIL_TO
      ? process.env.ALERT_EMAIL_TO.split(',').map((e) => e.trim())
      : [];

    if (emailTo.length > 0 && alert.severity === 'critical') {
      const escalatedAlert = {
        ...alert.toObject(),
        title:   `[L${newLevel} ESCALATION] ${alert.title}`,
        message: escalationMessages[newLevel],
      };
      await sendAlertEmail(escalatedAlert, emailTo);
    }

    logger.warn(`[Escalation] Alert "${alert.title}" escalated to Level ${newLevel}`);
  }
};

const getMinutesSince = (date) => Math.round((Date.now() - new Date(date).getTime()) / 60000);

let escalationJob = null;

const startEscalationEngine = () => {
  if (escalationJob) return;
  // Run every 5 minutes
  escalationJob = cron.schedule('*/5 * * * *', async () => {
    try {
      await runEscalation();
    } catch (err) {
      logger.error(`[Escalation] Error: ${err.message}`);
    }
  });
  logger.info('[Escalation] ✅ Engine started — checking every 5 minutes');
};

const stopEscalationEngine = () => {
  escalationJob?.stop();
};

module.exports = { startEscalationEngine, stopEscalationEngine, runEscalation };