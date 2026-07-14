const Metric = require('../models/Metric');
const Device = require('../models/Device');
const { getStatus } = require('../services/monitorScheduler');
const { getClientCount } = require('../utils/websocket');

// @desc    Get recent ping metrics for a device
// @route   GET /api/metrics/:deviceId/ping
const getPingMetrics = async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 60, hours = 1 } = req.query;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const metrics = await Metric.find({
    deviceId,
    type: 'ping',
    timestamp: { $gte: since },
  })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .select('ping timestamp -_id');

  // Reverse so oldest is first (for charts)
  res.status(200).json({
    success: true,
    count: metrics.length,
    data: metrics.reverse(),
  });
};

// @desc    Get SNMP metrics for a device
// @route   GET /api/metrics/:deviceId/snmp
const getSNMPMetrics = async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 20, hours = 1 } = req.query;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const metrics = await Metric.find({
    deviceId,
    type: 'snmp',
    timestamp: { $gte: since },
  })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .select('snmp timestamp -_id');

  res.status(200).json({
    success: true,
    count: metrics.length,
    data: metrics.reverse(),
  });
};

// @desc    Get latest metric for all devices (dashboard overview)
// @route   GET /api/metrics/latest
const getLatestMetrics = async (req, res) => {
  // Aggregate: get the most recent ping metric per device
  const latest = await Metric.aggregate([
    { $match: { type: 'ping' } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$deviceId',
        latestMetric: { $first: '$$ROOT' },
      },
    },
    {
      $lookup: {
        from: 'devices',
        localField: '_id',
        foreignField: '_id',
        as: 'device',
      },
    },
    { $unwind: { path: '$metrices', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        deviceId: '$_id',
        deviceName: '$device.name',
        ipAddress: '$latestMetric.ipAddress',
        status: '$device.status',
        alive: '$latestMetric.ping.alive',
        responseTime: '$latestMetric.ping.responseTime',
        timestamp: '$latestMetric.timestamp',
        type: '$device.type',
      },
    },
    { $sort: { deviceName: 1 } },
  ]);

  res.status(200).json({ success: true, count: latest.length, data: latest });
};

// @desc    Get monitoring system status
// @route   GET /api/metrics/monitor-status
const getMonitorStatus = async (req, res) => {
  const schedulerStatus = getStatus();
  const wsClients = getClientCount();

  const [totalMetrics, metricsLast1h] = await Promise.all([
    Metric.estimatedDocumentCount(),
    Metric.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      scheduler: schedulerStatus,
      websocket: { connectedClients: wsClients },
      metrics: { total: totalMetrics, lastHour: metricsLast1h },
    },
  });
};

// @desc    Get uptime % for a device over a time window
// @route   GET /api/metrics/:deviceId/uptime
const getUptimeStats = async (req, res) => {
  const { deviceId } = req.params;
  const { hours = 24 } = req.query;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const metrics = await Metric.find({
    deviceId,
    type: 'ping',
    timestamp: { $gte: since },
  }).select('ping.alive -_id');

  if (metrics.length === 0) {
    return res.status(200).json({
      success: true,
      data: { uptimePercent: null, totalChecks: 0, message: 'No data yet' },
    });
  }

  const upCount = metrics.filter((m) => m.ping?.alive).length;
  const uptimePercent = ((upCount / metrics.length) * 100).toFixed(2);

  res.status(200).json({
    success: true,
    data: {
      uptimePercent: parseFloat(uptimePercent),
      totalChecks: metrics.length,
      upChecks: upCount,
      downChecks: metrics.length - upCount,
      windowHours: parseInt(hours),
    },
  });
};

module.exports = {
  getPingMetrics,
  getSNMPMetrics,
  getLatestMetrics,
  getMonitorStatus,
  getUptimeStats,
};