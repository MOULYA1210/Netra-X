const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    // ── Classification ────────────────────────────────────────────────────────
    title:   { type: String, required: true },
    message: { type: String, required: true },

    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },

    category: {
      type: String,
      enum: ['availability', 'performance', 'security', 'anomaly', 'rule', 'system'],
      default: 'rule',
    },

    // ── Source ────────────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ['rule', 'anomaly', 'ping', 'snmp', 'manual', 'system'],
      default: 'rule',
    },
    ruleId:   { type: String, default: null },
    ruleName: { type: String, default: null },

    // ── Device Context ────────────────────────────────────────────────────────
    deviceId:   { type: String, default: null, index: true },
    deviceName: { type: String, default: null },
    ipAddress:  { type: String, default: null },

    // ── Metric snapshot at time of alert ─────────────────────────────────────
    metric: {
      name:      String,
      value:     mongoose.Schema.Types.Mixed,
      threshold: mongoose.Schema.Types.Mixed,
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
      default: 'active',
      index: true,
    },

    // Read state — separate from acknowledge
    read: { type: Boolean, default: false, index: true },

    acknowledgedBy: { type: String, default: null },
    acknowledgedAt: { type: Date,   default: null },
    resolvedAt:     { type: Date,   default: null },
    dismissedAt:    { type: Date,   default: null },

    // ── Escalation ────────────────────────────────────────────────────────────
    escalated:        { type: Boolean, default: false },
    escalatedAt:      { type: Date,    default: null },
    escalationLevel:  { type: Number,  default: 0 },   // 0=none, 1=first, 2=second
    nextEscalationAt: { type: Date,    default: null },

    // ── Email Delivery ─────────────────────────────────────────────────────────
    emailSent:  { type: Boolean, default: false },
    emailSentAt:{ type: Date,    default: null },
    emailTo:    [{ type: String }],

    // ── Deduplication ─────────────────────────────────────────────────────────
    // Prevents creating duplicate alerts for the same ongoing condition
    fingerprint: { type: String, default: null, index: true },
    count:        { type: Number, default: 1 }, // How many times this condition fired

    firedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

// TTL: auto-delete resolved/dismissed alerts after 30 days
AlertSchema.index({ firedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
AlertSchema.index({ status: 1, severity: 1, firedAt: -1 });
AlertSchema.index({ fingerprint: 1 });

module.exports = mongoose.model('Alert', AlertSchema);