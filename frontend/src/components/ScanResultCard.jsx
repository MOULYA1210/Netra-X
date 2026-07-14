const STATUS_COLORS = {
  up: '#4ade80',
  down: '#f87171',
  unknown: '#94a3b8',
};

const ScanResultCard = ({ host }) => {
  return (
    <div style={styles.card}>
      {/* Header Row */}
      <div style={styles.header}>
        <div style={styles.ipRow}>
          <span style={{ color: STATUS_COLORS[host.status] || '#94a3b8', fontSize: '10px' }}>●</span>
          <span style={styles.ip}>{host.ipAddress}</span>
          {host.hostname && <span style={styles.hostname}>{host.hostname}</span>}
        </div>
        <span style={styles.statusBadge(host.status)}>{host.status?.toUpperCase()}</span>
      </div>

      {/* Details Grid */}
      <div style={styles.grid}>
        {host.vendor && host.vendor !== 'Unknown' && (
          <div style={styles.detail}>
            <span style={styles.label}>Vendor</span>
            <span style={styles.value}>{host.vendor}</span>
          </div>
        )}
        {host.mac && (
          <div style={styles.detail}>
            <span style={styles.label}>MAC</span>
            <span style={styles.value}>{host.mac}</span>
          </div>
        )}
        {host.os && (
          <div style={styles.detail}>
            <span style={styles.label}>OS</span>
            <span style={styles.value}>{host.os}</span>
          </div>
        )}
        {host.responseTime && (
          <div style={styles.detail}>
            <span style={styles.label}>Latency</span>
            <span style={styles.value}>{host.responseTime} ms</span>
          </div>
        )}
      </div>

      {/* Open Ports */}
      {host.openPorts && host.openPorts.length > 0 && (
        <div style={styles.portsSection}>
          <span style={styles.label}>Open Ports</span>
          <div style={styles.ports}>
            {host.openPorts.slice(0, 8).map((p) => (
              <span key={p.port} style={styles.portBadge} title={p.service}>
                {p.port}/{p.protocol}
              </span>
            ))}
            {host.openPorts.length > 8 && (
              <span style={styles.morePorts}>+{host.openPorts.length - 8} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '10px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  ipRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  ip: { color: '#f1f5f9', fontWeight: 600, fontSize: '15px', fontFamily: 'monospace' },
  hostname: { color: '#64748b', fontSize: '12px' },
  statusBadge: (status) => ({
    background: status === 'up' ? '#14532d' : '#450a0a',
    color: status === 'up' ? '#4ade80' : '#f87171',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 700,
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '8px',
    marginBottom: '10px',
  },
  detail: { display: 'flex', flexDirection: 'column', gap: '2px' },
  label: { color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  value: { color: '#94a3b8', fontSize: '12px' },
  portsSection: { borderTop: '1px solid #334155', paddingTop: '10px' },
  ports: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' },
  portBadge: {
    background: '#0f172a',
    border: '1px solid #1e40af',
    color: '#93c5fd',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    cursor: 'default',
  },
  morePorts: { color: '#475569', fontSize: '11px', alignSelf: 'center' },
};

export default ScanResultCard;