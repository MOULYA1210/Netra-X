const express = require('express');
const router  = express.Router();
const {
  getAIStatus,
  trainModel,
  detectAnomalies,
  analyzeOne,
  getRecent,
  getDeviceHistory,
  acknowledgeAnomaly,
  getAnomalyStats,
} = require('../controllers/anomalyController');

router.get('/status',                  getAIStatus);
router.get('/stats',                   getAnomalyStats);
router.get('/recent',                  getRecent);
router.post('/train',                  trainModel);
router.post('/detect',                 detectAnomalies);
router.post('/device/:id',             analyzeOne);
router.get('/device/:id/history',      getDeviceHistory);
router.patch('/:id/acknowledge',       acknowledgeAnomaly);

module.exports = router;