import { useState, useEffect, useRef } from 'react';
import api from '../api/axiosInstance';
import ScanResultCard from '../components/ScanResultCard';

const SCAN_TYPES = [
  { value: 'quick', label: '⚡ Quick', desc: 'Ping sweep only — fastest' },
  { value: 'standard', label: '🔍 Standard', desc: 'OS + top 100 ports — recommended' },
  { value: 'deep', label: '🔬 Deep', desc: 'All ports — slowest, most thorough' },
];

const STATUS_COLORS = {
  queued: '#94a3b8',
  running: '#fbbf24',
  completed: '#4ade80',
  failed: '#f87171',
};

const Discovery = () => {
  const [target, setTarget] = useState('');
  const [scanType, setScanType] = useState('standard');
  const [currentJob, setCurrentJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  // Load scan history on mount
  useEffect(() => {
    loadHistory();
    return () => clearInterval(pollRef.current);
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/scan/history?limit=5');
      setHistory(res.data.data);
    } catch {
      // Non-critical — don't show error
    }
  };

  const startScan = async () => {
    if (!target.trim()) {
      setError('Please enter a scan target');
      return;
    }
    setError('');
    setResults(null);
    setLoading(true);

    try {
      const res = await api.post('/scan', { target: target.trim(), scanType });
      const { jobId } = res.data;
      setCurrentJob({ jobId, status: 'queued', target, scanType });
      pollJobStatus(jobId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start scan');
      setLoading(false);
    }
  };

  // Poll for job status every 2 seconds
  const pollJobStatus = (jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/scan/status/${jobId}`);
        const job = res.data.data;
        setCurrentJob(job);

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollRef.current);
          setLoading(false);
          if (job.status === 'completed') {
            setResults(job.results || []);
            loadHistory(); // Refresh history
          } else {
            setError(`Scan failed: ${job.errorMessage}`);
          }
        }
      } catch {
        clearInterval(pollRef.current);
        setLoading(false);
      }
    }, 2000);
  };

  const loadResults = async (jobId) => {
    try {
      const res = await api.get(`/scan/${jobId}/results`);
      setResults(res.data.data.results);
      setCurrentJob(res.data.data);
    } catch (err) {
      setError('Could not load scan results');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Network Discovery</h1>
      <p style={styles.subtitle}>Scan your network to detect and fingerprint devices</p>

      {/* Scan Form */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🔍 New Scan</h3>

        <div style={styles.formRow}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Target</label>
            <input
              style={styles.input}
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="192.168.1.0/24 or 192.168.1.1 or 192.168.1.1-50"
              onKeyDown={(e) => e.key === 'Enter' && startScan()}
            />
            <span style={styles.hint}>
              Examples: 192.168.1.0/24 | 10.0.0.1 | 192.168.1.1-20
            </span>
          </div>
        </div>

        {/* Scan Type Selector */}
        <div style={styles.scanTypes}>
          {SCAN_TYPES.map((type) => (
            <div
              key={type.value}
              style={styles.scanTypeCard(scanType === type.value)}
              onClick={() => setScanType(type.value)}
            >
              <div style={styles.scanTypeLabel}>{type.label}</div>
              <div style={styles.scanTypeDesc}>{type.desc}</div>
            </div>
          ))}
        </div>

        {error && <div style={styles.error}>⚠️ {error}</div>}

        <button
          style={styles.button(loading)}
          onClick={startScan}
          disabled={loading}
        >
          {loading ? '⏳ Scanning...' : '🚀 Start Scan'}
        </button>
      </div>

      {/* Active Job Status */}
      {currentJob && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📡 Scan Status</h3>
          <div style={styles.jobStatus}>
            <div style={styles.jobRow}>
              <span style={styles.label}>Job ID</span>
              <span style={styles.mono}>{currentJob.jobId}</span>
            </div>
            <div style={styles.jobRow}>
              <span style={styles.label}>Target</span>
              <span style={styles.mono}>{currentJob.target}</span>
            </div>
            <div style={styles.jobRow}>
              <span style={styles.label}>Status</span>
              <span style={{
                color: STATUS_COLORS[currentJob.status] || '#94a3b8',
                fontWeight: 700,
                fontSize: '13px',
              }}>
                {loading && currentJob.status === 'running' && '⏳ '}
                {currentJob.status?.toUpperCase()}
              </span>
            </div>
            {currentJob.status === 'completed' && (
              <>
                <div style={styles.jobRow}>
                  <span style={styles.label}>Live Hosts</span>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>{currentJob.hostsFound}</span>
                </div>
                <div style={styles.jobRow}>
                  <span style={styles.label}>New Devices</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{currentJob.newDevices}</span>
                </div>
                <div style={styles.jobRow}>
                  <span style={styles.label}>Duration</span>
                  <span style={styles.value}>{currentJob.duration}s</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Scan Results */}
      {results && results.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            ✅ Discovered Hosts ({results.length})
          </h3>
          {results.map((host) => (
            <ScanResultCard key={host.ipAddress} host={host} />
          ))}
        </div>
      )}

      {results && results.length === 0 && (
        <div style={styles.card}>
          <div style={styles.empty}>No live hosts found in the scanned range.</div>
        </div>
      )}

      {/* Scan History */}
      {history.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🕘 Recent Scans</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Target', 'Type', 'Status', 'Hosts Found', 'New', 'Duration', ''].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((job) => (
                <tr key={job.jobId} style={styles.tr}>
                  <td style={styles.td}><span style={styles.mono}>{job.target}</span></td>
                  <td style={styles.td}>{job.scanType}</td>
                  <td style={styles.td}>
                    <span style={{ color: STATUS_COLORS[job.status] || '#94a3b8', fontWeight: 600 }}>
                      {job.status}
                    </span>
                  </td>
                  <td style={styles.td}>{job.hostsFound ?? '-'}</td>
                  <td style={styles.td}>{job.newDevices ?? '-'}</td>
                  <td style={styles.td}>{job.duration ? `${job.duration}s` : '-'}</td>
                  <td style={styles.td}>
                    {job.status === 'completed' && (
                      <button
                        style={styles.smallBtn}
                        onClick={() => loadResults(job.jobId)}
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' },
  title: { color: '#f1f5f9', fontSize: '28px', fontWeight: 700, margin: 0 },
  subtitle: { color: '#475569', fontSize: '14px', marginTop: '6px', marginBottom: '32px' },
  card: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '10px', padding: '20px', marginBottom: '20px',
  },
  cardTitle: {
    color: '#94a3b8', fontSize: '13px', fontWeight: 600,
    marginTop: 0, marginBottom: '16px',
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  formRow: { marginBottom: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: '6px',
    color: '#f1f5f9', padding: '10px 14px', fontSize: '14px',
    fontFamily: 'monospace', outline: 'none', width: '100%',
  },
  hint: { color: '#334155', fontSize: '11px' },
  scanTypes: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  scanTypeCard: (active) => ({
    flex: 1, minWidth: '140px',
    background: active ? '#1e3a5f' : '#0f172a',
    border: `1px solid ${active ? '#3b82f6' : '#334155'}`,
    borderRadius: '8px', padding: '12px', cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  scanTypeLabel: { color: '#f1f5f9', fontSize: '13px', fontWeight: 600, marginBottom: '4px' },
  scanTypeDesc: { color: '#475569', fontSize: '11px' },
  error: { color: '#f87171', fontSize: '13px', marginBottom: '12px' },
  button: (disabled) => ({
    background: disabled ? '#1e3a5f' : '#2563eb',
    color: disabled ? '#475569' : '#fff',
    border: 'none', borderRadius: '8px',
    padding: '10px 24px', fontSize: '14px',
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
  }),
  jobStatus: { display: 'flex', flexDirection: 'column', gap: '10px' },
  jobRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  mono: { color: '#94a3b8', fontFamily: 'monospace', fontSize: '13px' },
  value: { color: '#94a3b8', fontSize: '13px' },
  empty: { color: '#475569', fontSize: '14px', textAlign: 'center', padding: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    color: '#475569', fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '8px 12px', textAlign: 'left',
    borderBottom: '1px solid #334155',
  },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { color: '#94a3b8', fontSize: '13px', padding: '10px 12px' },
  smallBtn: {
    background: '#1e3a5f', border: '1px solid #3b82f6',
    color: '#93c5fd', borderRadius: '4px',
    padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
  },
};

export default Discovery;