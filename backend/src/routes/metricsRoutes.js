const express = require('express');
const router = express.Router();
const {
  getPingMetrics,
  getSNMPMetrics,
  getLatestMetrics,
  getMonitorStatus,
  getUptimeStats,
} = require('../controllers/metricsController');

router.get('/latest', getLatestMetrics);                    // GET /api/metrics/latest
router.get('/monitor-status', getMonitorStatus);            // GET /api/metrics/monitor-status
router.get('/:deviceId/ping', getPingMetrics);              // GET /api/metrics/:id/ping
router.get('/:deviceId/snmp', getSNMPMetrics);              // GET /api/metrics/:id/snmp
router.get('/:deviceId/uptime', getUptimeStats);            // GET /api/metrics/:id/uptime

module.exports = router;