import React, { useEffect, useState } from 'react';
import { Upload, RefreshCw, FolderSync } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { PageHead } from '../../components/ui.jsx';

const emptyMeta = {
  exam_code: '',
  exam_title: '',
  exam_family: 'IBPS_SO_IT',
  exam_type: 'subject',
  family_label: '',
  type_label: '',
  stage: 'prelims',
  subject: '',
  duration_min: 10,
  marks_per_q: 1,
  negative: 0.25,
  max_hints: 3
};

export default function AdminImport() {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [jsonText, setJsonText] = useState('');
  const [summary, setSummary] = useState(null);
  const [hot, setHot] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [meta, setMeta] = useState(emptyMeta);
  const [catalog, setCatalog] = useState({ families: [], types: [] });
  const toast = useToast();

  useEffect(() => {
    api('/api/exams/catalog').then(setCatalog).catch(() => {});
  }, []);

  async function syncFolder() {
    setSyncing(true);
    try {
      const r = await api('/api/import/sync-folder', { method: 'POST' });
      toast.push(`✓ Synced ${r.imported} papers (${r.total_questions} questions) from test/ folder!`);
    } catch (e) {
      toast.push(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function fillMeta(papers) {
    const p = papers?.[0];
    if (!p) return;
    setMeta({
      exam_code: p.exam_code,
      exam_title: p.exam_title,
      exam_family: p.exam_family,
      exam_type: p.exam_type,
      family_label: p.family_label || '',
      type_label: p.type_label || '',
      stage: p.stage || 'prelims',
      subject: p.subject || '',
      duration_min: p.duration_min,
      marks_per_q: p.marks_per_q,
      negative: p.negative,
      max_hints: p.max_hints
    });
  }

  async function doPreview(f) {
    const fd = new FormData();
    fd.append('file', f);
    const r = await api('/api/import/preview', { method: 'POST', body: fd, isForm: true });
    setPreview(r);
    fillMeta(r.papers);
  }

  function takeFile(f) {
    if (!f) return;
    setFile(f);
    doPreview(f).catch((err) => toast.push(err.message));
  }

  function set(k, v) {
    setMeta((m) => ({ ...m, [k]: v }));
  }

  async function commit() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('overrides', JSON.stringify(meta));
    const r = await api('/api/import/commit', { method: 'POST', body: fd, isForm: true });
    setSummary(r.summary);
    toast.push(`Imported ${r.summary.length} paper(s)`);
  }

  async function commitJson() {
    const parsed = JSON.parse(jsonText);
    const r = await api('/api/import/json', { method: 'POST', body: { ...parsed, overrides: meta.exam_title ? meta : undefined } });
    setSummary(r.summary);
    toast.push('JSON bank committed');
  }

  return (
    <div className="rise">
      <PageHead
        kicker="CSV · JSON"
        title="Import a paper"
        lead="Drop a file. We fill the paper details from the template — change anything before you commit. A new exam_family or exam_type becomes a Tests button."
      />

      <div className="card" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: 'linear-gradient(135deg, rgba(91, 69, 234, 0.05), rgba(240, 180, 41, 0.05))', border: '1.5px solid var(--violet-soft-2)' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
            <FolderSync size={18} color="var(--violet)" />
            <span>Sync Papers from test/ Folder</span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
            Whenever you add or update CSV files in the <code>test/</code> directory (e.g. debugging, full, subject), click here to immediately auto-import all new papers without restarting the server.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-violet"
          onClick={syncFolder}
          disabled={syncing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '8px 16px' }}
        >
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {syncing ? 'Scanning & Syncing…' : 'Sync test/ Folder Now'}
        </button>
      </div>

      <div
        className={`card drop ${hot ? 'hot' : ''}`}
        style={{ marginTop: 12 }}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); takeFile(e.dataTransfer.files?.[0]); }}
      >
        <div className="ico" style={{ margin: '0 auto 10px' }}><Upload size={18} /></div>
        <p style={{ fontWeight: 700, margin: 0 }}>{file ? file.name : 'Drop CSV or JSON here'}</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          exam_code, exam_title, exam_type, exam_family, marks_per_q, marks, negative, max_hints, question, option_a–d, correct, hint, hint_2, hint_3, explanation
        </p>
        <label className="btn btn-sm btn-line" style={{ marginTop: 8, display: 'inline-flex' }}>
          Choose file
          <input type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(e) => takeFile(e.target.files?.[0])} />
        </label>
      </div>

      {preview && (
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>Paper details — from the file, still editable</h3>
            <p className="lead" style={{ margin: '0 0 12px' }}>{preview.count} questions · {preview.kind}. Change family or style here if the template was off.</p>
            <div className="settings-grid">
              <div><label className="fld">Code</label><input value={meta.exam_code} onChange={(e) => set('exam_code', e.target.value)} /></div>
              <div><label className="fld">Title</label><input value={meta.exam_title} onChange={(e) => set('exam_title', e.target.value)} /></div>
              <div>
                <label className="fld">Exam button</label>
                <select value={meta.exam_family} onChange={(e) => set('exam_family', e.target.value)}>
                  {catalog.families.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  {meta.exam_family && !catalog.families.some((f) => f.id === meta.exam_family) && (
                    <option value={meta.exam_family}>{meta.exam_family}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="fld">Or new exam name</label>
                <input placeholder="RBI Grade B" value={meta.family_label} onChange={(e) => set('family_label', e.target.value)} />
              </div>
              <div>
                <label className="fld">Paper style</label>
                <select value={meta.exam_type} onChange={(e) => set('exam_type', e.target.value)}>
                  {catalog.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  {meta.exam_type && !catalog.types.some((t) => t.id === meta.exam_type) && (
                    <option value={meta.exam_type}>{meta.exam_type}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="fld">Or new style name</label>
                <input placeholder="Previous year" value={meta.type_label} onChange={(e) => set('type_label', e.target.value)} />
              </div>
              <div><label className="fld">Subject</label><input value={meta.subject} onChange={(e) => set('subject', e.target.value)} /></div>
              <div><label className="fld">Stage</label><input value={meta.stage} onChange={(e) => set('stage', e.target.value)} /></div>
              <div><label className="fld">Minutes</label><input type="number" value={meta.duration_min} onChange={(e) => set('duration_min', Number(e.target.value))} /></div>
              <div><label className="fld">Marks / question</label><input type="number" step="0.25" value={meta.marks_per_q} onChange={(e) => set('marks_per_q', Number(e.target.value))} /></div>
              <div><label className="fld">Negative / wrong</label><input type="number" step="0.05" value={meta.negative} onChange={(e) => set('negative', Number(e.target.value))} /></div>
              <div><label className="fld">Hint cap</label><input type="number" min="0" max="3" value={meta.max_hints} onChange={(e) => set('max_hints', Number(e.target.value))} /></div>
            </div>
            <button className="btn btn-amber" style={{ marginTop: 14 }} onClick={() => commit().catch((e) => toast.push(e.message))}>Commit import</button>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3>Preview · first rows</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>{preview.headers.slice(0, 8).map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, i) => (
                    <tr key={i}>{preview.headers.slice(0, 8).map((h) => <td key={h}>{String(row[h] || '').slice(0, 48)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Or paste JSON</h3>
        <textarea
          rows={10}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{ "exam": { "code": "SEBI-P1-01", "title": "…", "exam_family": "SEBI_GRADE_A", "type": "full", "marks_per_q": 1 }, "questions": [ { "q_en": "…", "option_a": "…", "correct": "a" } ] }'
        />
        <button className="btn btn-violet" style={{ marginTop: 10 }} onClick={() => commitJson().catch((e) => toast.push(e.message))}>
          Commit JSON
        </button>
      </div>

      {summary && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Imported</h3>
          {summary.map((s) => (
            <div key={s.code} className="row-item" style={{ cursor: 'default' }}>
              <div style={{ flex: 1 }}><b>{s.title}</b><div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.code}</div></div>
              <span className="tag green">{s.added} questions</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-2)' }}>
        <h3>How to write a paper</h3>
        <p>One CSV row = one question. Repeat <b>exam_code</b>. New <b>exam_family</b> or <b>exam_type</b> creates a Tests button. Optional <b>family_label</b> / <b>type_label</b> set the name students see. <b>marks_per_q</b> for the paper, <b>marks</b> on a row to override one question.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="btn btn-sm btn-amber" href="/aaroh-questions.csv" download>CSV template</a>
          <a className="btn btn-sm btn-violet" href="/aaroh-questions.json" download>JSON template</a>
        </div>
      </div>
    </div>
  );
}
