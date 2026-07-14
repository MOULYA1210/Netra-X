import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';

const NotificationBell = ({ wsLastEvent }) => {
  const [count,    setCount]    = useState(0);
  const [peek,     setPeek]     = useState([]);
  const [open,     setOpen]     = useState(false);
  const navigate = useNavigate();

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/alerts/unread-count');
      setCount(res.data.data.count);
    } catch { /* silent */ }
  }, []);

  const fetchPeek = useCallback(async () => {
    try {
      const res = await api.get('/alerts?read=false&limit=5&status=active');
      setPeek(res.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // React to WebSocket events
  useEffect(() => {
    if (!wsLastEvent) return;
    if (['NEW_ALERT', 'ALERT_UPDATED', 'ALERTS_READ', 'ALERTS_BULK_UPDATED', 'ALERT_ESCALATED'].includes(wsLastEvent.type)) {
      fetchCount();
      if (open) fetchPeek();
    }
  }, [wsLastEvent]);

  const handleOpen = async () => {
    if (!open) await fetchPeek();
    setOpen((o) => !o);
  };

  const markAllRead = async () => {
    await api.post('/alerts/mark-read', { alertIds: [] });
    setCount(0);
    setPeek((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const SEVERITY_COLORS = { critical: '#f87171', warning: '#fbbf24', info: '#38bdf8' };

  return (
    <div style={styles.wrap}>
      {/* Bell Button */}
      <button style={styles.bell} onClick={handleOpen}>
        🔔
        {count > 0 && (
          <span style={styles.badge}>{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div style={styles.overlay} onClick={() => setOpen(false)} />
          <div style={styles.dropdown}>
            <div style={styles.dropHeader}>
              <span style={styles.dropTitle}>Alerts</span>
              <div style={styles.dropActions}>
                {count > 0 && (
                  <button style={styles.markAllBtn} onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
                <button style={styles.viewAllBtn} onClick={() => { setOpen(false); navigate('/alerts'); }}>
                  View all →
                </button>
              </div>
            </div>

            {peek.length === 0 ? (
              <div style={styles.dropEmpty}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                <div>No unread alerts</div>
              </div>
            ) : (
              <div>
                {peek.map((alert) => (
                  <div
                    key={alert._id}
                    style={styles.dropItem(alert.read)}
                    onClick={() => { setOpen(false); navigate('/alerts'); }}
                  >
                    <div style={styles.dropItemLeft}>
                      <span style={styles.severityDot(SEVERITY_COLORS[alert.severity])} />
                      <div>
                        <div style={styles.dropItemTitle}>{alert.title}</div>
                        <div style={styles.dropItemMeta}>
                          {alert.deviceName && `${alert.deviceName} · `}
                          {new Date(alert.firedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    {alert.escalated && <span style={styles.escalatedTag}>⚡ Escalated</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  wrap:    { position: 'relative' },
  bell:    { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', position: 'relative', padding: '4px 8px' },
  badge:   { position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: '#fff', fontSize: '9px', fontWeight: 800, borderRadius: '10px', padding: '1px 5px', minWidth: '16px', textAlign: 'center', lineHeight: '14px' },
  overlay: { position: 'fixed', inset: 0, zIndex: 49 },
  dropdown:{ position: 'absolute', right: 0, top: '36px', width: '340px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', boxShadow: '0 20px 60px #00000066', zIndex: 50, overflow: 'hidden' },
  dropHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #334155' },
  dropTitle: { color: '#f1f5f9', fontWeight: 700, fontSize: '14px' },
  dropActions:{ display: 'flex', gap: '8px', alignItems: 'center' },
  markAllBtn:{ background: 'none', border: 'none', color: '#475569', fontSize: '11px', cursor: 'pointer' },
  viewAllBtn:{ background: '#1e3a5f', border: '1px solid #1e40af', color: '#93c5fd', borderRadius: '5px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer' },
  dropEmpty: { color: '#475569', fontSize: '13px', textAlign: 'center', padding: '28px' },
  dropItem: (read) => ({ padding: '12px 16px', borderBottom: '1px solid #1e293b', cursor: 'pointer', background: read ? 'transparent' : '#1e3a5f22', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }),
  dropItemLeft:  { display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 },
  severityDot: (color) => ({ width: '7px', height: '7px', borderRadius: '50%', background: color, marginTop: '4px', flexShrink: 0 }),
  dropItemTitle: { color: '#f1f5f9', fontSize: '12px', fontWeight: 600, lineHeight: 1.4 },
  dropItemMeta:  { color: '#475569', fontSize: '11px', marginTop: '2px' },
  escalatedTag:  { color: '#fbbf24', fontSize: '10px', fontWeight: 700, flexShrink: 0 },
};

export default NotificationBell;