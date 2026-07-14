const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema(
  {
    // Which rule fired
    ruleId:   { type: String, required: true, index: true },
    ruleName: { type: String, required: true },

    // Which device triggered it
    deviceId:   { type: String, default: null, index: true },
    deviceName: { type: String, default: null },
    ipAddress:  { type: String, default: null },

    // What triggered it
    trigger: {
      metric:   String,
      operator: String,
      threshold: mongoose.Schema.Types.Mixed,
      actualValue: mongoose.Schema.Types.Mixed,
    },

    // What action ran
    action: {
      type: {
        type: String,
        enum: ['log', 'alert', 'webhook', 'retry', 'email', 'script'],
      },
      config:  mongoose.Schema.Types.Mixed,
      result:  String,    // success | failed | skipped
      message: String,
      error:   String,
    },

    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },

    firedAt:  { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

// TTL: auto-delete logs older than 30 days
ActionLogSchema.index({ firedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
ActionLogSchema.index({ ruleId: 1, firedAt: -1 });

module.exports = mongoose.model('ActionLog', ActionLogSchema);