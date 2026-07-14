const express = require('express');
const router = express.Router();
const {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceStats,
} = require('../controllers/deviceController');

// Stats route MUST come before /:id to avoid "stats" being treated as an ID
router.get('/stats', getDeviceStats);

router.route('/')
  .get(getAllDevices)
  .post(createDevice);

router.route('/:id')
  .get(getDeviceById)
  .put(updateDevice)
  .delete(deleteDevice);

module.exports = router;