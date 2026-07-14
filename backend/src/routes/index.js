const express         = require('express');
const router          = express.Router();
const deviceRoutes    = require('./deviceRoutes');
const scanRoutes      = require('./scanRoutes');
const metricsRoutes   = require('./metricsRoutes');
const anomalyRoutes   = require('./anomalyRoutes');
const forecastRoutes  = require('./forecastRoutes');
const ruleRoutes      = require('./ruleRoutes');   
const alertRoutes  = require('./alertRoutes');    // ← ADD

router.get('/health', (req, res) =>
  res.status(200).json({ success: true, message: 'NetraX API is running', timestamp: new Date().toISOString() })
);

router.use('/devices',  deviceRoutes);
router.use('/scan',     scanRoutes);
router.use('/metrics',  metricsRoutes);
router.use('/anomaly',  anomalyRoutes);
router.use('/forecast', forecastRoutes);
router.use('/rules',    ruleRoutes);                  
router.use('/alerts',   alertRoutes);
module.exports = router;