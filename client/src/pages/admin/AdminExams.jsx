import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { PageHead } from '../../components/ui.jsx';

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({
    code: '', title: '', exam_family: 'IBPS_SO_IT', type: 'subject', subject: '',
    duration_sec: 600, marks_per_q: 1, negative_per_q: 0.25, max_hints: 3, stage: 'prelims'
  });
  const [catalog, setCatalog] = useState({ families: [], types: [] });
  const nav = useNavigate();
  const toast = useToast();

  function load() { api('/api/admin/exams').then((d) => setExams(d.exams || [])).catch(() => {}); }
  useEffect(load, []);
  useEffect(() => { api('/api/exams/catalog').then(setCatalog).catch(() => {}); }, []);

  const list = useMemo(() => exams.filter((e) =>
    !q || `${e.title} ${e.code} ${e.subject || ''} ${e.exam_family}`.toLowerCase().includes(q.toLowerCase())
  ), [exams, q]);

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
        <button className="btn btn-amber" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'New paper'}</button>
      </PageHead>

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
              <label className="fld">Hint cap</label>
              <input type="number" value={form.max_hints} onChange={(e) => setForm({ ...form, max_hints: Number(e.target.value) })} />
            </div>
          </div>
          <button className="btn btn-violet" style={{ marginTop: 14 }} type="submit">Create paper</button>
        </form>
      )}

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Paper</th><th>Type</th><th>Q</th><th>Hints</th><th>Live</th><th>Sat</th><th></th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>
                  <b>{e.title}</b>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.code} · {(e.exam_family || '').replaceAll('_', ' ')}</div>
                </td>
                <td><span className={`tag ${e.type === 'high_influence' ? 'gold' : e.type === 'full' ? 'ink' : ''}`}>{e.type}</span></td>
                <td>{e.question_count}</td>
                <td>{e.max_hints}</td>
                <td>{e.live_count ? <><span className="live-dot" />{e.live_count}</> : '—'}</td>
                <td>{e.attempt_count}</td>
                <td>
                  <div className="row-actions">
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
