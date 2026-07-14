const METRIC_LABELS = {
  status: 'Device Status', responseTime: 'Ping RTT (ms)',
  packetLoss: 'Packet Loss (%)', cpuUsage: 'CPU Usage (%)',
  memoryUsage: 'Memory Usage (%)', uptimePercent: 'Uptime (%)',
  anomalyScore: 'Anomaly Score', healthScore: 'Health Score',
};

const OPERATOR_LABELS = {
  gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=', neq: '≠', contains: 'contains',
};

const ACTION_ICONS = {
  log: '📝', alert: '🔔', webhook: '🌐',
  retry: '🔄', email: '📧', script: '⚡',
};

const RuleCard = ({ rule, onToggle, onDelete, onTest, onEdit }) => {
  const isEnabled = rule.enabled;

  return (
    <div style={styles.card(isEnabled)}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.enableDot(isEnabled)} />
          <div>
            <div style={styles.name}>{rule.name}</div>
            {rule.description && <div style={styles.desc}>{rule.description}</div>}
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.scopeBadge}>{rule.scope}</span>
          <span style={styles.fireCount}>⚡ {rule.fireCount || 0}</span>
        </div>
      </div>

      {/* Condition */}
      <div style={styles.condition}>
        <span style={styles.condLabel}>IF</span>
        <span style={styles.condMetric}>{METRIC_LABELS[rule.condition?.metric] || rule.condition?.metric}</span>
        <span style={styles.condOp}>{OPERATOR_LABELS[rule.condition?.operator]}</span>
        <span style={styles.condValue}>{String(rule.condition?.value)}</span>
        {(rule.condition?.consecutiveCount || 1) > 1 && (
          <span style={styles.consec}>× {rule.condition.consecutiveCount} times</span>
        )}
      </div>

      {/* Actions */}
      <div style={styles.actionsRow}>
        <span style={styles.thenLabel}>THEN</span>
        <div style={styles.actionBadges}>
          {(rule.actions || []).map((a, i) => (
            <span key={i} style={styles.actionBadge}>
              {ACTION_ICONS[a.type]} {a.type}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerMeta}>
          <span style={styles.meta}>Throttle: {rule.throttleSeconds}s</span>
          {rule.lastFiredAt && (
            <span style={styles.meta}>
              Last fired: {new Date(rule.lastFiredAt).toLocaleString()}
            </span>
          )}
        </div>
        <div style={styles.footerActions}>
          <button style={styles.btnTest}    onClick={() => onTest?.(rule)}>Test</button>
          <button style={styles.btnEdit}    onClick={() => onEdit?.(rule)}>Edit</button>
          <button
            style={styles.btnToggle(isEnabled)}
            onClick={() => onToggle?.(rule._id)}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
          <button style={styles.btnDelete} onClick={() => onDelete?.(rule._id)}>✕</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: (enabled) => ({
    background: '#1e293b',
    border: `1px solid ${enabled ? '#334155' : '#1e293b'}`,
    borderLeft: `3px solid ${enabled ? '#3b82f6' : '#334155'}`,
    borderRadius: '10px', padding: '16px',
    opacity: enabled ? 1 : 0.6,
    transition: 'opacity 0.2s',
  }),
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  enableDot: (on) => ({ width: '8px', height: '8px', borderRadius: '50%', background: on ? '#4ade80' : '#475569', marginTop: '5px', flexShrink: 0 }),
  name: { color: '#f1f5f9', fontWeight: 600, fontSize: '14px' },
  desc: { color: '#475569', fontSize: '12px', marginTop: '2px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  scopeBadge: { background: '#0f172a', border: '1px solid #334155', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' },
  fireCount: { color: '#fbbf24', fontSize: '12px', fontWeight: 700 },
  condition: { display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', flexWrap: 'wrap' },
  condLabel: { color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' },
  condMetric: { color: '#38bdf8', fontSize: '13px', fontWeight: 600 },
  condOp: { color: '#94a3b8', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' },
  condValue: { color: '#fbbf24', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' },
  consec: { color: '#475569', fontSize: '11px', marginLeft: '4px' },
  actionsRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  thenLabel: { color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 },
  actionBadges: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  actionBadge: { background: '#1e3a5f', border: '1px solid #1e40af', color: '#93c5fd', padding: '2px 10px', borderRadius: '12px', fontSize: '11px' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '10px' },
  footerMeta: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  meta: { color: '#334155', fontSize: '11px' },
  footerActions: { display: 'flex', gap: '6px' },
  btnTest:   { background: '#422006', border: '1px solid #78350f', color: '#fb923c', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' },
  btnEdit:   { background: '#1e3a5f', border: '1px solid #1e40af', color: '#93c5fd', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' },
  btnToggle: (on) => ({ background: on ? '#422006' : '#14532d', border: `1px solid ${on ? '#78350f' : '#166534'}`, color: on ? '#fb923c' : '#4ade80', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }),
  btnDelete: { background: '#450a0a', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '5px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' },
};

export default RuleCard;