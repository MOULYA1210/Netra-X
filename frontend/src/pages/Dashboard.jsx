import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import api from '../api/axiosInstance';
import { useWebSocket } from '../hooks/useWebSocket';
import StatCard    from '../components/StatCard';
import LatencyChart from '../components/LatencyChart';
import UptimeDonut  from '../components/UptimeDonut';
import DeviceTable  from '../components/DeviceTable';
import AnomalyFeed from '../components/AnomalyFeed';

// How many latency data points to show on chart
const MAX_CHART_POINTS = 30;

export default function Dashboard() {
  const [stats,       setStats]       = useState(null);
  const [devices,     setDevices]     = useState([]);
  const [chartData,   setChartData]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sweepCount,  setSweepCount]  = useState(0);
  const [anomalies,      setAnomalies]      = useState([]);
const [anomalyStats,   setAnomalyStats]   = useState(null);
const [detectLoading,  setDetectLoading]  = useState(false);
const [aiStatus,       setAiStatus]       = useState(null);

  // Keep device list accessible inside WS callback without stale closure
  const devicesRef = useRef([]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // ─── Fetch Data ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [devicesRes, anomalyRes, aiStatusRes] = await Promise.all([
  api.get('/devices'),
  api.get('/anomaly/recent?limit=10'),
  api.get('/anomaly/status'),
]);

const devicesData = devicesRes.data.data;

setDevices(devicesData);
setAnomalies(anomalyRes.data.data);
setAiStatus(aiStatusRes.data.data);

// stats calculation
const total = devicesData.length;
const online = devicesData.filter(d => d.status === 'online').length;
const offline = devicesData.filter(d => d.status === 'offline').length;
const unknown = devicesData.filter(d => d.status === 'unknown').length;

setStats({
  total,
  online,
  offline,
  unknown,
  degraded: 0
});
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ─── WebSocket Handler ────────────────────────────────────────────────────────
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {

      // Update individual device status + RTT in real time
     case 'PING_RESULT': {
  const { deviceId, status, responseTime, timestamp, ipAddress } = msg.data;
     
     
  // Update device list
  setDevices((prev) =>
    prev.map((d) =>
      d._id?.toString() === deviceId?.toString()
        ? { ...d, status, responseTime, timestamp }
        : d
    )
  );

  // Update chart
  setChartData((prev) => {
    const point = {
      time: format(new Date(timestamp), 'HH:mm:ss'),
      [ipAddress]: responseTime,
    };

    const last = prev[prev.length - 1];
    if (last && last.time === point.time) {
      return [...prev.slice(0, -1), { ...last, ...point }];
    }

    return [...prev.slice(-MAX_CHART_POINTS + 1), point];
  });

  break;
  
}
case 'ANOMALY_DETECTED': {
  setAnomalies((prev) => [msg.data, ...prev].slice(0, 10));
  break;
}
      // After every full sweep, refresh stats
      case 'PING_SWEEP_COMPLETE': {
        setSweepCount((c) => c + 1);
        fetchAll();
        break;
      }

      // Status changes — refresh stats immediately
      case 'STATUS_CHANGE': {
        fetchAll();
        break;
      }

      default: break;
    }
  }, [fetchAll]);
  const handleDetect = async () => {
  setDetectLoading(true);
  try {
    const res = await api.post('/anomaly/detect');
    setAnomalies(res.data.data?.results?.filter(r => r.anomalyScore >= 10) || []);
  } catch (err) {
    console.error('Detection failed:', err);
  } finally {
    setDetectLoading(false);
  }
};

const handleAcknowledge = async (id) => {
  await api.patch(`/anomaly/${id}/acknowledge`, { acknowledgedBy: 'operator' });
  setAnomalies((prev) =>
    prev.map((a) => a._id === id ? { ...a, acknowledged: true } : a)
  );
};

  const { status: wsStatus } = useWebSocket(handleWsMessage);

  // Build chart device keys from current device list
  const chartDeviceKeys = [...new Set(
    chartData.flatMap((p) => Object.keys(p).filter((k) => k !== 'time'))
  )].slice(0, 6); // Max 6 lines on chart

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <span style={{ color: '#475569', marginTop: '16px' }}>Loading NetraX Dashboard...</span>
      </div>
    );
  }

  const onlineCount  = stats?.online   ?? 0;
  const offlineCount = stats?.offline  ?? 0;
  const totalCount   = stats?.total    ?? 0;
  const healthPct    = totalCount > 0 ? ((onlineCount / totalCount) * 100).toFixed(0) : 0;

  return (
    <div style={styles.page}>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>
            ⬡ NetraX
            <span style={styles.pageSub}> Network Operations Center</span>
          </h1>
          <p style={styles.pageMeta}>
            {lastUpdated && `Last updated: ${format(lastUpdated, 'HH:mm:ss')}`}
            {' · '}
            {sweepCount > 0 && `${sweepCount} sweep${sweepCount !== 1 ? 's' : ''} completed`}
          </p>
        </div>

        <div style={styles.wsChip(wsStatus)}>
          <span style={styles.wsDot(wsStatus)} />
          {wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div style={styles.statsGrid}>
        <StatCard
          icon="🖥️" label="Total Devices"
          value={totalCount}
          color="#38bdf8"
          sub="monitored endpoints"
        />
        <StatCard
          icon="✅" label="Online"
          value={onlineCount}
          color="#4ade80"
          sub={`${healthPct}% of fleet`}
        />
        <StatCard
          icon="🔴" label="Offline"
          value={offlineCount}
          color="#f87171"
          sub={offlineCount > 0 ? 'Needs attention' : 'All clear'}
        />
        <StatCard
          icon="⚠️" label="Degraded"
          value={stats?.degraded ?? 0}
          color="#fb923c"
          sub="high latency / partial"
        />
        <StatCard
          icon="📡" label="Unknown"
          value={stats?.unknown ?? 0}
          color="#94a3b8"
          sub="not yet polled"
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div style={styles.chartsRow}>

        {/* Latency Chart */}
        <div style={styles.card}>
          <LatencyChart
            data={chartData}
            devices={chartDeviceKeys}
            title="Real-time Latency"
          />
          {chartData.length === 0 && (
            <div style={styles.chartHint}>
              📡 Waiting for first ping sweep ({' '}
              <span style={{ color: '#38bdf8' }}>~30 seconds</span>
              {' '})…
            </div>
          )}
        </div>

        {/* Uptime Donut */}
        <div style={styles.donutCard}>
          <UptimeDonut stats={stats} />

          {/* Health Score */}
          <div style={styles.healthScore}>
            <div style={styles.healthLabel}>Network Health Score</div>
            <div style={styles.healthBar}>
              <div style={styles.healthFill(parseFloat(healthPct))} />
            </div>
            <div style={styles.healthPct(parseFloat(healthPct))}>
              {healthPct}%
            </div>
          </div>
        </div>
      </div>

      {/* ── Device Table ────────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>📋 Device Status</span>
          <button style={styles.refreshBtn} onClick={fetchAll}>
            ↻ Refresh
          </button>
        </div>
        <DeviceTable
          devices={devices}
          onSelect={(d) => console.log('Selected:', d)}
        />
      </div>
      {/* ── AI Anomaly Panel ───────────────────────────── */}
<div style={styles.card}>
  <div style={styles.cardHeader}>
    <div>
      <span style={styles.cardTitle}>🤖 AI Anomaly Detection</span>
      {aiStatus && (
        <span style={{
          marginLeft: '10px',
          fontSize: '11px',
          color: aiStatus.aiServiceOnline ? '#4ade80' : '#f87171',
        }}>
          {aiStatus.aiServiceOnline ? '● AI Service Online' : '○ AI Service Offline'}
        </span>
      )}
    </div>

    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        style={styles.refreshBtn}
        onClick={() => api.post('/anomaly/train')}
      >
        🧠 Train Model
      </button>

      <button
        style={{
          ...styles.refreshBtn,
          background: detectLoading ? '#1e293b' : '#1e3a5f',
          color: '#93c5fd'
        }}
        onClick={handleDetect}
        disabled={detectLoading}
      >
        {detectLoading ? '⏳ Analyzing...' : '🔍 Run Detection'}
      </button>
    </div>
  </div>

  <AnomalyFeed
    anomalies={anomalies}
    onAcknowledge={handleAcknowledge}
    loading={detectLoading}
  />
</div>

      {/* Pulse animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        tr:hover { background: #1e3a5f22 !important; }
      `}</style>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  page: { maxWidth: '1300px', margin: '0 auto', padding: '28px 24px' },

  center: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80vh' },
  spinner: { width: '36px', height: '36px', border: '3px solid #1e293b', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  pageTitle: { color: '#f1f5f9', fontSize: '26px', fontWeight: 800, margin: 0 },
  pageSub: { color: '#475569', fontWeight: 400, fontSize: '16px' },
  pageMeta: { color: '#334155', fontSize: '12px', marginTop: '4px' },

  wsChip: (status) => ({
    display: 'flex', alignItems: 'center', gap: '7px',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '20px', padding: '6px 14px',
    fontSize: '12px', fontWeight: 600,
    color: status === 'connected' ? '#4ade80' : '#fbbf24',
  }),
  wsDot: (status) => ({
    width: '7px', height: '7px', borderRadius: '50%',
    background: status === 'connected' ? '#4ade80' : '#fbbf24',
  }),

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '14px', marginBottom: '20px',
  },

  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '16px', marginBottom: '20px',
  },

  card: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '12px', padding: '20px',
  },
  donutCard: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '12px', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },

  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  cardTitle: { color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' },
  refreshBtn: {
    background: '#0f172a', border: '1px solid #334155',
    color: '#64748b', borderRadius: '6px',
    padding: '5px 12px', fontSize: '12px', cursor: 'pointer',
  },

  chartHint: { color: '#334155', fontSize: '12px', textAlign: 'center', marginTop: '8px' },

  healthScore: {},
  healthLabel: { color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  healthBar: { background: '#0f172a', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '6px' },
  healthFill: (pct) => ({
    height: '100%', borderRadius: '4px',
    width: `${pct}%`,
    background: pct >= 90 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171',
    transition: 'width 0.6s ease',
  }),
  healthPct: (pct) => ({
    color: pct >= 90 ? '#4ade80' : pct >= 70 ? '#fbbf24' : '#f87171',
    fontSize: '13px', fontWeight: 700,
  }),
};