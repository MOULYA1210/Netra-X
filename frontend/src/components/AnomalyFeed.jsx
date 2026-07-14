const SEVERITY_CONFIG = {
  critical: { color: '#f87171', bg: '#450a0a', border: '#7f1d1d', icon: '🔴' },
  high:     { color: '#fb923c', bg: '#431407', border: '#7c2d12', icon: '🟠' },
  medium:   { color: '#fbbf24', bg: '#422006', border: '#78350f', icon: '🟡' },
  low:      { color: '#94a3b8', bg: '#1e293b', border: '#334155', icon: '🔵' },
  normal:   { color: '#4ade80', bg: '#14532d', border: '#166534', icon: '🟢' },
};

const AnomalyFeed = ({ anomalies = [], onAcknowledge, loading = false }) => {
  if (loading) {
    return <div style={styles.empty}>⏳ Running analysis...</div>;
  }

  if (anomalies.length === 0) {
    return (
      <div style={styles.allClear}>
        <div style={styles.allClearIcon}>✅</div>
        <div style={styles.allClearText}>All systems normal</div>
        <div style={styles.allClearSub}>No anomalies detected</div>
      </div>
    );
  }

  return (
    <div style={styles.feed}>
      {anomalies.map((anomaly, i) => {
        const cfg = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.low;
        return (
          <div key={anomaly._id || i} style={styles.item(cfg.border, cfg.bg)}>
            {/* Header */}
            <div style={styles.itemHeader}>
              <div style={styles.itemLeft}>
                <span style={styles.icon}>{cfg.icon}</span>
                <div>
                  <div style={styles.deviceName}>{anomaly.deviceName}</div>
                  <div style={styles.ip}>{anomaly.ipAddress}</div>
                </div>
              </div>
              <div style={styles.itemRight}>
                <div style={styles.scoreBadge(cfg.color)}>
                  {anomaly.anomalyScore?.toFixed(0)}
                  <span style={styles.scoreLabel}>/100</span>
                </div>
                <span style={styles.severityTag(cfg.color, cfg.bg)}>
                  {anomaly.severity?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Reasons */}
            {anomaly.reasons?.length > 0 && (
              <div style={styles.reasons}>
                {anomaly.reasons.map((r, j) => (
                  <div key={j} style={styles.reason}>
                    <span style={{ color: cfg.color }}>›</span> {r}
                  </div>
                ))}
              </div>
            )}

            {/* Features snapshot */}
            {anomaly.features && (
              <div style={styles.featureRow}>
                {[
                  { k: 'mean_rtt',     label: 'Avg RTT',   unit: 'ms',  val: anomaly.features.mean_rtt?.toFixed(1) },
                  { k: 'packet_loss',  label: 'Pkt Loss',  unit: '%',   val: anomaly.features.packet_loss?.toFixed(1) },
                  { k: 'spike_count',  label: 'Spikes',    unit: 'x',   val: anomaly.features.spike_count },
                  { k: 'alive_ratio',  label: 'Uptime',    unit: '%',   val: ((anomaly.features.alive_ratio || 0) * 100).toFixed(0) },
                ].map(({ label, unit, val }) => (
                  val != null && (
                    <div key={label} style={styles.feature}>
                      <span style={styles.featureLabel}>{label}</span>
                      <span style={styles.featureVal}>{val}{unit}</span>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={styles.itemFooter}>
              <span style={styles.time}>
                {anomaly.analyzedAt
                  ? new Date(anomaly.analyzedAt).toLocaleString()
                  : ''}
              </span>
              {!anomaly.acknowledged && onAcknowledge && (
                <button
                  style={styles.ackBtn}
                  onClick={() => onAcknowledge(anomaly._id)}
                >
                  Acknowledge
                </button>
              )}
              {anomaly.acknowledged && (
                <span style={styles.acked}>✓ Acknowledged</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  feed: { display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: { color: '#475569', fontSize: '13px', textAlign: 'center', padding: '24px' },
  allClear: { textAlign: 'center', padding: '28px 0' },
  allClearIcon: { fontSize: '32px', marginBottom: '8px' },
  allClearText: { color: '#4ade80', fontSize: '15px', fontWeight: 700 },
  allClearSub: { color: '#475569', fontSize: '12px', marginTop: '4px' },
  item: (border, bg) => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: '8px', padding: '12px',
  }),
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  itemLeft: { display: 'flex', gap: '10px', alignItems: 'center' },
  icon: { fontSize: '18px' },
  deviceName: { color: '#f1f5f9', fontWeight: 600, fontSize: '13px' },
  ip: { color: '#475569', fontSize: '11px', fontFamily: 'monospace' },
  itemRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
  scoreBadge: (color) => ({ color, fontSize: '20px', fontWeight: 800, lineHeight: 1 }),
  scoreLabel: { fontSize: '11px', fontWeight: 400, opacity: 0.6 },
  severityTag: (color, bg) => ({
    color, background: bg,
    border: `1px solid ${color}33`,
    fontSize: '9px', fontWeight: 700,
    padding: '2px 6px', borderRadius: '8px',
    letterSpacing: '0.5px',
  }),
  reasons: { marginBottom: '8px' },
  reason: { color: '#94a3b8', fontSize: '11px', marginBottom: '3px', display: 'flex', gap: '6px' },
  featureRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' },
  feature: { display: 'flex', flexDirection: 'column' },
  featureLabel: { color: '#475569', fontSize: '9px', textTransform: 'uppercase' },
  featureVal: { color: '#94a3b8', fontSize: '12px', fontWeight: 600 },
  itemFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #33415533', paddingTop: '8px', marginTop: '4px' },
  time: { color: '#334155', fontSize: '10px' },
  ackBtn: { background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' },
  acked: { color: '#4ade80', fontSize: '11px' },
};

export default AnomalyFeed;