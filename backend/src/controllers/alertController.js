const Alert    = require('../models/Alert');
const {
  createAlert, getUnreadCount, markAsRead,
  acknowledgeAlert, resolveAlert, getAlertStats,
} = require('../services/alertService');
const { sendAlertEmail, verifyConnection } = require('../services/emailService');
const { broadcast } = require('../utils/websocket');
const logger   = require('../utils/logger');

// @desc   Get all alerts (paginated + filtered)
// @route  GET /api/alerts
const getAlerts = async (req, res) => {
  const {
    status, severity, category, read,
    page = 1, limit = 30, search,
  } = req.query;

  const filter = {};
  if (status)   filter.status   = status;
  if (severity) filter.severity = severity;
  if (category) filter.category = category;
  if (read !== undefined) filter.read = read === 'true';
  if (search) {
    filter.$or = [
      { title:      { $regex: search, $options: 'i' } },
      { message:    { $regex: search, $options: 'i' } },
      { deviceName: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [alerts, total] = await Promise.all([
    Alert.find(filter).sort({ firedAt: -1 }).skip(skip).limit(parseInt(limit)),
    Alert.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true, count: alerts.length, total,
    page: parseInt(page), pages: Math.ceil(total / parseInt(limit)),
    data: alerts,
  });
};

// @desc   Get unread count (for Navbar badge)
// @route  GET /api/alerts/unread-count
const getUnreadCountHandler = async (req, res) => {
  const count = await getUnreadCount();
  res.status(200).json({ success: true, data: { count } });
};

// @desc   Get alert statistics
// @route  GET /api/alerts/stats
const getStatsHandler = async (req, res) => {
  const stats = await getAlertStats();
  res.status(200).json({ success: true, data: stats });
};

// @desc   Get single alert
// @route  GET /api/alerts/:id
const getAlert = async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
  // Mark as read when opened
  if (!alert.read) await Alert.findByIdAndUpdate(alert._id, { read: true });
  res.status(200).json({ success: true, data: alert });
};

// @desc   Create manual alert
// @route  POST /api/alerts
const createManualAlert = async (req, res) => {
  const alert = await createAlert({ ...req.body, source: 'manual' });
  res.status(201).json({ success: true, data: alert });
};

// @desc   Acknowledge alert
// @route  PATCH /api/alerts/:id/acknowledge
const acknowledge = async (req, res) => {
  const alert = await acknowledgeAlert(req.params.id, req.body.acknowledgedBy || 'operator');
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
  broadcast('ALERT_UPDATED', { alertId: alert._id, status: 'acknowledged' });
  res.status(200).json({ success: true, data: alert });
};

// @desc   Resolve alert
// @route  PATCH /api/alerts/:id/resolve
const resolve = async (req, res) => {
  const alert = await resolveAlert(req.params.id);
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
  broadcast('ALERT_UPDATED', { alertId: alert._id, status: 'resolved' });
  res.status(200).json({ success: true, data: alert });
};

// @desc   Dismiss alert
// @route  PATCH /api/alerts/:id/dismiss
const dismiss = async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { status: 'dismissed', dismissedAt: new Date(), read: true },
    { new: true }
  );
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
  res.status(200).json({ success: true, data: alert });
};

// @desc   Mark alerts as read (bulk)
// @route  POST /api/alerts/mark-read
const markReadHandler = async (req, res) => {
  const { alertIds } = req.body;
  await markAsRead(alertIds);
  const newCount = await getUnreadCount();
  broadcast('ALERTS_READ', { unreadCount: newCount });
  res.status(200).json({ success: true, data: { unreadCount: newCount } });
};

// @desc   Bulk action (acknowledge/resolve/dismiss all)
// @route  POST /api/alerts/bulk
const bulkAction = async (req, res) => {
  const { action, alertIds, filters } = req.body;

  const query = alertIds?.length
    ? { _id: { $in: alertIds } }
    : filters || {};

  const update = {
    acknowledge: { status: 'acknowledged', acknowledgedAt: new Date(), read: true },
    resolve:     { status: 'resolved',     resolvedAt:     new Date(), read: true },
    dismiss:     { status: 'dismissed',    dismissedAt:    new Date(), read: true },
    read:        { read: true },
  }[action];

  if (!update) return res.status(400).json({ success: false, message: 'Invalid action' });

  const result = await Alert.updateMany(query, update);
  const newCount = await getUnreadCount();
  broadcast('ALERTS_BULK_UPDATED', { action, count: result.modifiedCount, unreadCount: newCount });

  res.status(200).json({
    success: true,
    data: { modifiedCount: result.modifiedCount, unreadCount: newCount },
  });
};

// @desc   Resend email for an alert
// @route  POST /api/alerts/:id/resend-email
const resendEmail = async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

  const recipients = req.body.to || alert.emailTo ||
    (process.env.ALERT_EMAIL_TO ? process.env.ALERT_EMAIL_TO.split(',') : []);

  if (!recipients.length) {
    return res.status(400).json({ success: false, message: 'No recipients specified' });
  }

  const result = await sendAlertEmail(alert, recipients);
  if (result.sent) {
    await Alert.findByIdAndUpdate(alert._id, { emailSent: true, emailSentAt: new Date() });
  }

  res.status(200).json({ success: true, data: result });
};

// @desc   Verify SMTP connection
// @route  GET /api/alerts/email/verify
const verifyEmail = async (req, res) => {
  const result = await verifyConnection();
  res.status(200).json({ success: true, data: result });
};

module.exports = {
  getAlerts, getUnreadCountHandler, getStatsHandler,
  getAlert, createManualAlert,
  acknowledge, resolve, dismiss,
  markReadHandler, bulkAction,
  resendEmail, verifyEmail,
};