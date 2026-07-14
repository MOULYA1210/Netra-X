const SEVERITY_COLORS = {
  critical: '#f87171', warning: '#fbbf24', info: '#38bdf8',
};

const RESULT_COLORS = {
  success: '#4ade80', failed: '#f87171', skipped: '#94a3b8',
};

const ACTION_ICONS = {
  log: '📝', alert: '🔔', webhook: '🌐',
  retry: '🔄', email: '📧', script: '⚡',
};

const ActionLogTable = ({ logs = [] }) => {
  if (!logs.length) {
    return <div style={styles.empty}>No automation events yet. Rules will log here when they fire.</div>;
  }

  return (
    <div style={styles.wrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Time', 'Rule', 'Device', 'Trigger', 'Action', 'Result', 'Severity'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={log._id || i} style={styles.tr}>
              <td style={styles.td}>
                <span style={styles.time}>{new Date(log.firedAt).toLocaleString()}</span>
              </td>
              <td style={styles.td}>
                <span style={styles.ruleName}>{log.ruleName}</span>
              </td>
              <td style={styles.td}>
                <div style={styles.device}>{log.deviceName || '—'}</div>
                <div style={styles.ip}>{log.ipAddress || ''}</div>
              </td>
              <td style={styles.td}>
                <span style={styles.trigger}>
                  {log.trigger?.metric} {log.trigger?.operator} {log.trigger?.threshold}
                  <br />
                  <span style={{ color: '#fbbf24' }}>actual: {log.trigger?.actualValue}</span>
                </span>
              </td>
              <td style={styles.td}>
                <span style={styles.actionType}>
                  {ACTION_ICONS[log.action?.type]} {log.action?.type}
                </span>
              </td>
              <td style={styles.td}>
                <span style={{ color: RESULT_COLORS[log.action?.result] || '#94a3b8', fontWeight: 700, fontSize: '11px' }}>
                  {log.action?.result?.toUpperCase() || '—'}
                </span>
                {log.action?.message && (
                  <div style={styles.actionMsg}>{log.action.message.slice(0, 60)}</div>
                )}
              </td>
              <td style={styles.td}>
                <span style={{ color: SEVERITY_COLORS[log.severity] || '#94a3b8', fontWeight: 700, fontSize: '11px' }}>
                  {log.severity?.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
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
  td: { padding: '10px 14px', verticalAlign: 'top' },
  time: { color: '#475569', fontSize: '11px', whiteSpace: 'nowrap' },
  ruleName: { color: '#93c5fd', fontSize: '12px', fontWeight: 600 },
  device: { color: '#f1f5f9', fontSize: '12px', fontWeight: 600 },
  ip: { color: '#475569', fontSize: '11px', fontFamily: 'monospace' },
  trigger: { color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' },
  actionType: { color: '#f1f5f9', fontSize: '12px' },
  actionMsg: { color: '#475569', fontSize: '10px', marginTop: '2px' },
  empty: { color: '#475569', fontSize: '13px', textAlign: 'center', padding: '40px' },
};

export default ActionLogTable;