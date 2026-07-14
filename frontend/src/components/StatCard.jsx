const StatCard = ({ label, value, sub, color, icon, trend }) => {
  return (
    <div style={styles.card}>
      <div style={styles.top}>
        <span style={styles.icon}>{icon}</span>
        {trend !== undefined && (
          <span style={styles.trend(trend > 0)}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ ...styles.value, color }}>{value ?? '—'}</div>
      <div style={styles.label}>{label}</div>
      {sub && <div style={styles.sub}>{sub}</div>}
    </div>
  );
};

const styles = {
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  icon: { fontSize: '22px' },
  trend: (up) => ({
    fontSize: '11px',
    color: up ? '#4ade80' : '#f87171',
    background: up ? '#14532d33' : '#450a0a33',
    padding: '2px 7px',
    borderRadius: '10px',
    fontWeight: 700,
  }),
  value: { fontSize: '36px', fontWeight: 800, lineHeight: 1 },
  label: { color: '#94a3b8', fontSize: '13px', fontWeight: 500, marginTop: '4px' },
  sub: { color: '#475569', fontSize: '11px' },
};

export default StatCard;