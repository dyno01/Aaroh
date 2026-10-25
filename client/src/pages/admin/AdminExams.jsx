import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Lightbulb, Zap, Check, ChevronDown, Cloud, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { PageHead } from '../../components/ui.jsx';

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [open, setOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [b2Status, setB2Status] = useState(null);
  const [b2Syncing, setB2Syncing] = useState(false);
  const [batchHint, setBatchHint] = useState({
    scope: 'all',
    exam_family: '',
    max_hints: 3,
    hint_mode: 'lifeline',
    hints_enabled: true
  });
  const [form, setForm] = useState({
    code: '', title: '', exam_family: 'IBPS_SO_IT', type: 'subject', subject: '',
    duration_sec: 600, marks_per_q: 1, negative_per_q: 0.25, max_hints: 3, stage: 'prelims'
  });
  const [catalog, setCatalog] = useState({ families: [], types: [] });
  const nav = useNavigate();
  const toast = useToast();

  function load() {
    api('/api/admin/exams').then((d) => setExams(d.exams || [])).catch(() => {});
    api('/api/admin/b2/status').then(setB2Status).catch(() => {});
  }
  useEffect(load, []);
  useEffect(() => { api('/api/exams/catalog').then(setCatalog).catch(() => {}); }, []);

  const list = useMemo(() => exams.filter((e) =>
    !q || `${e.title} ${e.code} ${e.subject || ''} ${e.exam_family}`.toLowerCase().includes(q.toLowerCase())
  ), [exams, q]);

  async function syncFolder() {
    setSyncing(true);
    try {
      const r = await api('/api/import/sync-folder', { method: 'POST' });
      toast.push(`✓ Synced ${r.imported} papers (${r.total_questions} questions) from test/ folder!`);
      load();
    } catch (e) {
      toast.push(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function syncB2Cloud() {
    setB2Syncing(true);
    try {
      const r = await api('/api/admin/b2/sync-to-cloud', { method: 'POST' });
      toast.push(`✓ ${r.message || 'Synced all papers to Backblaze B2!'}`);
      load();
    } catch (err) {
      toast.push(`B2 Sync failed: ${err.message}`);
    } finally {
      setB2Syncing(false);
    }
  }

  async function applyBatchHints(customOverrides) {
    setBatchSaving(true);
    const payload = { ...batchHint, ...(customOverrides || {}) };
    try {
      const res = await api('/api/admin/exams/batch-hints', {
        method: 'POST',
        body: payload
      });
      toast.push(`✓ ${res.message || 'Updated hints for all papers!'}`);
      load();
      if (!customOverrides) setHintOpen(false);
    } catch (err) {
      toast.push(`Error: ${err.message}`);
    } finally {
      setBatchSaving(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    try {
      const r = await api('/api/admin/exams', { method: 'POST', body: form });
      toast.push('Paper created');
      nav(`/app/admin/exams/${r.id}`);
    } catch (ex) { toast.push(ex.message); }
  }

  async function del(id) {
    if (!window.confirm('Delete this paper and its questions?')) return;
    await api(`/api/admin/exams/${id}`, { method: 'DELETE' });
    toast.push('Paper removed');
    load();
  }

  return (
    <div className="rise">
      <PageHead kicker="Bank" title="Papers" lead="Every published paper is visible to students. Hint caps and permissions can change live.">
        <label className="search">
          <Search size={16} color="#8A8378" />
          <input placeholder="Search code or title" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button
          className="btn btn-violet"
          onClick={() => { setHintOpen((v) => !v); setOpen(false); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Change hints and lifelines across all papers at once"
        >
          <Lightbulb size={14} />
          {hintOpen ? 'Close hint controls' : '⚡ Change hints at once'}
        </button>
        <button
          className="btn btn-line"
          onClick={syncB2Cloud}
          disabled={b2Syncing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Sync all papers to Backblaze B2 cloud storage so they never disappear on redeployment"
        >
          <Cloud size={14} className={b2Syncing ? 'spin' : ''} />
          {b2Syncing ? 'Syncing B2…' : `☁ Backblaze B2 (${b2Status?.filesCount ?? 17})`}
        </button>
        <button
          className="btn btn-line"
          onClick={syncFolder}
          disabled={syncing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Scan and import all papers from test/ directory"
        >
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {syncing ? 'Syncing test/…' : 'Sync test/ folder'}
        </button>
        <button className="btn btn-amber" onClick={() => { setOpen((v) => !v); setHintOpen(false); }}>
          {open ? 'Close' : 'New paper'}
        </button>
      </PageHead>


      {/* Global / Batch Hint Controls */}
      {hintOpen && (
        <div className="card" style={{ marginTop: 12, border: '2px solid var(--violet)', background: 'linear-gradient(180deg, rgba(79,70,229,0.04) 0%, rgba(255,255,255,0.95) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="tag violet" style={{ fontSize: 11, fontWeight: 700 }}>GLOBAL HINT CONTROL</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Applies instantly to {batchHint.scope === 'all' ? `all ${exams.length} papers` : `${batchHint.exam_family || 'selected'} papers`}</span>
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: 18 }}>Change Hints For All Papers At Once</h3>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchHints({ max_hints: 3, hint_mode: 'lifeline', hints_enabled: true })}
                title="Set 3 Lifelines on all papers"
              >
                🎯 3 Lifelines (Default)
              </button>
              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchHints({ max_hints: 5, hint_mode: 'lifeline', hints_enabled: true })}
                title="Set 5 Lifelines on all papers"
              >
                💎 5 Lifelines (Generous)
              </button>
              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchHints({ max_hints: 3, hint_mode: 'per_question', hints_enabled: true })}
                title="Set 3 hints per question on all papers"
              >
                🪜 3 Hints/Q Ladder
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={batchSaving}
                onClick={() => applyBatchHints({ max_hints: 0, hints_enabled: false })}
                title="Freeze hints / strict mode across all papers"
              >
                🧊 Freeze (0 hints)
              </button>
            </div>
          </div>

          <div className="settings-grid" style={{ background: '#fff', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div>
              <label className="fld">Apply To Target</label>
              <select
                value={batchHint.scope === 'family' ? `family:${batchHint.exam_family}` : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') setBatchHint({ ...batchHint, scope: 'all', exam_family: '' });
                  else setBatchHint({ ...batchHint, scope: 'family', exam_family: val.replace('family:', '') });
                }}
              >
                <option value="all">⚡ All Papers Everywhere ({exams.length} papers)</option>
                {(catalog.families || []).map((f) => (
                  <option key={f.id} value={`family:${f.id}`}>Only {f.label} papers</option>
                ))}
              </select>
            </div>

            <div>
              <label className="fld">Hint Strategy Mode</label>
              <select
                value={batchHint.hint_mode}
                onChange={(e) => setBatchHint({ ...batchHint, hint_mode: e.target.value })}
              >
                <option value="lifeline">🎯 Lifelines Budget (e.g. 3 total hints for whole paper)</option>
                <option value="per_question">🪜 Per-Question Ladder (up to N hints on each question)</option>
              </select>
            </div>

            <div>
              <label className="fld">Hint Cap ({batchHint.hint_mode === 'lifeline' ? 'Lifelines Total' : 'Hints Per Question'})</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={batchHint.max_hints}
                  onChange={(e) => setBatchHint({ ...batchHint, max_hints: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 800, fontSize: 16, minWidth: 28, textAlign: 'center' }}>{batchHint.max_hints}</span>
              </div>
            </div>

            <div>
              <label className="fld">Hints Allowed</label>
              <select
                value={batchHint.hints_enabled ? '1' : '0'}
                onChange={(e) => setBatchHint({ ...batchHint, hints_enabled: e.target.value === '1' })}
              >
                <option value="1">✓ Enabled (Students can use hints)</option>
                <option value="0">✕ Disabled (Freeze hints for all)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setHintOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-violet"
              disabled={batchSaving}
              onClick={() => applyBatchHints()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Zap size={14} />
              {batchSaving ? 'Applying to papers…' : `Save & Apply to ${batchHint.scope === 'all' ? `all ${exams.length} papers` : 'selected papers'} now`}
            </button>
          </div>
        </div>
      )}

      {open && (
        <form className="card" style={{ marginTop: 8 }} onSubmit={create}>
          <h3>New paper</h3>
          <div className="settings-grid">
            {[['code', 'Code'], ['title', 'Title'], ['subject', 'Subject']].map(([k, l]) => (
              <div key={k}><label className="fld">{l}</label><input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k !== 'subject'} /></div>
            ))}
            <div>
              <label className="fld">Family</label>
              <select value={form.exam_family} onChange={(e) => setForm({ ...form, exam_family: e.target.value })}>
                {(catalog.families.length ? catalog.families : [{ id: 'IBPS_SO_IT', label: 'IBPS SO IT' }]).map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fld">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {(catalog.types.length ? catalog.types : [
                  { id: 'subject', label: 'Subject-wise' },
                  { id: 'full', label: 'Full mock' },
                  { id: 'high_influence', label: 'High influence' }
                ]).map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fld">Duration (sec)</label>
              <input type="number" value={form.duration_sec} onChange={(e) => setForm({ ...form, duration_sec: Number(e.target.value) })} />
            </div>
            <div>
              <label className="fld">Hint Strategy</label>
              <select value={form.hint_mode || 'lifeline'} onChange={(e) => setForm({ ...form, hint_mode: e.target.value })}>
                <option value="lifeline">🎯 Lifelines Pool (Total across paper)</option>
                <option value="per_question">🪜 Per-Question Ladder (On each Q)</option>
              </select>
            </div>
            <div>
              <label className="fld">Hint Cap / Lifelines</label>
              <input type="number" min="0" max="10" value={form.max_hints} onChange={(e) => setForm({ ...form, max_hints: Number(e.target.value) })} />
            </div>
          </div>
          <button className="btn btn-violet" style={{ marginTop: 14 }} type="submit">Create paper</button>
        </form>
      )}

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Paper</th><th>Type</th><th>Q</th><th>Hint Mode</th><th>Live</th><th>Sat</th><th></th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>
                  <b>{e.title}</b>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.code} · {(e.exam_family || '').replaceAll('_', ' ')}</div>
                </td>
                <td><span className={`tag ${e.type === 'high_influence' ? 'gold' : e.type === 'full' ? 'ink' : ''}`}>{e.type}</span></td>
                <td>{e.question_count}</td>
                <td>
                  <span className={`tag ${e.hint_mode === 'per_question' ? 'ink' : 'green'}`} style={{ fontSize: 11 }}>
                    {e.hint_mode === 'per_question' ? `🪜 ${e.max_hints}/Q` : `🎯 ${e.max_hints} Lifelines`}
                  </span>
                </td>
                <td>{e.live_count ? <><span className="live-dot" />{e.live_count}</> : '—'}</td>
                <td>{e.attempt_count}</td>
                <td>
                  <div className="row-actions">
                    <a
                      className="btn btn-sm btn-line"
                      href={`/api/admin/exams/${e.id}/export.csv`}
                      download
                      title="Download paper CSV backup"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Download size={12} /> CSV
                    </a>
                    <button className="btn btn-sm btn-violet" onClick={() => nav(`/app/admin/exams/${e.id}`)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => del(e.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="lead" style={{ padding: 12 }}>No papers match.</p>}
      </div>
    </div>
  );
}
