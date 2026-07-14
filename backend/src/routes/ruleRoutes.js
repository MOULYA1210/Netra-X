const express = require('express');
const router  = express.Router();
const {
  getAllRules, getRuleById, createRule, updateRule,
  toggleRule, deleteRule, testRule,
  getActionLogs, getLogStats,
} = require('../controllers/ruleController');

router.get('/logs/stats', getLogStats);
router.get('/logs',       getActionLogs);

router.route('/')
  .get(getAllRules)
  .post(createRule);

router.route('/:id')
  .get(getRuleById)
  .put(updateRule)
  .delete(deleteRule);

router.patch('/:id/toggle', toggleRule);
router.post('/:id/test',    testRule);

module.exports = router;