const STATUS_CONFIG = {
  online:   { color: '#4ade80', bg: '#14532d', dot: '#4ade80', label: 'ONLINE'  },
  offline:  { color: '#f87171', bg: '#450a0a', dot: '#f87171', label: 'OFFLINE' },
  degraded: { color: '#fb923c', bg: '#431407', dot: '#fb923c', label: 'DEGRADED'},
  unknown:  { color: '#94a3b8', bg: '#1e293b', dot: '#475569', label: 'UNKNOWN' },
};

const DeviceStatusCard = ({ device, onClick }) => {
  const cfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.unknown;
  const rtt = device.responseTime;

  return (
    <div style={styles.card(device.status)} onClick={() => onClick?.(device)}>
      {/* Status dot — animated pulse when online */}
      <div style={styles.topRow}>
        <div style={styles.dotWrap}>
          <span style={styles.dot(cfg.dot)} />
          {device.status === 'online' && <span style={styles.pulse(cfg.dot)} />}
        </div>
        <span style={styles.badge(cfg.color, cfg.bg)}>{cfg.label}</span>
      </div>

      {/* Device Name & IP */}
      <div style={styles.name}>{device.name || 'Unknown Device'}</div>
      <div style={styles.ip}>{device.ipAddress}</div>

      {/* Metrics Row */}
      <div style={styles.metrics}>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>RTT</span>
          <span style={styles.metricValue(rtt)}>
            {rtt != null ? `${rtt}ms` : '—'}
          </span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Type</span>
          <span style={styles.metricValueNeutral}>{device.type || '—'}</span>
        </div>
      </div>

      {/* Last seen */}
      {device.timestamp && (
        <div style={styles.lastSeen}>
          {new Date(device.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

const styles = {
  card: (status) => ({
    background: '#1e293b',
    border: `1px solid ${status === 'online' ? '#166534' : status === 'offline' ? '#7f1d1d' : '#334155'}`,
    borderRadius: '10px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'transform 0.15s, border-color 0.15s',
    position: 'relative',
    overflow: 'hidden',
  }),
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  dotWrap: { position: 'relative', width: '12px', height: '12px' },
  dot: (color) => ({
    position: 'absolute', top: 0, left: 0,
    width: '10px', height: '10px',
    borderRadius: '50%', background: color,
    display: 'inline-block',
  }),
  pulse: (color) => ({
    position: 'absolute', top: '-3px', left: '-3px',
    width: '16px', height: '16px',
    borderRadius: '50%',
    border: `2px solid ${color}`,
    opacity: 0.5,
    animation: 'pulse 2s infinite',
    display: 'inline-block',
  }),
  badge: (color, bg) => ({
    background: bg, color, padding: '2px 8px',
    borderRadius: '10px', fontSize: '10px', fontWeight: 700,
  }),
  name: { color: '#f1f5f9', fontWeight: 600, fontSize: '14px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ip: { color: '#64748b', fontSize: '12px', fontFamily: 'monospace', marginBottom: '12px' },
  metrics: { display: 'flex', gap: '16px' },
  metric: { display: 'flex', flexDirection: 'column', gap: '2px' },
  metricLabel: { color: '#475569', fontSize: '10px', textTransform: 'uppercase' },
  metricValue: (rtt) => ({
    color: rtt == null ? '#475569' : rtt < 50 ? '#4ade80' : rtt < 150 ? '#fbbf24' : '#f87171',
    fontSize: '13px', fontWeight: 600,
  }),
  metricValueNeutral: { color: '#94a3b8', fontSize: '13px' },
  lastSeen: { color: '#334155', fontSize: '10px', marginTop: '8px' },
};

export default DeviceStatusCard;