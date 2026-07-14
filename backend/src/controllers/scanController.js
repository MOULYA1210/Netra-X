const { v4: uuidv4 } = require('uuid');
const { startScan, getJobStatus, getScanHistory } = require('../services/networkScanner');
const ScanJob = require('../models/ScanJob');
const { isValidScanTarget, estimateHostCount } = require('../utils/ipUtils');
const logger = require('../utils/logger');

// @desc    Start a new network scan
// @route   POST /api/scan
const triggerScan = async (req, res) => {
  const { target, scanType = 'standard' } = req.body;

  // Validate input
  if (!target) {
    return res.status(400).json({
      success: false,
      message: 'Scan target is required (e.g. 192.168.1.0/24)',
    });
  }

  if (!isValidScanTarget(target)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid target. Use IP (192.168.1.1), CIDR (192.168.1.0/24), or range (192.168.1.1-50)',
    });
  }

  const validTypes = ['quick', 'standard', 'deep'];
  if (!validTypes.includes(scanType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid scan type. Choose: ${validTypes.join(', ')}`,
    });
  }

  // Warn if range is very large
  const estimate = estimateHostCount(target);
  if (estimate > 1000) {
    logger.warn(`[ScanController] Large scan requested: ${target} (~${estimate} hosts)`);
  }

  // Start scan (non-blocking — returns jobId immediately)
  const jobId = await startScan(target, scanType, 'api');

  res.status(202).json({
    success: true,
    message: 'Scan started',
    jobId,
    target,
    scanType,
    estimatedHosts: estimate,
    statusUrl: `/api/scan/status/${jobId}`,
  });
};

// @desc    Get scan job status
// @route   GET /api/scan/status/:jobId
const getScanStatus = async (req, res) => {
  const job = await getJobStatus(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: `Scan job not found: ${req.params.jobId}`,
    });
  }

  res.status(200).json({ success: true, data: job });
};

// @desc    Get scan history
// @route   GET /api/scan/history
const getScanHistoryHandler = async (req, res) => {
  const { limit = 10 } = req.query;
  const history = await getScanHistory(parseInt(limit));

  res.status(200).json({
    success: true,
    count: history.length,
    data: history,
  });
};

// @desc    Get full results of a completed scan
// @route   GET /api/scan/:jobId/results
const getScanResults = async (req, res) => {
  const job = await ScanJob.findOne({ jobId: req.params.jobId });

  if (!job) {
    return res.status(404).json({ success: false, message: 'Scan job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: `Scan is not complete yet. Current status: ${job.status}`,
      data: { status: job.status },
    });
  }

  res.status(200).json({ success: true, data: job });
};

// @desc    Delete a scan job record
// @route   DELETE /api/scan/:jobId
const deleteScanJob = async (req, res) => {
  const job = await ScanJob.findOneAndDelete({ jobId: req.params.jobId });

  if (!job) {
    return res.status(404).json({ success: false, message: 'Scan job not found' });
  }

  res.status(200).json({ success: true, message: 'Scan job deleted' });
};

module.exports = {
  triggerScan,
  getScanStatus,
  getScanHistoryHandler,
  getScanResults,
  deleteScanJob,
};