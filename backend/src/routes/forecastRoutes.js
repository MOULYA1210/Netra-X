const express = require('express');
const router  = express.Router();
const {
  runForecasts,
  getDeviceForecastHandler,
  getLatestForecastHandler,
  runHealthScoresHandler,
  getHealthScoresHandler,
  getForecastHistory,
  getAnalyticsSummary,
} = require('../controllers/forecastController');

router.get('/summary',                    getAnalyticsSummary);
router.post('/run',                       runForecasts);
router.post('/health-scores',             runHealthScoresHandler);
router.get('/health-scores',              getHealthScoresHandler);
router.get('/device/:id',                 getDeviceForecastHandler);
router.get('/device/:id/latest',          getLatestForecastHandler);
router.get('/device/:id/history',         getForecastHistory);

module.exports = router;