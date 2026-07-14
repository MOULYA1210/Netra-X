const mongoose = require('mongoose');

const ScanJobSchema = new mongoose.Schema(
  {
    // Unique job identifier
    jobId: {
      type: String,
      required: true,
      unique: true,
    },

    // What was scanned
    target: {
      type: String,
      required: [true, 'Scan target is required'],
      trim: true,
    },

    // Scan configuration
    scanType: {
      type: String,
      enum: ['quick', 'standard', 'deep'],
      default: 'standard',
    },

    // Lifecycle
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
    },

    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Duration in seconds
    duration: { type: Number, default: null },

    // Results summary
    hostsScanned: { type: Number, default: 0 },
    hostsFound: { type: Number, default: 0 },
    newDevices: { type: Number, default: 0 },
    updatedDevices: { type: Number, default: 0 },

    // Discovered hosts (raw Nmap output processed)
    results: [
      {
        ipAddress: String,
        hostname: String,
        status: String,       // up / down
        mac: String,
        vendor: String,
        os: String,
        openPorts: [
          {
            port: Number,
            protocol: String,
            service: String,
            state: String,
          },
        ],
        responseTime: Number, // ms
      },
    ],

    // Error info if scan failed
    errorMessage: { type: String, default: null },

    // Who triggered it (for Phase 10 auth)
    triggeredBy: { type: String, default: 'system' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for fast job lookup
ScanJobSchema.index({ jobId: 1 });
ScanJobSchema.index({ status: 1 });
ScanJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ScanJob', ScanJobSchema);