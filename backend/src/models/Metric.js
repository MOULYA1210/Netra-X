const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema(
  {
    // Which device this metric belongs to
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },

    // Metric type — extensible for Phase 5 AI
    type: {
      type: String,
      enum: ['ping', 'snmp', 'bandwidth', 'cpu', 'memory', 'custom'],
      required: true,
      index: true,
    },
    responseTime: Number,
    packetLoss: Number,
    // Ping metrics
    ping: {
      alive: Boolean,
      responseTime: Number,   // ms
      packetLoss: Number,     // percentage 0-100
      ttl: Number,
    },

    // SNMP metrics
    snmp: {
      cpuUsage: Number,           // percentage 0-100
      memoryUsed: Number,         // bytes
      memoryTotal: Number,        // bytes
      memoryUsagePercent: Number, // percentage
      uptime: Number,             // seconds
      // Interface traffic (array because devices have multiple interfaces)
      interfaces: [
        {
          index: Number,
          name: String,
          inOctets: Number,    // bytes received
          outOctets: Number,   // bytes sent
          speed: Number,       // bits/sec
          status: String,      // up/down
        },
      ],
    },

    // Timestamp — indexed for time-range queries
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  
  {
    versionKey: false,
    // Compound index for the most common query pattern:
    // "Give me all ping metrics for device X in the last hour"
  }
);


// Compound indexes for fast time-series queries
MetricSchema.index({ deviceId: 1, type: 1, timestamp: -1 });
MetricSchema.index({ ipAddress: 1, type: 1, timestamp: -1 });

// TTL index — MongoDB auto-deletes metrics older than 7 days
// This prevents the metrics collection from growing forever
MetricSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 } // 7 days
);

module.exports = mongoose.model('Metric', MetricSchema);