const axios   = require('axios');
const ActionLog = require('../models/ActionLog');
const { broadcast } = require('../utils/websocket');
const logger  = require('../utils/logger');

/**
 * Execute a single action from a fired rule
 */
const executeAction = async (action, rule, device, triggerInfo) => {
  const logBase = {
    ruleId:     rule._id.toString(),
    ruleName:   rule.name,
    deviceId:   device?.deviceId || device?._id?.toString() || null,
    deviceName: device?.deviceName || device?.name || null,
    ipAddress:  device?.ipAddress || null,
    trigger:    triggerInfo,
    action: {
      type:   action.type,
      config: action.config,
    },
    severity: deriveSeverity(rule, triggerInfo),
    firedAt:  new Date(),
  };

  try {
    let result = 'success';
    let message = '';

    switch (action.type) {

      // ── Log ─────────────────────────────────────────────────────────────────
      case 'log': {
        message = interpolate(action.config?.message || 'Rule fired', device, triggerInfo);
        logger.warn(`[Rule:${rule.name}] ${message}`);
        break;
      }

      // ── Alert (WebSocket broadcast) ──────────────────────────────────────────
      // Replace the 'alert' case with:
case 'alert': {
  message = interpolate(
    action.config?.message || `Alert: ${triggerInfo.metric} is ${triggerInfo.actualValue}`,
    device, triggerInfo
  );

  // Create persistent alert in DB (Phase 8 integration)
  const { createAlert } = require('./alertService');
  await createAlert({
    title:      `${rule.name}`,
    message,
    severity:   action.config?.severity || 'warning',
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
    sendEmail: action.config?.severity === 'critical',
    emailTo:   process.env.ALERT_EMAIL_TO
      ? process.env.ALERT_EMAIL_TO.split(',').map(e => e.trim())
      : [],
  });

  logger.warn(`[Alert] ${message}`);
  break;
}

      // ── Webhook ──────────────────────────────────────────────────────────────
      case 'webhook': {
        const url = action.config?.url;
        if (!url) { result = 'skipped'; message = 'No URL configured'; break; }

        const payload = {
          rule:      rule.name,
          device:    device?.deviceName || device?.name,
          ipAddress: device?.ipAddress,
          metric:    triggerInfo.metric,
          value:     triggerInfo.actualValue,
          threshold: triggerInfo.threshold,
          timestamp: new Date().toISOString(),
          ...( action.config?.payload || {} ),
        };

        await axios.post(url, payload, { timeout: 5000 });
        message = `Webhook sent to ${url}`;
        break;
      }

      // ── Retry (ping device immediately) ─────────────────────────────────────
      case 'retry': {
        const { retryDevice } = require('./retryService');
        const retryResult = await retryDevice(
          device?.ipAddress || device?.deviceId,
          action.config?.maxRetries || 3,
          action.config?.delayMs   || 5000,
        );
        message = retryResult.message;
        result  = retryResult.success ? 'success' : 'failed';
        break;
      }

      // ── Email (placeholder — wire SMTP in Phase 8) ────────────────────────
      case 'email': {
        message = `Email queued to ${action.config?.to || 'admin'} — will be sent in Phase 8`;
        logger.info(`[Email placeholder] ${message}`);
        break;
      }

      // ── Script (run a system command) ────────────────────────────────────────
      case 'script': {
        const { exec } = require('child_process');
        const cmd = action.config?.command;
        if (!cmd) { result = 'skipped'; message = 'No command configured'; break; }

        await new Promise((resolve) => {
          exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
            if (err) { result = 'failed'; message = err.message; }
            else { message = stdout?.trim() || 'Script executed'; }
            resolve();
          });
        });
        break;
      }

      default:
        result  = 'skipped';
        message = `Unknown action type: ${action.type}`;
    }

    await ActionLog.create({
      ...logBase,
      action: { ...logBase.action, result, message },
    });

    return { result, message };

  } catch (err) {
    logger.error(`[ActionExecutor] Action '${action.type}' failed: ${err.message}`);
    await ActionLog.create({
      ...logBase,
      action: { ...logBase.action, result: 'failed', error: err.message },
    });
    return { result: 'failed', error: err.message };
  }
};

/**
 * Execute ALL actions for a fired rule
 */
const executeAllActions = async (rule, device, triggerInfo) => {
  const results = [];
  for (const action of rule.actions) {
    const r = await executeAction(action, rule, device, triggerInfo);
    results.push({ type: action.type, ...r });
  }
  return results;
};

/**
 * Replace {{device}}, {{value}}, {{metric}} placeholders in messages
 */
const interpolate = (template, device, trigger) => {
  return template
    .replace(/{{device}}/g,    device?.name || device?.deviceName || 'Unknown')
    .replace(/{{ip}}/g,        device?.ipAddress || '')
    .replace(/{{metric}}/g,    trigger?.metric || '')
    .replace(/{{value}}/g,     trigger?.actualValue ?? '')
    .replace(/{{threshold}}/g, trigger?.threshold ?? '');
};

/**
 * Derive log severity from trigger info
 */
const deriveSeverity = (rule, trigger) => {
  const val = parseFloat(trigger?.actualValue);
  if (trigger?.metric === 'status' && trigger?.actualValue === 'offline') return 'critical';
  if (trigger?.metric === 'responseTime' && val > 500) return 'critical';
  if (trigger?.metric === 'packetLoss'   && val > 20)  return 'critical';
  if (trigger?.metric === 'cpuUsage'     && val > 90)  return 'critical';
  if (val > 70) return 'warning';
  return 'info';
};

module.exports = { executeAction, executeAllActions };