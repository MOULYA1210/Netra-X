import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosInstance';
import { useWebSocket } from '../hooks/useWebSocket';
import RuleCard       from '../components/RuleCard';
import ActionLogTable from '../components/ActionLogTable';

const METRICS = [
  { value: 'status',        label: 'Device Status'    },
  { value: 'responseTime',  label: 'Ping RTT (ms)'    },
  { value: 'packetLoss',    label: 'Packet Loss (%)'  },
  { value: 'cpuUsage',      label: 'CPU Usage (%)'    },
  { value: 'memoryUsage',   label: 'Memory Usage (%)'  },
  { value: 'uptimePercent', label: 'Uptime (%)'        },
  { value: 'anomalyScore',  label: 'Anomaly Score'     },
  { value: 'healthScore',   label: 'Health Score'      },
];

const OPERATORS = [
  { value: 'gt',  label: '> Greater than'  },
  { value: 'lt',  label: '< Less than'     },
  { value: 'gte', label: '≥ Greater or eq' },
  { value: 'lte', label: '≤ Less or eq'    },
  { value: 'eq',  label: '= Equals'        },
  { value: 'neq', label: '≠ Not equals'    },
];

const ACTION_TYPES = [
  { value: 'log',     label: '📝 Log to file'         },
  { value: 'alert',   label: '🔔 Push alert (WS)'     },
  { value: 'retry',   label: '🔄 Auto-retry device'   },
  { value: 'webhook', label: '🌐 Send webhook'         },
  { value: 'email',   label: '📧 Email (Phase 8)'     },
];

const BLANK_RULE = {
  name: '', description: '', enabled: true, scope: 'all',
  condition: { metric: 'responseTime', operator: 'gt', value: 200, consecutiveCount: 1 },
  actions: [{ type: 'alert', config: { severity: 'warning', message: '{{device}} RTT is {{value}}ms (threshold: {{threshold}}ms)' } }],
  throttleSeconds: 300,
};

export default function Automation() {
  const [rules,     setRules]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [logStats,  setLogStats]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editRule,  setEditRule]  = useState(null);
  const [form,      setForm]      = useState(BLANK_RULE);
  const [loading,   setLoading]   = useState(false);
  const [toast,     setToast]     = useState('');
  const [tab,       setTab]       = useState('rules');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [rulesRes, logsRes, statsRes] = await Promise.all([
        api.get('/rules'),
        api.get('/rules/logs?limit=50'),
        api.get('/rules/logs/stats'),
      ]);
      setRules(rulesRes.data.data);
      setLogs(logsRes.data.data);
      setLogStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to load automation data:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── WebSocket: refresh logs when a rule fires ──────────────────────────────
  useWebSocket(useCallback((msg) => {
    if (msg.type === 'RULE_FIRED') {
      showToast(`⚡ Rule fired: ${msg.data?.ruleName} — ${msg.data?.message}`);
      loadData();
    }
    if (['RETRY_STARTED', 'RETRY_RECOVERED', 'RETRY_FAILED'].includes(msg.type)) {
      loadData();
    }
  }, [loadData]));

  // ── Form Handlers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditRule(null);
    setForm(BLANK_RULE);
    setShowForm(true);
  };

  const openEdit = (rule) => {
    setEditRule(rule);
    setForm({
      name: rule.name, description: rule.description,
      enabled: rule.enabled, scope: rule.scope,
      condition: { ...rule.condition },
      actions: rule.actions.map((a) => ({ ...a, config: { ...a.config } })),
      throttleSeconds: rule.throttleSeconds,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return showToast('Rule name is required');
    setLoading(true);
    try {
      if (editRule) {
        await api.put(`/rules/${editRule._id}`, form);
        showToast('✅ Rule updated');
      } else {
        await api.post('/rules', form);
        showToast('✅ Rule created');
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      showToast(`❌ ${err.response?.data?.message || 'Save failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    await api.patch(`/rules/${id}/toggle`);
    loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    await api.delete(`/rules/${id}`);
    showToast('Rule deleted');
    loadData();
  };

  const handleTest = async (rule) => {
    showToast(`⏳ Testing rule: "${rule.name}"...`);
    try {
      const res = await api.post(`/rules/${rule._id}/test`);
      showToast(`✅ ${res.data.message}`);
      loadData();
    } catch (err) {
      showToast(`❌ Test failed: ${err.response?.data?.message}`);
    }
  };

  const updateAction = (idx, field, val) => {
    const actions = [...form.actions];
    if (field === 'type') actions[idx] = { type: val, config: {} };
    else actions[idx] = { ...actions[idx], config: { ...actions[idx].config, [field]: val } };
    setForm((f) => ({ ...f, actions }));
  };

  const addAction = () =>
    setForm((f) => ({ ...f, actions: [...f.actions, { type: 'log', config: { message: 'Rule fired for {{device}}' } }] }));

  const removeAction = (idx) =>
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));

  return (
    <div style={styles.page}>

      {/* Toast */}
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Automation Engine</h1>
          <p style={styles.subtitle}>Define rules that automatically respond to network events</p>
        </div>
        <button style={styles.btnPrimary} onClick={openCreate}>+ New Rule</button>
      </div>

      {/* Stats Bar */}
      {logStats && (
        <div style={styles.statsBar}>
          {[
            { label: 'Total Rules',      val: rules.length,              color: '#38bdf8' },
            { label: 'Active',           val: rules.filter(r=>r.enabled).length, color: '#4ade80' },
            { label: 'Events (24h)',     val: logStats.total,            color: '#fbbf24' },
            { label: 'Critical (24h)',   val: logStats.severity?.critical, color: '#f87171' },
            { label: 'Warnings (24h)',   val: logStats.severity?.warning,  color: '#fb923c' },
          ].map(({ label, val, color }) => (
            <div key={label} style={styles.statItem}>
              <span style={{ color, fontSize: '22px', fontWeight: 800 }}>{val ?? 0}</span>
              <span style={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {['rules', 'logs'].map((t) => (
          <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'rules' ? '📋 Rules' : '📜 Action History'}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {tab === 'rules' && (
        <div>
          {rules.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⚡</div>
              <div style={styles.emptyText}>No automation rules yet</div>
              <div style={styles.emptySub}>Create your first rule to start automating network responses</div>
              <button style={styles.btnPrimary} onClick={openCreate}>Create First Rule</button>
            </div>
          ) : (
            <div style={styles.ruleGrid}>
              {rules.map((rule) => (
                <RuleCard
                  key={rule._id}
                  rule={rule}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onTest={handleTest}
                  onEdit={openEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {tab === 'logs' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>📜 Action History</span>
            <button style={styles.btnRefresh} onClick={loadData}>↻ Refresh</button>
          </div>
          <ActionLogTable logs={logs} />
        </div>
      )}

      {/* Rule Form Modal */}
      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editRule ? 'Edit Rule' : 'New Automation Rule'}</h2>
              <button style={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {/* Name & Description */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Rule Name *</label>
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. High RTT Alert"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <input
                  style={styles.input}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              {/* Condition Section */}
              <div style={styles.sectionHeader}>IF Condition</div>

              <div style={styles.conditionRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Metric</label>
                  <select style={styles.select}
                    value={form.condition.metric}
                    onChange={(e) => setForm((f) => ({ ...f, condition: { ...f.condition, metric: e.target.value } }))}>
                    {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Operator</label>
                  <select style={styles.select}
                    value={form.condition.operator}
                    onChange={(e) => setForm((f) => ({ ...f, condition: { ...f.condition, operator: e.target.value } }))}>
                    {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Value</label>
                  <input style={styles.input} type="text"
                    value={form.condition.value}
                    onChange={(e) => setForm((f) => ({ ...f, condition: { ...f.condition, value: e.target.value } }))}
                    placeholder="e.g. 200 or offline" />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Consecutive Violations</label>
                  <input style={styles.input} type="number" min="1" max="10"
                    value={form.condition.consecutiveCount}
                    onChange={(e) => setForm((f) => ({ ...f, condition: { ...f.condition, consecutiveCount: parseInt(e.target.value) } }))} />
                </div>
              </div>

              {/* Actions Section */}
              <div style={styles.sectionHeader}>
                THEN Actions
                <button style={styles.addActionBtn} onClick={addAction}>+ Add Action</button>
              </div>

              {form.actions.map((action, idx) => (
                <div key={idx} style={styles.actionForm}>
                  <div style={styles.actionFormRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Action Type</label>
                      <select style={styles.select}
                        value={action.type}
                        onChange={(e) => updateAction(idx, 'type', e.target.value)}>
                        {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    {/* Dynamic config fields */}
                    {action.type === 'alert' && (
                      <div style={styles.formGroup}>
                        <label style={styles.label}>
  Message (use {"{{device}}"}, {"{{value}}"})
</label>
                        <input style={styles.input}
                          value={action.config?.message || ''}
                          onChange={(e) => updateAction(idx, 'message', e.target.value)}
                          placeholder="{{device}} alert: {{metric}} is {{value}}" />
                      </div>
                    )}

                    {action.type === 'log' && (
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Log Message</label>
                        <input style={styles.input}
                          value={action.config?.message || ''}
                          onChange={(e) => updateAction(idx, 'message', e.target.value)}
                          placeholder="Rule fired for {{device}}" />
                      </div>
                    )}

                    {action.type === 'webhook' && (
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Webhook URL</label>
                        <input style={styles.input}
                          value={action.config?.url || ''}
                          onChange={(e) => updateAction(idx, 'url', e.target.value)}
                          placeholder="https://hooks.slack.com/..." />
                      </div>
                    )}

                    {action.type === 'retry' && (
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Max Retries</label>
                        <input style={styles.input} type="number" min="1" max="10"
                          value={action.config?.maxRetries || 3}
                          onChange={(e) => updateAction(idx, 'maxRetries', parseInt(e.target.value))} />
                      </div>
                    )}

                    <button style={styles.removeAction} onClick={() => removeAction(idx)}>✕</button>
                  </div>
                </div>
              ))}

              {/* Settings */}
              <div style={styles.sectionHeader}>Settings</div>
              <div style={styles.conditionRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Throttle (seconds)</label>
                  <input style={styles.input} type="number"
                    value={form.throttleSeconds}
                    onChange={(e) => setForm((f) => ({ ...f, throttleSeconds: parseInt(e.target.value) }))} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Scope</label>
                  <select style={styles.select}
                    value={form.scope}
                    onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
                    <option value="all">All Devices</option>
                    <option value="type">By Device Type</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Enabled</label>
                  <select style={styles.select}
                    value={String(form.enabled)}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.value === 'true' }))}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.btnCancel} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={styles.btnSave(loading)} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Saving...' : editRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page:    { maxWidth: '1300px', margin: '0 auto', padding: '28px 24px' },
  toast:   { position: 'fixed', top: '20px', right: '20px', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '12px 20px', borderRadius: '8px', zIndex: 9999, fontSize: '13px', maxWidth: '400px' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title:   { color: '#f1f5f9', fontSize: '26px', fontWeight: 800, margin: 0 },
  subtitle:{ color: '#475569', fontSize: '14px', marginTop: '4px' },
  statsBar:{ display: 'flex', gap: '24px', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px 24px', marginBottom: '20px', flexWrap: 'wrap' },
  statItem:{ display: 'flex', flexDirection: 'column', gap: '3px' },
  statLabel:{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tabs:    { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '0' },
  tab: (a) => ({ background: 'none', border: 'none', borderBottom: `2px solid ${a ? '#3b82f6' : 'transparent'}`, color: a ? '#93c5fd' : '#475569', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s', marginBottom: '-1px' }),
  ruleGrid:{ display: 'grid', gap: '14px' },
  emptyState:{ textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyText: { color: '#f1f5f9', fontSize: '18px', fontWeight: 700, marginBottom: '8px' },
  emptySub:  { color: '#475569', fontSize: '14px', marginBottom: '20px' },
  card:    { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' },
  cardHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  cardTitle: { color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' },
  btnPrimary:{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnRefresh:{ background: '#0f172a', border: '1px solid #334155', color: '#64748b', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal:   { background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #334155' },
  modalTitle: { color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: 0 },
  closeBtn:   { background: 'none', border: 'none', color: '#475569', fontSize: '18px', cursor: 'pointer' },
  modalBody:  { padding: '20px 24px' },
  modalFooter:{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  sectionHeader:{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '20px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  conditionRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:    { color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input:    { background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none' },
  select:   { background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none' },
  actionForm:   { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '10px' },
  actionFormRow:{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' },
  addActionBtn: { background: '#1e3a5f', border: '1px solid #1e40af', color: '#93c5fd', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer' },
  removeAction: { background: '#450a0a', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '5px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-end', flexShrink: 0 },
  btnCancel:{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' },
  btnSave: (dis) => ({ background: dis ? '#1e3a5f' : '#2563eb', color: dis ? '#475569' : '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: dis ? 'not-allowed' : 'pointer' }),
};