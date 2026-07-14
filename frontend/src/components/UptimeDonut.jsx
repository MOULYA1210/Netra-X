import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = {
  online:   '#4ade80',
  offline:  '#f87171',
  degraded: '#fb923c',
  unknown:  '#475569',
};

const CustomLabel = ({ cx, cy, total }) => (
  <>
    <text x={cx} y={cy - 8}  textAnchor="middle" fill="#f1f5f9" fontSize={28} fontWeight={800}>{total}</text>
    <text x={cx} y={cy + 14} textAnchor="middle" fill="#475569" fontSize={11}>devices</text>
  </>
);

const UptimeDonut = ({ stats }) => {
  if (!stats || stats.total === 0) {
    return <div style={styles.empty}>No device data yet.</div>;
  }

  const data = [
    { name: 'Online',   value: stats.online   || 0, key: 'online'   },
    { name: 'Offline',  value: stats.offline  || 0, key: 'offline'  },
    { name: 'Degraded', value: stats.degraded || 0, key: 'degraded' },
    { name: 'Unknown',  value: stats.unknown  || 0, key: 'unknown'  },
  ].filter((d) => d.value > 0);

  const uptimePct = stats.total > 0
    ? ((stats.online / stats.total) * 100).toFixed(1)
    : 0;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>Fleet Health</span>
        <span style={styles.pct(parseFloat(uptimePct))}>
          {uptimePct}% online
        </span>
      </div>

      <div style={styles.row}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={<CustomLabel total={stats.total} />}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#94a3b8' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={styles.legend}>
          {[
            { key: 'online',   label: 'Online',   val: stats.online   },
            { key: 'offline',  label: 'Offline',  val: stats.offline  },
            { key: 'degraded', label: 'Degraded', val: stats.degraded },
            { key: 'unknown',  label: 'Unknown',  val: stats.unknown  },
          ].map(({ key, label, val }) => (
            <div key={key} style={styles.legendItem}>
              <span style={styles.dot(COLORS[key])} />
              <span style={styles.legendLabel}>{label}</span>
              <span style={styles.legendVal}>{val ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {},
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  title: { color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' },
  pct: (val) => ({
    color: val >= 90 ? '#4ade80' : val >= 70 ? '#fbbf24' : '#f87171',
    fontSize: '13px', fontWeight: 700,
  }),
  row: { display: 'flex', alignItems: 'center', gap: '16px' },
  legend: { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  dot: (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }),
  legendLabel: { color: '#64748b', fontSize: '12px', flex: 1 },
  legendVal: { color: '#f1f5f9', fontSize: '13px', fontWeight: 700 },
  empty: { color: '#475569', fontSize: '13px', padding: '20px', textAlign: 'center' },
};

export default UptimeDonut;