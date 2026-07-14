import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axiosInstance';
import DeviceStatusCard from '../components/DeviceStatusCard';

const WS_URL = 'ws://localhost:5000/ws';

const Monitor = () => {
  const [devices, setDevices] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pingHistory, setPingHistory] = useState([]);
  const [filter, setFilter] = useState('all');

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const eventsRef = useRef([]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [devicesRes, statusRes] = await Promise.all([
  api.get('/devices'), // ✅ correct API
  api.get('/metrics/monitor-status'),
]);

setDevices(devicesRes.data.data); // ✅ correct data
      setMonitorStatus(statusRes.data.data);
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    connectWebSocket();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
      clearTimeout(reconnectRef.current);
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch {}
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        // Auto-reconnect after 5 seconds
        reconnectRef.current = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = () => setWsStatus('error');
    } catch {
      setWsStatus('error');
    }
  };

  const handleWebSocketMessage = (msg) => {
    switch (msg.type) {
      case 'PING_RESULT':
        // Update device in list
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceId?.toString() === msg.data.deviceId?.toString()
              ? { ...d, status: msg.data.status, responseTime: msg.data.responseTime, timestamp: msg.timestamp }
              : d
          )
        );
        break;

      case 'STATUS_CHANGE':
        addEvent({
          type: 'status',
          message: `${msg.data.deviceName} changed: ${msg.data.previousStatus} → ${msg.data.newStatus}`,
          color: msg.data.newStatus === 'online' ? '#4ade80' : '#f87171',
          time: msg.timestamp,
        });
        break;

      case 'PING_SWEEP_COMPLETE':
        addEvent({
          type: 'sweep',
          message: `Ping sweep — ${msg.data.succeeded}/${msg.data.total} devices responded`,
          color: '#38bdf8',
          time: msg.timestamp,
        });
        break;

      default:
        break;
    }
  };

  const addEvent = (event) => {
    eventsRef.current = [event, ...eventsRef.current].slice(0, 50);
    setLiveEvents([...eventsRef.current]);
  };

  const loadPingHistory = async (device) => {
    setSelectedDevice(device);
    try {
      const res = await api.get(`/metrics/${device._id}/ping?limit=30`);
      setPingHistory(res.data.data);
    } catch {
      setPingHistory([]);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  const counts = {
    all: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    offline: devices.filter((d) => d.status === 'offline').length,
    unknown: devices.filter((d) => d.status === 'unknown').length,
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Live Monitor</h1>
          <p style={styles.subtitle}>Real-time device health across your network</p>
        </div>
        <div style={styles.wsIndicator}>
          <span style={styles.wsDot(wsStatus)} />
          <span style={styles.wsLabel}>
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Monitor Engine Status */}
      {monitorStatus && (
        <div style={styles.statusBar}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Ping Monitor</span>
            <span style={{ color: monitorStatus.scheduler.ping.running ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '12px' }}>
              {monitorStatus.scheduler.ping.running ? '● ACTIVE' : '○ STOPPED'}
            </span>
            <span style={styles.statusMeta}>every {monitorStatus.scheduler.ping.intervalSeconds}s</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>SNMP Collector</span>
            <span style={{ color: monitorStatus.scheduler.snmp.running ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '12px' }}>
              {monitorStatus.scheduler.snmp.running ? '● ACTIVE' : '○ STOPPED'}
            </span>
            <span style={styles.statusMeta}>every {monitorStatus.scheduler.snmp.intervalSeconds}s</span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>WS Clients</span>
            <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '14px' }}>
              {monitorStatus.websocket.connectedClients}
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Metrics (1h)</span>
            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '14px' }}>
              {monitorStatus.metrics.lastHour}
            </span>
          </div>
        </div>
      )}

      <div style={styles.mainGrid}>
        {/* Left: Device Grid */}
        <div style={styles.leftCol}>
          {/* Filter Tabs */}
          <div style={styles.filterRow}>
            {['all', 'online', 'offline', 'unknown'].map((f) => (
              <button
                key={f}
                style={styles.filterBtn(filter === f)}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span style={styles.filterCount}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {filteredDevices.length === 0 ? (
            <div style={styles.empty}>
              {devices.length === 0
                ? '📡 No devices monitored yet. Add devices and they will appear here.'
                : `No ${filter} devices`}
            </div>
          ) : (
            <div style={styles.deviceGrid}>
              {filteredDevices.map((d) => (
                <DeviceStatusCard
                  kkey={d._id}
                  device={d}
                  onClick={loadPingHistory}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Side Panel */}
        <div style={styles.rightCol}>
          {/* Selected Device Ping History */}
          {selectedDevice ? (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>📈 {selectedDevice.deviceName}</h3>
                <button style={styles.closeBtn} onClick={() => setSelectedDevice(null)}>✕</button>
              </div>
              <div style={styles.ipTag}>{selectedDevice.ipAddress}</div>

              {pingHistory.length > 0 ? (
                <>
                  <div style={styles.miniChartLabel}>Response Time (last {pingHistory.length} checks)</div>
                  <div style={styles.miniChart}>
                    {pingHistory.map((m, i) => {
                      const rtt = m.ping?.responseTime;
                      const height = rtt ? Math.min((rtt / 300) * 60, 60) : 0;
                      const color = !m.ping?.alive ? '#f87171' : rtt < 50 ? '#4ade80' : rtt < 150 ? '#fbbf24' : '#f87171';
                      return (
                        <div
                          key={i}
                          title={m.ping?.alive ? `${rtt}ms` : 'DOWN'}
                          style={styles.bar(height || 4, color)}
                        />
                      );
                    })}
                  </div>
                  <div style={styles.rttStats}>
                    {(() => {
                      const rtts = pingHistory.filter((m) => m.ping?.responseTime).map((m) => m.ping.responseTime);
                      if (!rtts.length) return null;
                      const avg = (rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(1);
                      const min = Math.min(...rtts);
                      const max = Math.max(...rtts);
                      return (
                        <>
                          <div style={styles.rttStat}><span style={styles.rttLabel}>Min</span><span style={{ color: '#4ade80' }}>{min}ms</span></div>
                          <div style={styles.rttStat}><span style={styles.rttLabel}>Avg</span><span style={{ color: '#fbbf24' }}>{avg}ms</span></div>
                          <div style={styles.rttStat}><span style={styles.rttLabel}>Max</span><span style={{ color: '#f87171' }}>{max}ms</span></div>
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div style={styles.empty}>No ping history yet. Monitoring will begin shortly.</div>
              )}
            </div>
          ) : (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📊 Device Detail</h3>
              <div style={styles.empty}>Click any device card to see its ping history and metrics.</div>
            </div>
          )}

          {/* Live Event Feed */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>⚡ Live Events</h3>
            {liveEvents.length === 0 ? (
              <div style={styles.empty}>Waiting for events...</div>
            ) : (
              <div style={styles.eventFeed}>
                {liveEvents.slice(0, 15).map((event, i) => (
                  <div key={i} style={styles.event}>
                    <span style={{ color: event.color, fontSize: '8px' }}>●</span>
                    <span style={styles.eventMsg}>{event.message}</span>
                    <span style={styles.eventTime}>
                      {new Date(event.time).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1); opacity: 0.6; }
          50%  { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: { maxWidth: '1300px', margin: '0 auto', padding: '28px 24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { color: '#f1f5f9', fontSize: '28px', fontWeight: 700, margin: 0 },
  subtitle: { color: '#475569', fontSize: '14px', marginTop: '4px' },
  wsIndicator: { display: 'flex', alignItems: 'center', gap: '8px', background: '#1e293b', border: '1px solid #334155', borderRadius: '20px', padding: '6px 14px' },
  wsDot: (status) => ({ width: '8px', height: '8px', borderRadius: '50%', background: status === 'connected' ? '#4ade80' : status === 'connecting' ? '#fbbf24' : '#f87171', display: 'inline-block' }),
  wsLabel: { color: '#94a3b8', fontSize: '12px', fontWeight: 600 },
  statusBar: { display: 'flex', gap: '24px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px 20px', marginBottom: '20px', flexWrap: 'wrap' },
  statusItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  statusLabel: { color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statusMeta: { color: '#334155', fontSize: '10px' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' },
  leftCol: {},
  rightCol: { display: 'flex', flexDirection: 'column', gap: '16px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    background: active ? '#1e3a5f' : '#1e293b',
    border: `1px solid ${active ? '#3b82f6' : '#334155'}`,
    color: active ? '#93c5fd' : '#64748b',
    borderRadius: '20px', padding: '5px 14px',
    fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
  }),
  filterCount: { background: '#0f172a', borderRadius: '10px', padding: '0 6px', fontSize: '11px' },
  deviceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
  empty: { color: '#475569', fontSize: '14px', padding: '30px', textAlign: 'center' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#94a3b8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: 0, marginBottom: '12px' },
  closeBtn: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' },
  ipTag: { color: '#64748b', fontSize: '12px', fontFamily: 'monospace', marginBottom: '14px' },
  miniChartLabel: { color: '#475569', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px' },
  miniChart: { display: 'flex', alignItems: 'flex-end', gap: '2px', height: '64px', marginBottom: '12px' },
  bar: (height, color) => ({ width: '6px', height: `${height}px`, background: color, borderRadius: '2px', flexShrink: 0, transition: 'height 0.3s' }),
  rttStats: { display: 'flex', gap: '16px' },
  rttStat: { display: 'flex', flexDirection: 'column', gap: '2px' },
  rttLabel: { color: '#475569', fontSize: '10px', textTransform: 'uppercase' },
  eventFeed: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' },
  event: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  eventMsg: { color: '#94a3b8', fontSize: '12px', flex: 1 },
  eventTime: { color: '#334155', fontSize: '10px', whiteSpace: 'nowrap' },
};

export default Monitor;