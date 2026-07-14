import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosInstance';
import { useWebSocket } from '../hooks/useWebSocket';
import AlertCard from '../components/AlertCard';

const FILTERS = [
  { key: 'all',          label: 'All',          status: '' },
  { key: 'active',       label: '🔴 Active',    status: 'active' },
  { key: 'acknowledged', label: '🟡 Acknowledged', status: 'acknowledged' },
  { key: 'resolved',     label: '✅ Resolved',  status: 'resolved' },
];

const SEVERITY_FILTERS = ['all', 'critical', 'warning', 'info'];

export default function Alerts() {
  const [alerts,   setAlerts]   = useState([]);
  const [stats,    setStats]    = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [severity, setSeverity] = useState('all');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState('');

  const LIMIT = 20;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Fetch alerts ─────────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: LIMIT, page,
        ...(filter   !== 'all' && { status:   filter }),
        ...(severity !== 'all' && { severity: severity }),
        ...(search               && { search }),
      });
      const [alertsRes, statsRes] = await Promise.all([
        api.get(`/alerts?${params}`),
        api.get('/alerts/stats'),
      ]);
      setAlerts(alertsRes.data.data);
      setTotal(alertsRes.data.total);
      setStats(statsRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [filter, severity, search, page]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  useWebSocket(useCallback((msg) => {
    if (['NEW_ALERT', 'ALERT_UPDATED', 'ALERTS_BULK_UPDATED', 'ALERT_ESCALATED'].includes(msg.type)) {
      fetchAlerts();
      if (msg.type === 'NEW_ALERT') showToast(`🔔 New alert: ${msg.data?.title}`);
      if (msg.type === 'ALERT_ESCALATED') showToast(`⚡ Escalated: ${msg.data?.title}`);
    }
  }, [fetchAlerts]));

  // ── Actions ───────────────────────────────────────────────────────────────────
  const handleAck     = async (id) => { await api.patch(`/alerts/${id}/acknowledge`); fetchAlerts(); showToast('Alert acknowledged'); };
  const handleResolve = async (id) => { await api.patch(`/alerts/${id}/resolve`);     fetchAlerts(); showToast('Alert resolved'); };
  const handleDismiss = async (id) => { await api.patch(`/alerts/${id}/dismiss`);     fetchAlerts(); showToast('Alert dismissed'); };
  const handleEmail   = async (id) => {
    const res = await api.post(`/alerts/${id}/resend-email`);
    const preview = res.data.data?.preview;
    showToast(preview ? `📧 Preview: ${preview}` : '📧 Email sent');
  };

  const handleBulk = async (action) => {
    await api.post('/alerts/bulk', { action, filters: filter !== 'all' ? { status: filter } : { status: { $in: ['active', 'acknowledged'] } } });
    fetchAlerts();
    showToast(`Bulk ${action} complete`);
  };

  const handleMarkAllRead = async () => {
    await api.post('/alerts/mark-read', { alertIds: [] });
    fetchAlerts();
  };

  const statCards = stats ? [
    { label: 'Active',      value: stats.status?.active       ?? 0, color: '#f87171' },
    { label: 'Unread',      value: stats.unread               ?? 0, color: '#fbbf24' },
    { label: 'Critical 24h',value: stats.severity?.critical   ?? 0, color: '#f87171' },
    { label: 'Warning 24h', value: stats.severity?.warning    ?? 0, color: '#fb923c' },
    { label: 'Resolved 7d', value: stats.resolved7d           ?? 0, color: '#4ade80' },
    { label: 'Total 24h',   value: stats.total24h             ?? 0, color: '#38bdf8' },
  ] : [];

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={styles.page}>

      {toast && <div style={styles.toast}>{toast}</div>}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Alert Center</h1>
          <p style={styles.subtitle}>Monitor, acknowledge and resolve network alerts</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={handleMarkAllRead}>Mark All Read</button>
          <button style={styles.btnWarning}   onClick={() => handleBulk('acknowledge')}>Ack All Active</button>
          <button style={styles.btnSuccess}   onClick={() => handleBulk('resolve')}>Resolve All</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={styles.statsGrid}>
          {statCards.map(({ label, value, color }) => (
            <div key={label} style={styles.statCard}>
              <span style={{ color, fontSize: '28px', fontWeight: 800 }}>{value}</span>
              <span style={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersRow}>
        {/* Status filter */}
        <div style={styles.tabGroup}>
          {FILTERS.map((f) => (
            <button key={f.key} style={styles.tab(filter === f.key)}
              onClick={() => { setFilter(f.key); setPage(1); }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div style={styles.tabGroup}>
          {SEVERITY_FILTERS.map((s) => (
            <button key={s} style={styles.tab(severity === s)}
              onClick={() => { setSeverity(s); setPage(1); }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          style={styles.search}
          placeholder="🔍 Search alerts..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Alert List */}
      <div>
        {loading ? (
          <div style={styles.empty}>Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>No alerts found</div>
            <div style={{ color: '#475569', fontSize: '14px' }}>
              {filter === 'active' ? 'No active alerts — your network looks healthy!' : 'Try changing the filters above'}
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertCard
              key={alert._id}
              alert={alert}
              onAck={handleAck}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
              onResendEmail={handleEmail}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button style={styles.pageBtn(page === 1)} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={styles.pageInfo}>Page {page} of {totalPages} ({total} total)</span>
          <button style={styles.pageBtn(page === totalPages)} disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' },
  toast: { position: 'fixed', top: '20px', right: '20px', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '12px 20px', borderRadius: '8px', zIndex: 9999, fontSize: '13px', maxWidth: '400px', wordBreak: 'break-word' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title:  { color: '#f1f5f9', fontSize: '26px', fontWeight: 800, margin: 0 },
  subtitle:{ color: '#475569', fontSize: '14px', marginTop: '4px' },
  headerActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnSecondary:{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '7px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer' },
  btnWarning:  { background: '#422006', border: '1px solid #78350f', color: '#fbbf24', borderRadius: '7px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer' },
  btnSuccess:  { background: '#14532d', border: '1px solid #166534', color: '#4ade80', borderRadius: '7px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' },
  statCard: { background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statLabel: { color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  filtersRow: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  tabGroup: { display: 'flex', gap: '4px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '3px' },
  tab: (a) => ({ background: a ? '#2563eb' : 'none', border: 'none', color: a ? '#fff' : '#64748b', borderRadius: '5px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: a ? 600 : 400, whiteSpace: 'nowrap' }),
  search: { background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', outline: 'none', flex: 1, minWidth: '200px' },
  empty: { color: '#475569', textAlign: 'center', padding: '40px', fontSize: '14px' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px' },
  pageBtn: (dis) => ({ background: '#1e293b', border: '1px solid #334155', color: dis ? '#334155' : '#94a3b8', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: dis ? 'not-allowed' : 'pointer' }),
  pageInfo: { color: '#475569', fontSize: '13px' },
};