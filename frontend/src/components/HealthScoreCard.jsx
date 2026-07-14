const GRADE_COLORS = {
  A: '#4ade80', B: '#86efac', C: '#fbbf24',
  D: '#fb923c', F: '#f87171', 'N/A': '#475569',
};

const RISK_COLORS = {
  minimal:  '#4ade80', low: '#86efac', medium: '#fbbf24',
  high:     '#fb923c', critical: '#f87171',
};

const HealthScoreCard = ({ score }) => {
  if (!score) return null;

  const gradeColor = GRADE_COLORS[score.grade] || '#475569';
  const riskColor  = RISK_COLORS[score.riskLevel] || '#94a3b8';
  const healthPct  = score.healthScore ?? 0;

  // Arc SVG for health gauge
  const radius   = 36;
  const circ     = 2 * Math.PI * radius;
  const dashOffset = circ - (healthPct / 100) * circ;

  return (
    <div style={styles.card}>
      {/* Device info */}
      <div style={styles.header}>
        <div>
          <div style={styles.name}>{score.deviceName}</div>
          <div style={styles.ip}>{score.ipAddress}</div>
        </div>
        <div style={styles.gradeCircle(gradeColor)}>{score.grade}</div>
      </div>

      {/* Gauge */}
      <div style={styles.gaugeRow}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="45" cy="45" r={radius}
            fill="none"
            stroke={gradeColor}
            strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 45 45)"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
          <text x="45" y="49" textAnchor="middle" fill="#f1f5f9" fontSize="16" fontWeight="800">
            {healthPct}
          </text>
        </svg>

        {/* Components */}
        <div style={styles.components}>
          {score.components && Object.entries({
            'Availability': score.components.availability,
            'Latency':      score.components.latency,
            'Pkt Loss':     score.components.packetLoss,
            'Stability':    score.components.stability,
            'Trend':        score.components.trend,
          }).map(([label, val]) => {
            const max  = label === 'Availability' ? 35 : label === 'Latency' ? 25 : label === 'Pkt Loss' ? 20 : label === 'Stability' ? 15 : 5;
            const pct  = ((val || 0) / max) * 100;
            const col  = pct > 70 ? '#4ade80' : pct > 40 ? '#fbbf24' : '#f87171';
            return (
              <div key={label} style={styles.component}>
                <span style={styles.compLabel}>{label}</span>
                <div style={styles.compBar}>
                  <div style={styles.compFill(pct, col)} />
                </div>
                <span style={styles.compVal}>{val?.toFixed(0)}/{max}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk */}
      <div style={styles.riskRow}>
        <span style={styles.riskLabel}>Failure Risk</span>
        <span style={{ color: riskColor, fontWeight: 700, fontSize: '13px' }}>
          {score.failureRisk?.toFixed(0)}% — {score.riskLevel?.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

const styles = {
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  name: { color: '#f1f5f9', fontWeight: 600, fontSize: '14px' },
  ip: { color: '#475569', fontSize: '11px', fontFamily: 'monospace' },
  gradeCircle: (color) => ({
    width: '36px', height: '36px', borderRadius: '50%',
    border: `2px solid ${color}`, color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', fontWeight: 800,
  }),
  gaugeRow: { display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' },
  components: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  component: { display: 'flex', alignItems: 'center', gap: '6px' },
  compLabel: { color: '#475569', fontSize: '10px', width: '72px', flexShrink: 0 },
  compBar: { flex: 1, height: '4px', background: '#0f172a', borderRadius: '2px', overflow: 'hidden' },
  compFill: (pct, color) => ({ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.6s' }),
  compVal: { color: '#475569', fontSize: '10px', width: '36px', textAlign: 'right', flexShrink: 0 },
  riskRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '10px' },
  riskLabel: { color: '#475569', fontSize: '11px' },
};

export default HealthScoreCard;