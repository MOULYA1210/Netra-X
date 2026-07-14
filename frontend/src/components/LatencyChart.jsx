import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { format } from 'date-fns';

// Custom tooltip — shows RTT + timestamp
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle}>
      <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: '12px' }}>
          {p.name}: {p.value != null ? `${p.value} ms` : 'DOWN'}
        </div>
      ))}
    </div>
  );
};

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px 14px',
};

// Color palette for multiple devices
const COLORS = ['#38bdf8', '#4ade80', '#fb923c', '#a78bfa', '#f472b6', '#fbbf24'];

const LatencyChart = ({ data, devices, title = 'Latency Trend' }) => {
  if (!data || data.length === 0) {
    return (
      <div style={styles.empty}>
        📈 Latency data will appear here after the first ping sweep.
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        <span style={styles.badge}>LIVE</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            unit=" ms"
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
          />
          {/* Warning threshold line */}
          <ReferenceLine y={150} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Warn', fill: '#fbbf24', fontSize: 10 }} />
          <ReferenceLine y={300} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'Crit', fill: '#f87171', fontSize: 10 }} />

          {(devices || ['responseTime']).map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const styles = {
  wrapper: {},
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  title: { color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' },
  badge: { background: '#14532d', color: '#4ade80', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' },
  empty: { color: '#475569', fontSize: '13px', padding: '40px', textAlign: 'center' },
};

export default LatencyChart;