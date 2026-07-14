import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosInstance';
import ForecastChart   from '../components/ForecastChart';
import HealthScoreCard from '../components/HealthScoreCard';
import RiskTable       from '../components/RiskTable';

export default function Analytics() {
  const [summary,       setSummary]       = useState(null);
  const [healthScores,  setHealthScores]  = useState([]);
  const [forecasts,     setForecasts]     = useState([]);
  const [selectedDev,   setSelectedDev]   = useState(null);
  const [devForecast,   setDevForecast]   = useState(null);
  const [devices,       setDevices]       = useState([]);
  const [loading,       setLoading]       = useState({});
  const [error,         setError]         = useState('');

  const setLoad = (key, val) => setLoading((prev) => ({ ...prev, [key]: val }));

  // ── Load Summary ────────────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    try {
      const [summaryRes, devRes] = await Promise.all([
        api.get('/forecast/summary'),
        api.get('/devices'),
      ]);
      const d = summaryRes.data.data;
      setSummary(d);
      setHealthScores(d.healthScores || []);
      setForecasts(d.forecasts || []);
      setDevices(devRes.data.data || []);
    } catch {
      // Silent — user will trigger actions manually
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ── Run All Forecasts ───────────────────────────────────────────────────────
  const handleRunForecasts = async () => {
    setLoad('forecast', true);
    setError('');
    try {
      const res = await api.post('/forecast/run', { horizon: 60 });
      setForecasts(res.data.data || []);
      await loadSummary();
    } catch (err) {
      setError(err.response?.data?.message || 'Forecast failed. Is the AI service running?');
    } finally {
      setLoad('forecast', false);
    }
  };

  // ── Run Health Scores ───────────────────────────────────────────────────────
  const handleRunHealthScores = async () => {
    setLoad('health', true);
    setError('');
    try {
      const res = await api.post('/forecast/health-scores');
      setHealthScores(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Health scoring failed. Is the AI service running?');
    } finally {
      setLoad('health', false);
    }
  };

  // ── Load Device Forecast ────────────────────────────────────────────────────
  const handleSelectDevice = async (deviceId) => {
    setSelectedDev(deviceId);
    setDevForecast(null);
    try {
      const res = await api.get(`/forecast/device/${deviceId}?horizon=60`);
      setDevForecast(res.data.data);
    } catch {
      setDevForecast({ status: 'error', message: 'Could not load forecast' });
    }
  };

  const summaryCards = [
    { label: 'Devices Scored',   value: summary?.totalScored    ?? '—', color: '#38bdf8', icon: '🖥️'  },
    { label: 'Avg Health Score', value: summary?.avgHealth       ?? '—', color: '#4ade80', icon: '❤️'  },
    { label: 'At Risk (≥50%)',   value: summary?.atRisk          ?? '—', color: '#f87171', icon: '⚠️'  },
    { label: 'RTT Degrading',    value: summary?.degradingDevices ?? '—', color: '#fb923c', icon: '📈'  },
  ];

  return (
    <div style={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Predictive Analytics</h1>
          <p style={styles.subtitle}>AI-powered forecasting and failure risk prediction</p>
        </div>
        <div style={styles.actions}>
          <button
            style={styles.btn(loading.health)}
            onClick={handleRunHealthScores}
            disabled={loading.health}
          >
            {loading.health ? '⏳ Scoring...' : '❤️ Score Health'}
          </button>
          <button
            style={styles.btnPrimary(loading.forecast)}
            onClick={handleRunForecasts}
            disabled={loading.forecast}
          >
            {loading.forecast ? '⏳ Forecasting...' : '📈 Run Forecast'}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>⚠️ {error}</div>}

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div style={styles.summaryGrid}>
        {summaryCards.map(({ label, value, color, icon }) => (
          <div key={label} style={styles.summaryCard}>
            <span style={styles.summaryIcon}>{icon}</span>
            <span style={{ ...styles.summaryValue, color }}>{value}</span>
            <span style={styles.summaryLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Device Forecast ────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>📈 RTT Forecast — 60 Minute Horizon</span>
          <select
            style={styles.select}
            onChange={(e) => handleSelectDevice(e.target.value)}
            value={selectedDev || ''}
          >
            <option value="">Select a device...</option>
            {devices.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.ipAddress})
              </option>
            ))}
          </select>
        </div>

        {selectedDev && devForecast ? (
          devForecast.status === 'success' ? (
            <ForecastChart
              history={devForecast.history}
              forecast={devForecast.forecast}
              currentRtt={devForecast.current_avg_rtt}
              forecastedRtt={devForecast.forecasted_rtt}
              trend={devForecast.trend_direction}
            />
          ) : (
            <div style={styles.empty}>
              {devForecast.message || 'Not enough data for this device. Wait for more ping sweeps.'}
            </div>
          )
        ) : (
          <div style={styles.empty}>
            Select a device above to see its RTT forecast.
          </div>
        )}
      </div>

      {/* ── Health Score Cards ─────────────────────────────────────────────── */}
      {healthScores.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>❤️ Device Health Scores</span>
            <span style={styles.cardMeta}>{healthScores.length} devices scored</span>
          </div>
          <div style={styles.scoreGrid}>
            {healthScores.slice(0, 6).map((score) => (
              <HealthScoreCard key={score.deviceId} score={score} />
            ))}
          </div>
        </div>
      )}

      {/* ── Risk Table ─────────────────────────────────────────────────────── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>⚠️ Device Risk Assessment</span>
          <span style={styles.cardMeta}>Sorted by failure risk — highest first</span>
        </div>
        <RiskTable scores={healthScores} forecasts={forecasts} />
      </div>

    </div>
  );
}

const styles = {
  page:     { maxWidth: '1300px', margin: '0 auto', padding: '28px 24px' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title:    { color: '#f1f5f9', fontSize: '26px', fontWeight: 800, margin: 0 },
  subtitle: { color: '#475569', fontSize: '14px', marginTop: '4px' },
  actions:  { display: 'flex', gap: '10px' },
  btn: (dis) => ({
    background: '#1e293b', border: '1px solid #334155',
    color: dis ? '#334155' : '#94a3b8',
    borderRadius: '8px', padding: '9px 18px', fontSize: '13px',
    fontWeight: 600, cursor: dis ? 'not-allowed' : 'pointer',
  }),
  btnPrimary: (dis) => ({
    background: dis ? '#1e3a5f' : '#2563eb',
    border: 'none', color: dis ? '#475569' : '#fff',
    borderRadius: '8px', padding: '9px 18px',
    fontSize: '13px', fontWeight: 600,
    cursor: dis ? 'not-allowed' : 'pointer',
  }),
  error: { color: '#f87171', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' },
  summaryCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '4px' },
  summaryIcon: { fontSize: '20px', marginBottom: '4px' },
  summaryValue: { fontSize: '32px', fontWeight: 800, lineHeight: 1 },
  summaryLabel: { color: '#64748b', fontSize: '12px' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  cardTitle: { color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' },
  cardMeta: { color: '#334155', fontSize: '12px' },
  scoreGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' },
  select: { background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', outline: 'none', minWidth: '220px' },
  empty: { color: '#475569', fontSize: '13px', textAlign: 'center', padding: '40px' },
};