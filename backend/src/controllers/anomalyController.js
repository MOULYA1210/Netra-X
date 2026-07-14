const {
  triggerTraining,
  runAnomalyDetection,
  analyzeDevice,
  getRecentAnomalies,
  isAIServiceUp,
} = require('../services/anomalyService');
const Anomaly = require('../models/Anomaly');

// @desc    Get AI service + model status
// @route   GET /api/anomaly/status
const getAIStatus = async (req, res) => {
  const up = await isAIServiceUp();
  res.status(200).json({
    success: true,
    data: {
      aiServiceOnline: up,
      aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:5001',
    },
  });
};

// @desc    Train the anomaly detection model
// @route   POST /api/anomaly/train
const trainModel = async (req, res) => {
  const result = await triggerTraining();
  res.status(202).json({ success: true, data: result });
};

// @desc    Run detection across all devices
// @route   POST /api/anomaly/detect
const detectAnomalies = async (req, res) => {
  const result = await runAnomalyDetection();
  if (!result) {
    return res.status(503).json({
      success: false,
      message: 'AI service not available. Start the Python service on port 5001.',
    });
  }
  res.status(200).json({ success: true, data: result });
};

// @desc    Analyze a single device
// @route   POST /api/anomaly/device/:id
const analyzeOne = async (req, res) => {
  const result = await analyzeDevice(req.params.id);
  res.status(200).json({ success: true, data: result });
};

// @desc    Get recent anomalies
// @route   GET /api/anomaly/recent
const getRecent = async (req, res) => {
  const { limit = 20, severity } = req.query;
  const anomalies = await getRecentAnomalies(parseInt(limit), severity);
  res.status(200).json({ success: true, count: anomalies.length, data: anomalies });
};

// @desc    Get anomaly history for a device
// @route   GET /api/anomaly/device/:id/history
const getDeviceHistory = async (req, res) => {
  const anomalies = await Anomaly.find({
    deviceId: req.params.id,
    anomalyScore: { $gte: 10 },
  })
    .sort({ analyzedAt: -1 })
    .limit(50);

  res.status(200).json({ success: true, count: anomalies.length, data: anomalies });
};

// @desc    Acknowledge an anomaly
// @route   PATCH /api/anomaly/:id/acknowledge
const acknowledgeAnomaly = async (req, res) => {
  const anomaly = await Anomaly.findByIdAndUpdate(
    req.params.id,
    {
      acknowledged: true,
      acknowledgedBy: req.body.acknowledgedBy || 'operator',
      acknowledgedAt: new Date(),
    },
    { new: true }
  );

  if (!anomaly) {
    return res.status(404).json({ success: false, message: 'Anomaly not found' });
  }

  res.status(200).json({ success: true, data: anomaly });
};

// @desc    Get anomaly summary stats
// @route   GET /api/anomaly/stats
const getAnomalyStats = async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stats = await Anomaly.aggregate([
    { $match: { analyzedAt: { $gte: since }, anomalyScore: { $gte: 10 } } },
    { $group: { _id: '$severity', count: { $sum: 1 } } },
  ]);

  const summary = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  stats.forEach(({ _id, count }) => {
    if (_id in summary) summary[_id] = count;
    summary.total += count;
  });

  res.status(200).json({ success: true, data: summary });
};

module.exports = {
  getAIStatus,
  trainModel,
  detectAnomalies,
  analyzeOne,
  getRecent,
  getDeviceHistory,
  acknowledgeAnomaly,
  getAnomalyStats,
};