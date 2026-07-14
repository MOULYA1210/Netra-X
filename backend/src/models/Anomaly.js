const mongoose = require('mongoose');

const AnomalySchema = new mongoose.Schema(
  {
    deviceId:     { type: String, required: true, index: true },
    deviceName:   { type: String, default: 'Unknown' },
    ipAddress:    { type: String, required: true },

    anomalyScore: { type: Number, default: 0 },  // 0-100
    severity: {
      type: String,
      enum: ['normal', 'low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },

    isAnomaly:   { type: Boolean, default: false },
    modelUsed:   { type: String, default: 'rule_based_fallback' },

    // Human-readable explanations
    reasons:     [{ type: String }],

    // Feature snapshot at time of detection
    features: {
      mean_rtt:      Number,
      std_rtt:       Number,
      max_rtt:       Number,
      packet_loss:   Number,
      alive_ratio:   Number,
      spike_count:   Number,
      rtt_cv:        Number,
      recent_trend:  Number,
    },

    dataPoints:   { type: Number, default: 0 },
    analyzedAt:   { type: Date,   default: Date.now, index: true },

    // Acknowledgement — for Phase 8 alert system
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String, default: null },
    acknowledgedAt: { type: Date,   default: null },
  },
  { timestamps: true, versionKey: false }
);

// TTL: auto-delete anomalies older than 30 days
AnomalySchema.index(
  { analyzedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

AnomalySchema.index({ deviceId: 1, analyzedAt: -1 });

module.exports = mongoose.model('Anomaly', AnomalySchema);