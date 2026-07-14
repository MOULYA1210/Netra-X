const axios   = require('axios');
const Forecast = require('../models/Forecast');
const Device   = require('../models/Device');
const { broadcast } = require('../utils/websocket');
const logger   = require('../utils/logger');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Fetch RTT forecast for a device from the AI service
 */
const getDeviceForecast = async (deviceId, horizon = 60) => {
  const res = await axios.get(
    `${AI_URL}/forecast/${deviceId}/rtt?horizon=${horizon}`,
    { timeout: 15000 }
  );
  return res.data.data;
};

/**
 * Run forecasts for all devices and persist results
 */
const runAllForecasts = async (horizon = 60) => {
  const res = await axios.post(
    `${AI_URL}/forecast/all`,
    { horizon },
    { timeout: 60000 }
  );

  const results = res.data.data || [];

  // Persist each forecast
  for (const item of results) {
    if (item.rtt?.status === 'success') {
      await Forecast.create({
        deviceId:        item.deviceId,
        deviceName:      item.deviceName,
        ipAddress:       item.ipAddress,
        metric:          'rtt',
        horizonMinutes:  horizon,
        trendDirection:  item.rtt.trend_direction,
        trendPct:        item.rtt.trend_pct,
        currentValue:    item.rtt.current_avg_rtt,
        forecastedValue: item.rtt.forecasted_rtt,
        history:         item.rtt.history  || [],
        forecast:        item.rtt.forecast || [],
        generatedAt:     new Date(),
      });
    }
  }

  logger.info(`[Forecast] Completed for ${results.length} devices`);
  broadcast('FORECAST_READY', { deviceCount: results.length, horizon });
  return results;
};

/**
 * Score health for all devices
 */
const runHealthScores = async () => {
  const res = await axios.post(`${AI_URL}/health-score/all`, {}, { timeout: 60000 });
  const results = res.data.data || [];

  // Persist scores
  for (const item of results) {
    if (item.status === 'scored') {
      await Forecast.create({
        deviceId:       item.deviceId,
        deviceName:     item.deviceName,
        ipAddress:      item.ipAddress,
        metric:         'health',
        healthScore:    item.healthScore,
        grade:          item.grade,
        failureRisk:    item.failureRisk,
        riskLevel:      item.riskLevel,
        currentValue:   item.healthScore,
        generatedAt:    new Date(),
      });
    }
  }

  logger.info(`[HealthScore] Scored ${results.length} devices`);
  broadcast('HEALTH_SCORES_READY', { deviceCount: results.length });
  return results;
};

/**
 * Get latest health scores for all devices
 */
const getLatestHealthScores = async () => {
  return Forecast.aggregate([
    { $match: { metric: 'health' } },
    { $sort: { generatedAt: -1 } },
    { $group: { _id: '$deviceId', latest: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$latest' } },
    { $sort: { failureRisk: -1 } },
  ]);
};

/**
 * Get latest RTT forecast for a device
 */
const getLatestForecast = async (deviceId) => {
  return Forecast.findOne({ deviceId, metric: 'rtt' })
    .sort({ generatedAt: -1 });
};

module.exports = {
  getDeviceForecast,
  runAllForecasts,
  runHealthScores,
  getLatestHealthScores,
  getLatestForecast,
};