const ping = require('ping');
const Metric = require('../models/Metric');
const Device = require('../models/Device');
const { broadcast } = require('../utils/websocket');
const logger = require('../utils/logger');

/**
 * Ping a single IP address using the OS ping command
 * Works on Windows without Administrator rights
 */
const pingHost = async (ipAddress) => {
  try {
    const result = await ping.promise.probe(ipAddress, {
      timeout: 5,        // seconds
      extra: ['-n', '1'], // Windows: send 1 packet
    });

    return {
      alive: result.alive,
      responseTime: result.alive ? parseFloat(result.avg) : null,
      error: null,
    };
  } catch (err) {
    return { alive: false, responseTime: null, error: err.message };
  }
};

/**
 * Ping a device, save metric, update device status
 */
const pingAndRecord = async (device) => {
  console.log("🔥 Saving metric for:", device.ipAddress); // ADD THIS

  const result = await pingHost(device.ipAddress);

  const newStatus = result.alive ? 'online' : 'offline';
  const statusChanged = device.status !== newStatus;

  // Save time-series metric
 await Metric.create({
  deviceId: device._id,
  ipAddress: device.ipAddress,
  type: 'ping',

  // 🔥 ADD THESE (CRITICAL)
  responseTime: result.responseTime,
  packetLoss: result.alive ? 0 : 100,
  timestamp: new Date(),

  // keep your nested object (optional)
  ping: {
    alive: result.alive,
    responseTime: result.responseTime,
    packetLoss: result.alive ? 0 : 100,
    ttl: 128,
  },
});await Metric.create({
  deviceId: device._id,
  ipAddress: device.ipAddress,
  type: 'ping',

  // 🔥 ADD THESE (CRITICAL FIX)
  responseTime: result.responseTime,
  packetLoss: result.alive ? 0 : 100,

  ping: {
    alive: result.alive,
    responseTime: result.responseTime,
    packetLoss: result.alive ? 0 : 100,
    ttl: 128,
  },

  timestamp: new Date(),
});

  // Update device record
  const updateData = { status: newStatus };
  if (result.alive) updateData.lastSeen = new Date();
  await Device.findByIdAndUpdate(device._id, updateData);

  // Broadcast to WebSocket clients
  broadcast('PING_RESULT', {
    deviceId: device._id,
    deviceName: device.name,
    ipAddress: device.ipAddress,
    status: newStatus,
    responseTime: result.responseTime,
    statusChanged,
    timestamp: new Date().toISOString(),
  });

  if (statusChanged) {
    logger.warn(
      `[Ping] Status change: ${device.name} (${device.ipAddress}) → ${newStatus}`
    );
    broadcast('STATUS_CHANGE', {
      deviceId: device._id,
      deviceName: device.name,
      ipAddress: device.ipAddress,
      previousStatus: device.status,
      newStatus,
    });
  }

  return { device, result };
};

/**
 * Ping ALL monitored devices concurrently
 */
const pingAllDevices = async () => {
  const devices = await Device.find({ monitoringEnabled: true });

  if (devices.length === 0) {
    logger.debug('[Ping] No devices to monitor');
    return;
  }

  logger.debug(`[Ping] Pinging ${devices.length} device(s)...`);

  const results = await Promise.allSettled(
    devices.map((device) => pingAndRecord(device))
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed    = results.filter((r) => r.status === 'rejected').length;

  broadcast('PING_SWEEP_COMPLETE', {
    total: devices.length,
    succeeded,
    failed,
    timestamp: new Date().toISOString(),
  });

  logger.info(`[Ping] Sweep complete — ${succeeded} ok, ${failed} errors`);
};

module.exports = { pingHost, pingAndRecord, pingAllDevices };