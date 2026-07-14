const axios = require('axios');
const Anomaly = require('../models/Anomaly');
const Device  = require('../models/Device');
const { broadcast } = require('../utils/websocket');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

/**
 * Check if the AI service is reachable
 */
const isAIServiceUp = async () => {
  try {
    await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
};

/**
 * Trigger model training on the AI service
 */
const triggerTraining = async () => {
  const up = await isAIServiceUp();
  if (!up) {
    logger.warn('[Anomaly] AI service unreachable — skipping training');
    return { success: false, message: 'AI service not available' };
  }

  const res = await axios.post(`${AI_SERVICE_URL}/train`);
  logger.info('[Anomaly] Model training triggered');
  return res.data;
};

/**
 * Run anomaly detection across all devices
 * Broadcasts results via WebSocket
 */
const runAnomalyDetection = async () => {
  const up = await isAIServiceUp();
  if (!up) {
    logger.warn('[Anomaly] AI service not available — skipping detection');
    return null;
  }

  logger.info('[Anomaly] Running anomaly detection...');

  const res = await axios.post(`${AI_SERVICE_URL}/analyze`, {}, { timeout: 30000 });
  const { results, anomaliesFound } = res.data;

  if (anomaliesFound > 0) {
    logger.warn(`[Anomaly] ⚠️  ${anomaliesFound} anomalies detected`);

    // Broadcast each anomaly via WebSocket
    const anomalies = results.filter(
      (r) => r.severity && r.severity !== 'normal' && r.anomalyScore >= 10
    );

    anomalies.forEach((anomaly) => {
      broadcast('ANOMALY_DETECTED', {
        deviceId:     anomaly.deviceId,
        deviceName:   anomaly.deviceName,
        ipAddress:    anomaly.ipAddress,
        anomalyScore: anomaly.anomalyScore,
        severity:     anomaly.severity,
        reasons:      anomaly.reasons || [],
        analyzedAt:   anomaly.analyzedAt,
      });
    });
  } else {
    logger.info('[Anomaly] No anomalies detected — network healthy');
  }

  return res.data;
};

/**
 * Analyze a single device
 */
const analyzeDevice = async (deviceId) => {
  const device = await Device.findById(deviceId);
  if (!device) throw new Error('Device not found');

  const up = await isAIServiceUp();
  if (!up) throw new Error('AI service not available');

  const res = await axios.post(
    `${AI_SERVICE_URL}/analyze/${deviceId}`,
    { deviceName: device.name, ipAddress: device.ipAddress },
    { timeout: 15000 }
  );

  return res.data;
};

/**
 * Get recent anomalies from MongoDB
 */
const getRecentAnomalies = async (limit = 20, severity = null) => {
  const filter = { anomalyScore: { $gte: 10 } };
  if (severity) filter.severity = severity;

  return Anomaly.find(filter)
    .sort({ analyzedAt: -1 })
    .limit(limit);
};

module.exports = {
  triggerTraining,
  runAnomalyDetection,
  analyzeDevice,
  getRecentAnomalies,
  isAIServiceUp,
};