const SEVERITY = {
  critical: { color: '#f87171', bg: '#450a0a', border: '#7f1d1d', icon: '🔴' },
  warning:  { color: '#fbbf24', bg: '#422006', border: '#78350f', icon: '🟡' },
  info:     { color: '#38bdf8', bg: '#0c1a2e', border: '#1e3a5f', icon: '🔵' },
};

const STATUS_COLORS = {
  active:       '#f87171',
  acknowledged: '#fbbf24',
  resolved:     '#4ade80',
  dismissed:    '#475569',
};

const AlertCard = ({ alert, onAck, onResolve, onDismiss, onResendEmail }) => {
  const sc  = SEVERITY[alert.severity] || SEVERITY.info;
  const dot = STATUS_COLORS[alert.status] || '#94a3b8';

  return (
    <div style={styles.card(sc.border, sc.bg, alert.read)}>
      {/* Unread indicator */}
      {!alert.read && <div style={styles.unreadBar(sc.color)} />}

      <div style={styles.body}>
        {/* Top row */}
        <div style={styles.top}>
          <div style={styles.topLeft}>
            <span style={styles.icon}>{sc.icon}</span>
            <div>
              <div style={styles.title}>{alert.title}</div>
              <div style={styles.message}>{alert.message}</div>
            </div>
          </div>
          <div style={styles.topRight}>
            <span style={styles.statusDot(dot)} />
            <span style={{ color: dot, fontSize: '11px', fontWeight: 700 }}>
              {alert.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div style={styles.meta}>
          {alert.deviceName && (
            <span style={styles.metaItem}>🖥 {alert.deviceName}</span>
          )}
          {alert.ipAddress && (
            <span style={styles.metaItem}>📡 {alert.ipAddress}</span>
          )}
          {alert.metric?.name && (
            <span style={styles.metaItem}>
              📊 {alert.metric.name}: <strong style={{ color: sc.color }}>{alert.metric.value}</strong>
            </span>
          )}
          <span style={styles.metaItem}>
            🕐 {new Date(alert.firedAt).toLocaleString()}
          </span>
          {alert.count > 1 && (
            <span style={styles.countBadge}>×{alert.count}</span>
          )}
          {alert.escalated && (
            <span style={styles.escalatedBadge}>⚡ L{alert.escalationLevel} Escalated</span>
          )}
        </div>

        {/* Actions */}
        {alert.status === 'active' && (
          <div style={styles.actions}>
            <button style={styles.btnAck}     onClick={() => onAck?.(alert._id)}>✓ Acknowledge</button>
            <button style={styles.btnResolve} onClick={() => onResolve?.(alert._id)}>✅ Resolve</button>
            <button style={styles.btnDismiss} onClick={() => onDismiss?.(alert._id)}>✕ Dismiss</button>
            <button style={styles.btnEmail}   onClick={() => onResendEmail?.(alert._id)}>📧 Email</button>
          </div>
        )}
        {alert.status === 'acknowledged' && (
          <div style={styles.actions}>
            <button style={styles.btnResolve} onClick={() => onResolve?.(alert._id)}>✅ Mark Resolved</button>
            <span style={styles.ackInfo}>Ack by {alert.acknowledgedBy} · {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleTimeString() : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  card: (border, bg, read) => ({
    background: bg, border: `1px solid ${border}`,
    borderRadius: '10px', overflow: 'hidden',
    opacity: read ? 0.85 : 1, position: 'relative',
    marginBottom: '10px', display: 'flex',
  }),
  unreadBar: (color) => ({ width: '3px', background: color, flexShrink: 0 }),
  body: { flex: 1, padding: '14px 16px' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  topLeft: { display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 },
  icon: { fontSize: '18px', marginTop: '1px' },
  title: { color: '#f1f5f9', fontWeight: 700, fontSize: '14px', marginBottom: '3px' },
  message: { color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 },
  topRight: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  statusDot: (color) => ({ width: '7px', height: '7px', borderRadius: '50%', background: color }),
  meta: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' },
  metaItem: { color: '#64748b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' },
  countBadge: { background: '#334155', color: '#94a3b8', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 },
  escalatedBadge: { background: '#422006', color: '#fbbf24', border: '1px solid #78350f', padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 },
  actions: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  btnAck:     { background: '#422006', border: '1px solid #78350f', color: '#fbbf24', borderRadius: '5px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 },
  btnResolve: { background: '#14532d', border: '1px solid #166534', color: '#4ade80', borderRadius: '5px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 },
  btnDismiss: { background: '#1e293b', border: '1px solid #334155', color: '#475569', borderRadius: '5px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer' },
  btnEmail:   { background: '#1e3a5f', border: '1px solid #1e40af', color: '#93c5fd', borderRadius: '5px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer' },
  ackInfo:    { color: '#475569', fontSize: '11px', marginLeft: '4px' },
};

export default AlertCard;