const express = require('express');
const router  = express.Router();
const {
  getAlerts, getUnreadCountHandler, getStatsHandler,
  getAlert, createManualAlert,
  acknowledge, resolve, dismiss,
  markReadHandler, bulkAction,
  resendEmail, verifyEmail,
} = require('../controllers/alertController');

router.get('/unread-count',   getUnreadCountHandler);
router.get('/stats',          getStatsHandler);
router.get('/email/verify',   verifyEmail);
router.post('/mark-read',     markReadHandler);
router.post('/bulk',          bulkAction);

router.route('/').get(getAlerts).post(createManualAlert);

router.get('/:id',                  getAlert);
router.patch('/:id/acknowledge',    acknowledge);
router.patch('/:id/resolve',        resolve);
router.patch('/:id/dismiss',        dismiss);
router.post('/:id/resend-email',    resendEmail);

module.exports = router;