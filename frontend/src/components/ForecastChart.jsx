import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipTime}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: '12px' }}>
          {p.name}: {p.value != null ? `${p.value} ms` : '—'}
        </div>
      ))}
    </div>
  );
};

const ForecastChart = ({ history = [], forecast = [], currentRtt, forecastedRtt, trend }) => {
  // Merge history + forecast for single continuous chart
  const historyPoints  = history.map((h) => ({ ...h, type: 'history' }));
  const forecastPoints = forecast.map((f) => ({ ...f, type: 'forecast' }));

  // Add confidence band only to forecast section
  const chartData = [
    ...historyPoints,
    ...forecastPoints,
  ];

  const trendColor =
    trend === 'increasing' ? '#f87171' :
    trend === 'decreasing' ? '#4ade80' : '#94a3b8';

  if (chartData.length === 0) {
    return <div style={styles.empty}>📈 No forecast data yet. Click "Run Forecast" above.</div>;
  }

  return (
    <div>
      {/* Trend Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Current Avg RTT</span>
          <span style={styles.summaryValue('#38bdf8')}>{currentRtt ?? '—'} ms</span>
        </div>
        <div style={styles.arrow}>→</div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Forecasted RTT</span>
          <span style={styles.summaryValue(trendColor)}>{forecastedRtt ?? '—'} ms</span>
        </div>
        <div style={styles.trendBadge(trendColor)}>
          {trend === 'increasing' ? '↑ Degrading' :
           trend === 'decreasing' ? '↓ Improving' : '→ Stable'}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#475569', fontSize: 9 }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit=" ms"
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />

          {/* Confidence band (forecast only) */}
          <Area
            dataKey="upper"
            stroke="none"
            fill="url(#forecastGrad)"
            name="Upper bound"
            legendType="none"
          />
          <Area
            dataKey="lower"
            stroke="none"
            fill="#0f172a"
            name="Lower bound"
            legendType="none"
          />

          {/* Historical actual RTT */}
          <Line
            dataKey="actual"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Actual RTT"
            connectNulls={false}
          />

          {/* Forecast line */}
          <Line
            dataKey="forecast"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="Forecasted RTT"
            connectNulls={false}
          />

          {/* Divider between history and forecast */}
          {history.length > 0 && (
            <ReferenceLine
              x={history[history.length - 1]?.time}
              stroke="#334155"
              strokeDasharray="4 4"
              label={{ value: 'Now', fill: '#475569', fontSize: 10 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const styles = {
  summary: {
    display: 'flex', alignItems: 'center', gap: '16px',
    marginBottom: '16px', flexWrap: 'wrap',
  },
  summaryItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  summaryLabel: { color: '#475569', fontSize: '10px', textTransform: 'uppercase' },
  summaryValue: (color) => ({ color, fontSize: '20px', fontWeight: 800 }),
  arrow: { color: '#334155', fontSize: '20px' },
  trendBadge: (color) => ({
    color, border: `1px solid ${color}44`,
    background: `${color}11`,
    padding: '4px 12px', borderRadius: '20px',
    fontSize: '12px', fontWeight: 700,
  }),
  tooltip: {
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', padding: '10px 14px',
  },
  tooltipTime: { color: '#94a3b8', fontSize: '11px', marginBottom: '6px' },
  empty: { color: '#475569', fontSize: '13px', textAlign: 'center', padding: '40px' },
};

export default ForecastChart;