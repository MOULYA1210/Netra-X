const mongoose = require('mongoose');

const RuleSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: 100,
    },
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true, index: true },

    // ── Scope — which devices does this rule apply to? ────────────────────────
    scope: {
      type: String,
      enum: ['all', 'device', 'type', 'tag'],
      default: 'all',
    },
    // Used when scope = 'device'
    deviceId: { type: String, default: null },
    deviceName: { type: String, default: null },
    // Used when scope = 'type' (router, switch, server...)
    deviceType: { type: String, default: null },

    // ── Condition — IF this is true → fire ───────────────────────────────────
    condition: {
      metric: {
        type: String,
        enum: [
          'status',           // online | offline | degraded
          'responseTime',     // ping RTT in ms
          'packetLoss',       // % 0-100
          'cpuUsage',         // % 0-100 (SNMP)
          'memoryUsage',      // % 0-100 (SNMP)
          'uptimePercent',    // % uptime over 24h
          'anomalyScore',     // 0-100 from AI service
          'healthScore',      // 0-100 from AI service
        ],
        required: true,
      },
      operator: {
        type: String,
        enum: ['gt', 'lt', 'gte', 'lte', 'eq', 'neq', 'contains'],
        required: true,
      },
      value: { type: mongoose.Schema.Types.Mixed, required: true },

      // Optional: how many consecutive violations before firing?
      // Prevents flapping on transient spikes
      consecutiveCount: { type: Number, default: 1, min: 1, max: 10 },
    },

    // ── Actions — THEN do these things ───────────────────────────────────────
    actions: [
      {
        type: {
          type: String,
          enum: ['log', 'alert', 'webhook', 'retry', 'email', 'script'],
          required: true,
        },
        // Config differs per action type:
        // log:     { message }
        // alert:   { severity, message }
        // webhook: { url, method, payload }
        // retry:   { maxRetries, delayMs }
        // email:   { to, subject }
        // script:  { command }
        config: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],

    // ── Throttle — don't fire more than once per N seconds ───────────────────
    throttleSeconds: { type: Number, default: 300 },  // 5 minutes default
    lastFiredAt: { type: Date, default: null },
    fireCount: { type: Number, default: 0 },

    // ── Violation tracking (for consecutiveCount) ─────────────────────────────
    violationCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    createdBy: { type: String, default: 'system' },
  },
  { timestamps: true, versionKey: false }
);

RuleSchema.index({ enabled: 1, 'condition.metric': 1 });

module.exports = mongoose.model('Rule', RuleSchema);