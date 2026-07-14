const express = require('express');
const router = express.Router();
const {
  triggerScan,
  getScanStatus,
  getScanHistoryHandler,
  getScanResults,
  deleteScanJob,
} = require('../controllers/scanController');

router.post('/', triggerScan);                        // POST   /api/scan
router.get('/history', getScanHistoryHandler);         // GET    /api/scan/history
router.get('/status/:jobId', getScanStatus);           // GET    /api/scan/status/:jobId
router.get('/:jobId/results', getScanResults);         // GET    /api/scan/:jobId/results
router.delete('/:jobId', deleteScanJob);               // DELETE /api/scan/:jobId

module.exports = router;