const RISK_CONFIG = {
  critical: { color: '#f87171', bg: '#450a0a' },
  high:     { color: '#fb923c', bg: '#431407' },
  medium:   { color: '#fbbf24', bg: '#422006' },
  low:      { color: '#4ade80', bg: '#14532d' },
  minimal:  { color: '#94a3b8', bg: '#1e293b' },
};

const TREND_ICONS = {
  increasing: { icon: '↑', color: '#f87171' },
  decreasing: { icon: '↓', color: '#4ade80' },
  stable:     { icon: '→', color: '#94a3b8' },
};

const RiskTable = ({ scores = [], forecasts = [] }) => {
  // Merge health scores with forecast trends
  const forecastMap = {};
  forecasts.forEach((f) => { forecastMap[f.deviceId] = f; });

  const merged = scores.map((s) => ({
    ...s,
    forecast: forecastMap[s.deviceId] || null,
  }));

  if (merged.length === 0) {
    return (
      <div style={styles.empty}>
        Run Health Scoring and Forecasting to populate this table.
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Device', 'IP', 'Health Score', 'Grade', 'Risk Level', 'Avg RTT', 'RTT Trend', 'Packet Loss', 'Uptime'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {merged.map((row, i) => {
            const rc  = RISK_CONFIG[row.riskLevel] || RISK_CONFIG.minimal;
            const fc  = row.forecast;
            const trd = TREND_ICONS[fc?.trendDirection] || TREND_ICONS.stable;

            return (
              <tr key={row.deviceId || i} style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.devName}>{row.deviceName}</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.mono}>{row.ipAddress}</span>
                </td>
                <td style={styles.td}>
                  <div style={styles.scoreBar}>
                    <div style={styles.scoreBarFill(row.healthScore)} />
                    <span style={styles.scoreNum}>{row.healthScore?.toFixed(0) ?? '—'}</span>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{ color: RISK_CONFIG[row.riskLevel]?.color || '#94a3b8', fontWeight: 800, fontSize: '16px' }}>
                    {row.grade ?? '—'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.riskBadge(rc.color, rc.bg)}>
                    {row.riskLevel?.toUpperCase() ?? '—'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.metric}>{row.metrics?.mean_rtt ?? '—'} ms</span>
                </td>
                <td style={styles.td}>
                  <span style={{ color: trd.color, fontWeight: 700 }}>
                    {trd.icon} {fc?.trendPct != null ? `${Math.abs(fc.trendPct).toFixed(1)}%` : '—'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.metric}>{row.metrics?.avg_loss ?? '—'}%</span>
                </td>
                <td style={styles.td}>
                  <span style={{ color: row.metrics?.alive_ratio >= 99 ? '#4ade80' : row.metrics?.alive_ratio >= 90 ? '#fbbf24' : '#f87171' }}>
                    {row.metrics?.alive_ratio ?? '—'}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  wrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
  th: { color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '10px 14px', verticalAlign: 'middle' },
  devName: { color: '#f1f5f9', fontWeight: 600, fontSize: '13px' },
  mono: { color: '#64748b', fontFamily: 'monospace', fontSize: '12px' },
  scoreBar: { display: 'flex', alignItems: 'center', gap: '8px' },
  scoreBarFill: (score) => ({
    width: '60px', height: '5px', borderRadius: '3px', background: '#0f172a',
    position: 'relative', overflow: 'hidden',
    '::after': { content: '', position: 'absolute', top: 0, left: 0, height: '100%', width: `${score}%`, background: score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171' },
  }),
  scoreNum: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 },
  riskBadge: (color, bg) => ({ background: bg, color, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }),
  metric: { color: '#94a3b8', fontSize: '13px' },
  empty: { color: '#475569', fontSize: '13px', textAlign: 'center', padding: '40px' },
};

export default RiskTable;