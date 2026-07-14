import { useState } from 'react';

const STATUS_COLORS = {
  online:   { color: '#4ade80', bg: '#14532d' },
  offline:  { color: '#f87171', bg: '#450a0a' },
  degraded: { color: '#fb923c', bg: '#431407' },
  unknown:  { color: '#94a3b8', bg: '#1e293b' },
};

const RTT_COLOR = (rtt) => {
  if (rtt == null) return '#475569';
  if (rtt < 50)   return '#4ade80';
  if (rtt < 150)  return '#fbbf24';
  return '#f87171';
};

const COLS = [
  { key: 'deviceName',    label: 'Device'       },
  { key: 'ipAddress',     label: 'IP Address'   },
  { key: 'status',        label: 'Status'       },
  { key: 'responseTime',  label: 'RTT (ms)'     },
  { key: 'type',          label: 'Type'         },
  { key: 'timestamp',     label: 'Last Check'   },
];

const DeviceTable = ({ devices = [], onSelect }) => {
  const [sortKey, setSortKey]   = useState('status');
  const [sortDir, setSortDir]   = useState('asc');
  const [search, setSearch]     = useState('');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...devices]
    .filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.deviceName?.toLowerCase().includes(q) ||
        d.ipAddress?.toLowerCase().includes(q) ||
        d.type?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (sortKey === 'responseTime') { av = av || 9999; bv = bv || 9999; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

  if (devices.length === 0) {
    return (
      <div style={styles.empty}>
        No devices found. Add devices or run a discovery scan to populate this table.
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <input
        style={styles.search}
        placeholder="🔍  Search by name, IP, or type..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  style={styles.th(sortKey === col.key)}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: '4px' }}>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((device, i) => {
              const sc = STATUS_COLORS[device.status] || STATUS_COLORS.unknown;
              return (
                <tr
                  key={device.deviceId || i}
                  style={styles.tr}
                  onClick={() => onSelect?.(device)}
                >
                  {/* Device Name */}
                  <td style={styles.td}>
                    <span style={styles.deviceName}>{device.deviceName || '—'}</span>
                  </td>

                  {/* IP */}
                  <td style={styles.td}>
                    <span style={styles.mono}>{device.ipAddress}</span>
                  </td>

                  {/* Status Badge */}
                  <td style={styles.td}>
                    <span style={styles.badge(sc.color, sc.bg)}>
                      {device.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </td>

                  {/* RTT */}
                  <td style={styles.td}>
                    <span style={{ color: RTT_COLOR(device.responseTime), fontWeight: 600, fontSize: '13px' }}>
                      {device.responseTime != null ? `${device.responseTime} ms` : '—'}
                    </span>
                  </td>

                  {/* Type */}
                  <td style={styles.td}>
                    <span style={styles.typeTag}>{device.type || '—'}</span>
                  </td>

                  {/* Last Check */}
                  <td style={styles.td}>
                    <span style={styles.time}>
                      {device.timestamp
                        ? new Date(device.timestamp).toLocaleTimeString()
                        : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.footer}>
        Showing {sorted.length} of {devices.length} devices
      </div>
    </div>
  );
};

const styles = {
  search: {
    width: '100%', background: '#0f172a',
    border: '1px solid #334155', borderRadius: '8px',
    color: '#f1f5f9', padding: '9px 14px',
    fontSize: '13px', outline: 'none',
    marginBottom: '14px', boxSizing: 'border-box',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '600px' },
  th: (active) => ({
    color: active ? '#38bdf8' : '#475569',
    fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '10px 14px',
    textAlign: 'left', borderBottom: '1px solid #334155',
    cursor: 'pointer', whiteSpace: 'nowrap',
    userSelect: 'none',
  }),
  tr: {
    borderBottom: '1px solid #1e293b',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  deviceName: { color: '#f1f5f9', fontWeight: 600, fontSize: '13px' },
  mono: { color: '#94a3b8', fontFamily: 'monospace', fontSize: '12px' },
  badge: (color, bg) => ({
    background: bg, color,
    padding: '3px 10px', borderRadius: '12px',
    fontSize: '10px', fontWeight: 700,
  }),
  typeTag: {
    background: '#0f172a', color: '#64748b',
    border: '1px solid #334155',
    padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
  },
  time: { color: '#475569', fontSize: '11px' },
  footer: { color: '#334155', fontSize: '11px', marginTop: '10px', textAlign: 'right' },
  empty: { color: '#475569', fontSize: '14px', padding: '40px', textAlign: 'center' },
};

export default DeviceTable;