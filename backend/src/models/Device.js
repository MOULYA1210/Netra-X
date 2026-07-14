const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    // Core Identity
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      unique: true,
      match: [
        /^(\d{1,3}\.){3}\d{1,3}$/,
        'Please provide a valid IPv4 address',
      ],
    },
    macAddress: {
      type: String,
      default: null,
    },

    // Device Classification
    type: {
      type: String,
      enum: ['router', 'switch', 'server', 'firewall', 'access-point', 'unknown'],
      default: 'unknown',
    },
    vendor: {
      type: String,
      default: 'Unknown',
    },
    os: {
      type: String,
      default: null,
    },

    // Network Info
    subnet: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },

    // Status — updated by monitoring engine in Phase 3
    status: {
      type: String,
      enum: ['online', 'offline', 'degraded', 'unknown'],
      default: 'unknown',
    },
    lastSeen: {
      type: Date,
      default: null,
    },

    // Monitoring Config — used in Phase 3
    monitoringEnabled: {
      type: Boolean,
      default: true,
    },
    snmpEnabled: {
      type: Boolean,
      default: false,
    },
    snmpCommunity: {
      type: String,
      default: 'public',
    },

    // Tags for grouping/filtering
    tags: [{ type: String }],

    // Discovery metadata
    discoveredAt: {
      type: Date,
      default: Date.now,
    },
    discoveryMethod: {
      type: String,
      enum: ['manual', 'nmap', 'snmp', 'import'],
      default: 'manual',
    },
  },
  {
    timestamps: true, // Adds createdAt, updatedAt automatically
    versionKey: false,
  }
);

// Index for fast IP lookups (most common query in a NMS)
DeviceSchema.index({ ipAddress: 1 });
DeviceSchema.index({ status: 1 });
DeviceSchema.index({ type: 1 });

// Virtual: human-readable identifier
DeviceSchema.virtual('displayName').get(function () {
  return `${this.name} (${this.ipAddress})`;
});

module.exports = mongoose.model('Device', DeviceSchema);