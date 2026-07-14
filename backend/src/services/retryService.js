const ping    = require('ping');
const Device  = require('../models/Device');
const Metric  = require('../models/Metric');
const { broadcast } = require('../utils/websocket');
const logger  = require('../utils/logger');

/**
 * Retry pinging a device N times with delay between attempts.
 * Updates device status and saves each result as a metric.
 *
 * Why retry?  A single failed ping can be a transient network blip.
 * Retrying 3x with 5s delays prevents false "offline" status.
 */
const retryDevice = async (ipOrId, maxRetries = 3, delayMs = 5000) => {
  // Find device
  let device;
  try {
    device = ipOrId.match(/^[0-9a-f]{24}$/i)
      ? await Device.findById(ipOrId)
      : await Device.findOne({ ipAddress: ipOrId });
  } catch {
    device = await Device.findOne({ ipAddress: ipOrId });
  }

  if (!device) {
    return { success: false, message: `Device not found: ${ipOrId}` };
  }

  logger.info(`[Retry] Starting retry for ${device.name} (${device.ipAddress}) — max ${maxRetries} attempts`);

  broadcast('RETRY_STARTED', {
    deviceId:   device._id,
    deviceName: device.name,
    ipAddress:  device.ipAddress,
    maxRetries,
  });

  let lastResult = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info(`[Retry] ${device.name} — attempt ${attempt}/${maxRetries}`);

    const result = await ping.promise.probe(device.ipAddress, {
      timeout: 5,
      extra: ['-n', '1'],
    });

    lastResult = result;

    const responseTime = result.alive ? parseFloat(result.avg) : null;

    // Save metric for each attempt
    await Metric.create({
      deviceId:   device._id,
      ipAddress:  device.ipAddress,
      type:       'ping',
      ping: {
        alive:        result.alive,
        responseTime,
        packetLoss:   result.alive ? 0 : 100,
      },
    });

    broadcast('RETRY_ATTEMPT', {
      deviceId:   device._id,
      deviceName: device.name,
      ipAddress:  device.ipAddress,
      attempt,
      maxRetries,
      alive:      result.alive,
      responseTime,
    });

    if (result.alive) {
      // Device recovered — update status
      await Device.findByIdAndUpdate(device._id, {
        status:   'online',
        lastSeen: new Date(),
      });

      logger.info(`[Retry] ✅ ${device.name} recovered on attempt ${attempt}`);

      broadcast('RETRY_RECOVERED', {
        deviceId:   device._id,
        deviceName: device.name,
        ipAddress:  device.ipAddress,
        attempt,
        responseTime,
      });

      return {
        success:     true,
        recovered:   true,
        attempt,
        responseTime,
        message: `${device.name} recovered on attempt ${attempt}/${maxRetries} (${responseTime}ms)`,
      };
    }

    // Wait before next attempt (except on last)
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // All retries exhausted — confirm offline
  await Device.findByIdAndUpdate(device._id, { status: 'offline' });

  logger.warn(`[Retry] ❌ ${device.name} still offline after ${maxRetries} retries`);

  broadcast('RETRY_FAILED', {
    deviceId:   device._id,
    deviceName: device.name,
    ipAddress:  device.ipAddress,
    maxRetries,
  });

  return {
    success:   false,
    recovered: false,
    message:   `${device.name} still offline after ${maxRetries} retry attempts`,
  };
};

module.exports = { retryDevice };