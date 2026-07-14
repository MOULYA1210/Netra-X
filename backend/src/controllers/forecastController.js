const {
  getDeviceForecast,
  runAllForecasts,
  runHealthScores,
  getLatestHealthScores,
  getLatestForecast,
} = require('../services/forecastService');
const Forecast = require('../models/Forecast');
const logger   = require('../utils/logger');

// @desc   Run RTT forecasts for all devices
// @route  POST /api/forecast/run
const runForecasts = async (req, res) => {
  const { horizon = 60 } = req.body;
  const results = await runAllForecasts(parseInt(horizon));
  res.status(200).json({ success: true, count: results.length, data: results });
};

// @desc   Get forecast for a specific device
// @route  GET /api/forecast/device/:id
const getDeviceForecastHandler = async (req, res) => {
  const { horizon = 60 } = req.query;
  const data = await getDeviceForecast(req.params.id, parseInt(horizon));
  res.status(200).json({ success: true, data });
};

// @desc   Get latest stored forecast for a device
// @route  GET /api/forecast/device/:id/latest
const getLatestForecastHandler = async (req, res) => {
  const forecast = await getLatestForecast(req.params.id);
  if (!forecast) {
    return res.status(404).json({ success: false, message: 'No forecast found. Run /api/forecast/run first.' });
  }
  res.status(200).json({ success: true, data: forecast });
};

// @desc   Run health scoring for all devices
// @route  POST /api/forecast/health-scores
const runHealthScoresHandler = async (req, res) => {
  const results = await runHealthScores();
  res.status(200).json({ success: true, count: results.length, data: results });
};

// @desc   Get latest health scores (for risk table)
// @route  GET /api/forecast/health-scores
const getHealthScoresHandler = async (req, res) => {
  const scores = await getLatestHealthScores();
  res.status(200).json({ success: true, count: scores.length, data: scores });
};

// @desc   Get forecast history for a device
// @route  GET /api/forecast/device/:id/history
const getForecastHistory = async (req, res) => {
  const forecasts = await Forecast.find({
    deviceId: req.params.id,
    metric:   'rtt',
  })
    .sort({ generatedAt: -1 })
    .limit(20)
    .select('forecastedValue currentValue trendDirection trendPct generatedAt');

  res.status(200).json({ success: true, count: forecasts.length, data: forecasts });
};

// @desc   Get analytics summary (all devices latest state)
// @route  GET /api/forecast/summary
const getAnalyticsSummary = async (req, res) => {
  const [healthScores, recentForecasts] = await Promise.all([
    getLatestHealthScores(),
    Forecast.aggregate([
      { $match: { metric: 'rtt' } },
      { $sort: { generatedAt: -1 } },
      { $group: { _id: '$deviceId', latest: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$latest' } },
    ]),
  ]);

  const atRisk     = healthScores.filter((s) => (s.failureRisk || 0) >= 50).length;
  const avgHealth  = healthScores.length
    ? Math.round(healthScores.reduce((a, b) => a + (b.healthScore || 0), 0) / healthScores.length)
    : null;
  const degrading  = recentForecasts.filter((f) => f.trendDirection === 'increasing').length;

  res.status(200).json({
    success: true,
    data: {
      totalScored:   healthScores.length,
      atRisk,
      avgHealth,
      degradingDevices: degrading,
      healthScores,
      forecasts: recentForecasts,
    },
  });
};

module.exports = {
  runForecasts,
  getDeviceForecastHandler,
  getLatestForecastHandler,
  runHealthScoresHandler,
  getHealthScoresHandler,
  getForecastHistory,
  getAnalyticsSummary,
};