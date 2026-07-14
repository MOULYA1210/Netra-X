const Rule      = require('../models/Rule');
const ActionLog = require('../models/ActionLog');
const { evaluateRule } = require('../services/ruleEngine');
const logger    = require('../utils/logger');

// @desc   Get all rules
// @route  GET /api/rules
const getAllRules = async (req, res) => {
  const { enabled } = req.query;
  const filter = {};
  if (enabled !== undefined) filter.enabled = enabled === 'true';

  const rules = await Rule.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: rules.length, data: rules });
};

// @desc   Get single rule
// @route  GET /api/rules/:id
const getRuleById = async (req, res) => {
  const rule = await Rule.findById(req.params.id);
  if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
  res.status(200).json({ success: true, data: rule });
};

// @desc   Create rule
// @route  POST /api/rules
const createRule = async (req, res) => {
  const rule = await Rule.create(req.body);
  logger.info(`[Rule] Created: "${rule.name}"`);
  res.status(201).json({ success: true, data: rule });
};

// @desc   Update rule
// @route  PUT /api/rules/:id
const updateRule = async (req, res) => {
  const rule = await Rule.findByIdAndUpdate(
    req.params.id, req.body,
    { new: true, runValidators: true }
  );
  if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
  logger.info(`[Rule] Updated: "${rule.name}"`);
  res.status(200).json({ success: true, data: rule });
};

// @desc   Toggle rule enabled/disabled
// @route  PATCH /api/rules/:id/toggle
const toggleRule = async (req, res) => {
  const rule = await Rule.findById(req.params.id);
  if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
  rule.enabled = !rule.enabled;
  await rule.save();
  logger.info(`[Rule] "${rule.name}" ${rule.enabled ? 'enabled' : 'disabled'}`);
  res.status(200).json({ success: true, data: rule });
};

// @desc   Delete rule
// @route  DELETE /api/rules/:id
const deleteRule = async (req, res) => {
  const rule = await Rule.findByIdAndDelete(req.params.id);
  if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
  logger.info(`[Rule] Deleted: "${rule.name}"`);
  res.status(200).json({ success: true, message: 'Rule deleted' });
};

// @desc   Manually test/fire a rule right now
// @route  POST /api/rules/:id/test
const testRule = async (req, res) => {
  const rule = await Rule.findById(req.params.id);
  if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

  // Temporarily ignore throttle by clearing lastFiredAt
  const originalFiredAt = rule.lastFiredAt;
  rule.lastFiredAt = null;

  const fires = await evaluateRule(rule);

  // Restore throttle state
  await Rule.findByIdAndUpdate(rule._id, { lastFiredAt: originalFiredAt });

  res.status(200).json({
    success: true,
    message: fires.length > 0
      ? `Rule fired ${fires.length} time(s)`
      : 'Rule evaluated — no devices matched the condition currently',
    fires,
  });
};

// @desc   Get action logs
// @route  GET /api/rules/logs
const getActionLogs = async (req, res) => {
  const { limit = 50, ruleId, deviceId, severity } = req.query;
  const filter = {};
  if (ruleId)   filter.ruleId   = ruleId;
  if (deviceId) filter.deviceId = deviceId;
  if (severity) filter.severity = severity;

  const logs = await ActionLog.find(filter)
    .sort({ firedAt: -1 })
    .limit(parseInt(limit));

  res.status(200).json({ success: true, count: logs.length, data: logs });
};

// @desc   Get action log stats
// @route  GET /api/rules/logs/stats
const getLogStats = async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [bySeverity, byAction, total] = await Promise.all([
    ActionLog.aggregate([
      { $match: { firedAt: { $gte: since } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    ActionLog.aggregate([
      { $match: { firedAt: { $gte: since } } },
      { $group: { _id: '$action.type', count: { $sum: 1 } } },
    ]),
    ActionLog.countDocuments({ firedAt: { $gte: since } }),
  ]);

  const severity = { info: 0, warning: 0, critical: 0 };
  bySeverity.forEach(({ _id, count }) => { if (_id in severity) severity[_id] = count; });

  const actions = {};
  byAction.forEach(({ _id, count }) => { actions[_id] = count; });

  res.status(200).json({
    success: true,
    data: { total, severity, actions, windowHours: 24 },
  });
};

module.exports = {
  getAllRules, getRuleById, createRule, updateRule,
  toggleRule, deleteRule, testRule,
  getActionLogs, getLogStats,
};