const Device = require('../models/Device');
const logger = require('../utils/logger');

// @desc    Get all devices
// @route   GET /api/devices
// @access  Public (will add auth in Phase 10)
const getAllDevices = async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query;

  // Build dynamic filter — only add fields if provided
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [devices, total] = await Promise.all([
    Device.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-snmpCommunity'), // Never expose SNMP community string in list
    Device.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: devices.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: devices,
  });
};

// @desc    Get single device
// @route   GET /api/devices/:id
const getDeviceById = async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return res.status(404).json({
      success: false,
      message: `Device not found with id: ${req.params.id}`,
    });
  }

  res.status(200).json({ success: true, data: device });
};

// @desc    Create device
// @route   POST /api/devices
const createDevice = async (req, res) => {
  const device = await Device.create(req.body);

  logger.info(`New device added: ${device.name} (${device.ipAddress})`);

  res.status(201).json({ success: true, data: device });
};

// @desc    Update device
// @route   PUT /api/devices/:id
const updateDevice = async (req, res) => {
  // { new: true } returns updated doc; runValidators enforces schema rules
  const device = await Device.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!device) {
    return res.status(404).json({
      success: false,
      message: `Device not found with id: ${req.params.id}`,
    });
  }

  logger.info(`Device updated: ${device.name} (${device.ipAddress})`);
  res.status(200).json({ success: true, data: device });
};

// @desc    Delete device
// @route   DELETE /api/devices/:id
const deleteDevice = async (req, res) => {
  const device = await Device.findByIdAndDelete(req.params.id);

  if (!device) {
    return res.status(404).json({
      success: false,
      message: `Device not found with id: ${req.params.id}`,
    });
  }

  logger.info(`Device deleted: ${device.name} (${device.ipAddress})`);
  res.status(200).json({ success: true, message: 'Device removed', data: {} });
};

// @desc    Get dashboard summary stats
// @route   GET /api/devices/stats
const getDeviceStats = async (req, res) => {
  const stats = await Device.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Convert array to readable object: { online: 5, offline: 2, ... }
  const summary = { online: 0, offline: 0, degraded: 0, unknown: 0, total: 0 };
  stats.forEach(({ _id, count }) => {
    if (_id in summary) summary[_id] = count;
    summary.total += count;
  });

  res.status(200).json({ success: true, data: summary });
};

module.exports = {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceStats,
};