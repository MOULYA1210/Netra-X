const mongoose = require('mongoose');

const ForecastSchema = new mongoose.Schema(
  {
    deviceId:    { type: String, required: true, index: true },
    deviceName:  { type: String, default: 'Unknown' },
    ipAddress:   { type: String, required: true },
    metric:      { type: String, enum: ['rtt', 'packetLoss', 'health'], required: true },

    // Forecast metadata
    horizonMinutes:   { type: Number, default: 60 },
    trendDirection:   { type: String, enum: ['increasing', 'decreasing', 'stable'], default: 'stable' },
    trendPct:         { type: Number, default: 0 },
    currentValue:     { type: Number, default: null },
    forecastedValue:  { type: Number, default: null },

    // Health score fields
    healthScore:   { type: Number, default: null },
    grade:         { type: String, default: null },
    failureRisk:   { type: Number, default: null },
    riskLevel:     { type: String, default: null },

    // Chart data — stored for frontend rendering
    history:   [{ time: String, actual: Number, forecast: Number }],
    forecast:  [{ time: String, forecast: Number, upper: Number, lower: Number }],

    generatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, versionKey: false }
);

// TTL: auto-delete forecasts older than 7 days
ForecastSchema.index({ generatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
ForecastSchema.index({ deviceId: 1, metric: 1, generatedAt: -1 });

module.exports = mongoose.model('Forecast', ForecastSchema);