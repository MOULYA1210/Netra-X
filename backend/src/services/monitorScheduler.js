const cron = require('node-cron');
const { pingAllDevices } = require('./pingService');
const { collectAllSNMP } = require('./snmpService');
const { broadcast } = require('../utils/websocket');
const logger = require('../utils/logger');
const { evaluateAllRules } = require('./ruleEngine');

const jobs = {};

/**
 * Monitoring intervals
 * Production values: ping every 60s, SNMP every 300s
 * Dev values: faster for testing
 */
const INTERVALS = {
  ping: parseInt(process.env.PING_INTERVAL_SECONDS) || 30,
  snmp: parseInt(process.env.SNMP_INTERVAL_SECONDS) || 120,
};

/**
 * Start the ping monitoring loop
 */
const startPingMonitor = () => {
  if (jobs.ping) {
    logger.warn('[Scheduler] Ping monitor already running');
    return;
  }

  const cronExpr = `*/${INTERVALS.ping} * * * * *`; // every N seconds

  jobs.ping = cron.schedule(cronExpr, async () => {
  console.log("⏱️ CRON TRIGGERED"); // ADD THIS

  try {
    await pingAllDevices();
  } catch (err) {
    logger.error(`[Scheduler] Ping sweep error: ${err.message}`);
  }
});

  logger.info(`[Scheduler] ✅ Ping monitor started — every ${INTERVALS.ping}s`);
};

/**
 * Start the SNMP collection loop
 */
const startSNMPMonitor = () => {
  if (jobs.snmp) {
    logger.warn('[Scheduler] SNMP monitor already running');
    return;
  }

  const cronExpr = `*/${INTERVALS.snmp} * * * * *`;

  jobs.snmp = cron.schedule(cronExpr, async () => {
    try {
      await collectAllSNMP();
    } catch (err) {
      logger.error(`[Scheduler] SNMP collection error: ${err.message}`);
    }
  });

  logger.info(`[Scheduler] ✅ SNMP monitor started — every ${INTERVALS.snmp}s`);
};

/**
 * Start all monitors
 */

const startAllMonitors = () => {
  logger.info('[Scheduler] Starting monitoring engine...');
  startPingMonitor();
  startSNMPMonitor();

  // Run initial sweep immediately (don't wait for first cron tick)
  setTimeout(async () => {
    logger.info('[Scheduler] Running initial ping sweep...');
    try {
      await pingAllDevices();
    } catch (err) {
      logger.error(`[Scheduler] Initial sweep error: ${err.message}`);
    }
  }, 3000); // 3s delay to let server fully start

  broadcast('MONITOR_STARTED', {
    pingInterval: INTERVALS.ping,
    snmpInterval: INTERVALS.snmp,
  });
  const startRuleEngine = () => {
  const ruleInterval = process.env.RULE_INTERVAL_SECONDS || 60;
  const cronExpr = `*/${ruleInterval} * * * * *`;

  jobs.rules = cron.schedule(cronExpr, async () => {
    try {
      await evaluateAllRules();
    } catch (err) {
      logger.error(`[Scheduler] Rule engine error: ${err.message}`);
    }
  });

  logger.info(`[Scheduler] ✅ Rule engine started — every ${ruleInterval}s`);
};

// Call it inside startAllMonitors:
startRuleEngine();
};

/**
 * Stop all monitors (used for graceful shutdown)
 */
const stopAllMonitors = () => {
  Object.entries(jobs).forEach(([name, job]) => {
    job.stop();
    logger.info(`[Scheduler] Stopped: ${name}`);
  });
};

/**
 * Get scheduler status
 */
const getStatus = () => ({
  ping: {
    running: !!jobs.ping,
    intervalSeconds: INTERVALS.ping,
  },
  snmp: {
    running: !!jobs.snmp,
    intervalSeconds: INTERVALS.snmp,
  },
  rules: {
  running: !!jobs.rules,
  intervalSeconds: process.env.RULE_INTERVAL_SECONDS || 60,
},
});

module.exports = {
  startAllMonitors,
  stopAllMonitors,
  startPingMonitor,
  startSNMPMonitor,
  getStatus,
};