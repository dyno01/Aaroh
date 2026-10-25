import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  RefreshCw,
  FolderSync,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  ArrowRight,
  Trash2,
  HardDrive,
  Eye,
  Sparkles
} from 'lucide-react';
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
  const [tab, setTab] = useState('single'); // 'single' | 'bulk' | 'json'
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [summary, setSummary] = useState(null);
  const [hot, setHot] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [meta, setMeta] = useState(emptyMeta);
  const [catalog, setCatalog] = useState({ families: [], types: [] });

  // Bulk mode states
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkPreviews, setBulkPreviews] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState(null);

  const toast = useToast();
  const nav = useNavigate();

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
      exam_code: p.exam_code || '',
      exam_title: p.exam_title || '',
      exam_family: p.exam_family || 'IBPS_SO_IT',
      exam_type: p.exam_type || 'subject',
      family_label: p.family_label || '',
      type_label: p.type_label || '',
      stage: p.stage || 'prelims',
      subject: p.subject || '',
      duration_min: p.duration_min || 10,
      marks_per_q: p.marks_per_q ?? 1,
      negative: p.negative ?? 0.25,
      max_hints: p.max_hints ?? 3
    });
  }

async function scanFilesRecursively(dataTransfer) {
  const items = dataTransfer.items;
  if (!items || !items.length) {
    return Array.from(dataTransfer.files || []);
  }

  const queue = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry();
      if (entry) queue.push(entry);
    }
  }

  if (!queue.length) {
    return Array.from(dataTransfer.files || []);
  }

  const collectedFiles = [];

  async function readEntriesPromise(reader) {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  }

  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      const lower = (file.name || '').toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.json') || lower.endsWith('.zip')) {
        collectedFiles.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let entries = await readEntriesPromise(reader);
      while (entries && entries.length > 0) {
        queue.push(...entries);
        entries = await readEntriesPromise(reader);
      }
    }
  }

  return collectedFiles;
}

  async function doPreview(f) {
    const fd = new FormData();
    fd.append('file', f);
    const r = await api('/api/import/preview', { method: 'POST', body: fd, isForm: true });
    setPreview(r);
    fillMeta(r.papers);
  }

  function takeSingleFile(f) {
    if (!f) return;
    setFile(f);
    setSummary(null);
    doPreview(f).catch((err) => toast.push(err.message));
  }

  async function handleDrop(e, targetTab = 'single') {
    e.preventDefault();
    setHot(false);
    let files = [];
    try {
      files = await scanFilesRecursively(e.dataTransfer);
    } catch {
      files = Array.from(e.dataTransfer.files || []);
    }
    if (!files.length) {
      toast.push('No .csv, .json, or .zip files found in dropped folder or files.');
      return;
    }

    const firstIsZip = (files[0].name || '').toLowerCase().endsWith('.zip');
    if (files.length > 1 || targetTab === 'bulk' || firstIsZip) {
      setTab('bulk');
      loadBulkFiles(files);
    } else {
      takeSingleFile(files[0]);
    }
  }

  function set(k, v) {
    setMeta((m) => ({ ...m, [k]: v }));
  }

  async function commitSingle() {
    if (!file) return;
    setCommitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('overrides', JSON.stringify(meta));
      fd.append('replace', '1');
      fd.append('saveToDisk', '1');
      const r = await api('/api/import/commit', { method: 'POST', body: fd, isForm: true });
      setSummary(r.summary);
      toast.push(`✓ Imported & saved ${r.summary.length} paper(s) to database and test/ folder (marked as NEW)`);
    } catch (e) {
      toast.push(`Import failed: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  }

  async function loadBulkFiles(filesList) {
    const valid = Array.from(filesList).filter((f) => {
      const name = (f.name || '').toLowerCase();
      return name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.zip');
    });
    if (!valid.length) {
      toast.push('Please drop or select .csv, .json, or .zip files, or choose a folder.');
      return;
    }
    setBulkFiles(valid);
    setBulkSummary(null);
    setBulkLoading(true);

    try {
      const fd = new FormData();
      valid.forEach((f) => fd.append('files', f));
      const r = await api('/api/import/bulk-preview', { method: 'POST', body: fd, isForm: true });
      setBulkPreviews(r.files || []);
    } catch (e) {
      toast.push(`Bulk preview failed: ${e.message}`);
    } finally {
      setBulkLoading(false);
    }
  }

  async function commitBulk() {
    if (!bulkFiles.length) return;
    setBulkImporting(true);
    try {
      const fd = new FormData();
      bulkFiles.forEach((f) => fd.append('files', f));
      fd.append('replace', '1');
      fd.append('saveToDisk', '1');
      const r = await api('/api/import/bulk-commit', { method: 'POST', body: fd, isForm: true });
      setBulkSummary(r);
      toast.push(`✓ Bulk imported ${r.totalPapers} paper(s) (${r.totalQuestions} questions)!`);
    } catch (e) {
      toast.push(`Bulk import failed: ${e.message}`);
    } finally {
      setBulkImporting(false);
    }
  }

  async function commitJson() {
    if (!jsonText.trim()) return;
    setCommitting(true);
    try {
      const parsed = JSON.parse(jsonText);
      const r = await api('/api/import/json', {
        method: 'POST',
        body: {
          ...parsed,
          overrides: meta.exam_title ? meta : undefined,
          replace: true,
          saveToDisk: true
        }
      });
      setSummary(r.summary);
      toast.push('✓ JSON bank imported and saved to test/ folder');
    } catch (e) {
      toast.push(`JSON import failed: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="rise">
      <PageHead
        kicker="CSV · JSON · BULK"
        title="Import Papers"
        lead="Import single or multiple papers directly into Aaroh. Papers are automatically saved in the database and persisted to the test/ directory so they are never lost on restarts or syncs."
      />

      {/* Sync folder status card */}
      <div
        className="card"
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'linear-gradient(135deg, rgba(91, 69, 234, 0.05), rgba(240, 180, 41, 0.05))',
          border: '1.5px solid var(--violet-soft-2)'
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
            <FolderSync size={18} color="var(--violet)" />
            <span>Persistent Storage in test/ Folder</span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
            All papers imported from this page are immediately written into the <code>test/</code> directory on disk, ensuring they persist permanently like all standard papers.
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

      {/* Mode navigation tabs */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'single' ? 'btn-violet' : 'btn-line'}`}
          onClick={() => setTab('single')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FileText size={15} />
          Single Paper (Inspect & Edit)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'bulk' ? 'btn-violet' : 'btn-line'}`}
          onClick={() => setTab('bulk')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Layers size={15} />
          Bulk Import (Multiple Files)
          {bulkFiles.length > 0 && <span className="tag ink" style={{ marginLeft: 4, padding: '2px 6px', fontSize: 11 }}>{bulkFiles.length}</span>}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'json' ? 'btn-violet' : 'btn-line'}`}
          onClick={() => setTab('json')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          Paste Raw JSON
        </button>
      </div>

      {/* SINGLE PAPER TAB */}
      {tab === 'single' && (
        <div style={{ marginTop: 12 }}>
          <div
            className={`card drop ${hot ? 'hot' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setHot(true); }}
            onDragLeave={() => setHot(false)}
            onDrop={(e) => handleDrop(e, 'single')}
          >
            <div className="ico" style={{ margin: '0 auto 10px' }}><Upload size={20} /></div>
            <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
              {file ? file.name : 'Drop a CSV, JSON, or ZIP paper here'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              (Tip: If you drop a ZIP or multiple files, it automatically unpacks in Bulk Import mode!)
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
              <label className="btn btn-sm btn-line" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                Choose file / ZIP
                <input
                  type="file"
                  accept=".csv,.json,.zip,text/csv,application/json,application/zip"
                  hidden
                  onChange={(e) => takeSingleFile(e.target.files?.[0])}
                />
              </label>
              {file && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => { setFile(null); setPreview(null); setSummary(null); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Single preview & edit */}
          {preview && (
            <>
              {/* Quick action bar */}
              <div
                className="card"
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  background: 'var(--paper)',
                  border: '1.5px solid var(--violet-soft-2)'
                }}
              >
                <div>
                  <span className="tag green" style={{ fontWeight: 700, fontSize: 12, marginRight: 8 }}>
                    ✓ {preview.count} Questions detected
                  </span>
                  <span className="tag ink" style={{ fontSize: 12 }}>{preview.kind.toUpperCase()}</span>
                  <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4, color: 'var(--ink)' }}>
                    {meta.exam_title || file?.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <HardDrive size={13} /> Will be saved to SQLite and <code>test/{meta.exam_type || 'subject'}/{meta.exam_code || 'paper'}.csv</code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-violet"
                    onClick={commitSingle}
                    disabled={committing}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '10px 20px' }}
                  >
                    <Sparkles size={16} />
                    {committing ? 'Saving & Importing…' : 'Save & Import Paper Now'}
                  </button>
                </div>
              </div>

              {/* Editable Paper metadata */}
              <div className="card" style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Paper details — from file, still editable</h3>
                    <p className="lead" style={{ margin: '2px 0 0' }}>Adjust button, time, marks or hint limits before committing.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-amber"
                    onClick={commitSingle}
                    disabled={committing}
                  >
                    {committing ? 'Saving…' : 'Save & Commit'}
                  </button>
                </div>

                <div className="settings-grid">
                  <div><label className="fld">Code</label><input value={meta.exam_code} onChange={(e) => set('exam_code', e.target.value)} /></div>
                  <div><label className="fld">Title</label><input value={meta.exam_title} onChange={(e) => set('exam_title', e.target.value)} /></div>
                  <div>
                    <label className="fld">Exam family button</label>
                    <select value={meta.exam_family} onChange={(e) => set('exam_family', e.target.value)}>
                      {catalog.families.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                      {meta.exam_family && !catalog.families.some((f) => f.id === meta.exam_family) && (
                        <option value={meta.exam_family}>{meta.exam_family}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="fld">Or new exam name</label>
                    <input placeholder="e.g. RBI Grade B" value={meta.family_label} onChange={(e) => set('family_label', e.target.value)} />
                  </div>
                  <div>
                    <label className="fld">Paper style / type</label>
                    <select value={meta.exam_type} onChange={(e) => set('exam_type', e.target.value)}>
                      {catalog.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      {meta.exam_type && !catalog.types.some((t) => t.id === meta.exam_type) && (
                        <option value={meta.exam_type}>{meta.exam_type}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="fld">Or new style name</label>
                    <input placeholder="e.g. Previous Year" value={meta.type_label} onChange={(e) => set('type_label', e.target.value)} />
                  </div>
                  <div><label className="fld">Subject</label><input value={meta.subject} onChange={(e) => set('subject', e.target.value)} /></div>
                  <div><label className="fld">Stage</label><input value={meta.stage} onChange={(e) => set('stage', e.target.value)} /></div>
                  <div><label className="fld">Minutes</label><input type="number" value={meta.duration_min} onChange={(e) => set('duration_min', Number(e.target.value))} /></div>
                  <div><label className="fld">Marks / question</label><input type="number" step="0.25" value={meta.marks_per_q} onChange={(e) => set('marks_per_q', Number(e.target.value))} /></div>
                  <div><label className="fld">Negative / wrong</label><input type="number" step="0.05" value={meta.negative} onChange={(e) => set('negative', Number(e.target.value))} /></div>
                  <div><label className="fld">Hint cap (0–10)</label><input type="number" min="0" max="10" value={meta.max_hints} onChange={(e) => set('max_hints', Number(e.target.value))} /></div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <button className="btn btn-amber" onClick={commitSingle} disabled={committing}>
                    {committing ? 'Saving & Committing…' : 'Save & Import Paper'}
                  </button>
                </div>
              </div>

              {/* Sample preview table */}
              <div className="card" style={{ marginTop: 12 }}>
                <h3>Preview · First rows</h3>
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table className="table">
                    <thead>
                      <tr>{preview.headers.slice(0, 8).map((h) => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.sample.map((row, i) => (
                        <tr key={i}>
                          {preview.headers.slice(0, 8).map((h) => <td key={h}>{String(row[h] || '').slice(0, 48)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Success summary for Single import */}
          {summary && (
            <div className="card" style={{ marginTop: 16, border: '2px solid var(--green)', background: 'rgba(34, 197, 94, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={24} color="var(--green)" />
                <h3 style={{ margin: 0, color: 'var(--green)' }}>Paper Successfully Imported & Saved!</h3>
              </div>
              <p style={{ margin: '6px 0 12px', fontSize: 14, color: 'var(--ink)' }}>
                Your paper is active in the database and written to disk. It will always remain intact even after server restarts or folder syncs.
              </p>

              {summary.map((s) => (
                <div
                  key={s.code}
                  className="row-item"
                  style={{
                    cursor: 'default',
                    marginBottom: 8,
                    background: 'var(--paper)',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--line)'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Code: <b>{s.code}</b> · {s.added} questions · Family: {s.exam_family} · Style: {s.type}
                    </div>
                    {s.filePath && (
                      <div style={{ fontSize: 12, color: 'var(--violet)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <HardDrive size={13} /> Saved to disk: <code>{s.filePath}</code>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-violet"
                      onClick={() => nav(`/app/admin/exams/${s.examId}`)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      Edit Paper <ArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-line"
                      onClick={() => nav('/app/admin/exams')}
                    >
                      View in Papers
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BULK IMPORT TAB */}
      {tab === 'bulk' && (
        <div style={{ marginTop: 12 }}>
          {/* Dropzone for Multiple Files */}
          <div
            className={`card drop ${hot ? 'hot' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setHot(true); }}
            onDragLeave={() => setHot(false)}
            onDrop={(e) => handleDrop(e, 'bulk')}
          >
            <div className="ico" style={{ margin: '0 auto 10px' }}><Layers size={22} color="var(--violet)" /></div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>
              {bulkFiles.length > 0
                ? `${bulkFiles.length} file(s) selected for bulk import`
                : 'Drop ZIP archive (.zip), Folder, or multiple CSV/JSON files here'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              Drop a ZIP archive, an entire directory of papers, or multiple CSV files. All tests are automatically extracted, marked with the <b>★ NEW</b> badge, and saved to the <code>test/</code> directory.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <label className="btn btn-sm btn-violet" style={{ display: 'inline-flex', cursor: 'pointer', fontWeight: 700, alignItems: 'center', gap: 6 }}>
                <Layers size={14} /> Choose CSV / JSON / ZIP files
                <input
                  type="file"
                  accept=".csv,.json,.zip,text/csv,application/json,application/zip"
                  multiple
                  hidden
                  onChange={(e) => loadBulkFiles(e.target.files)}
                />
              </label>
              <label className="btn btn-sm btn-line" style={{ display: 'inline-flex', cursor: 'pointer', fontWeight: 700, alignItems: 'center', gap: 6 }}>
                <FolderSync size={14} /> Upload Entire Folder
                <input
                  type="file"
                  webkitdirectory=""
                  directory=""
                  multiple
                  hidden
                  onChange={(e) => loadBulkFiles(e.target.files)}
                />
              </label>
              {bulkFiles.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-line"
                  onClick={() => { setBulkFiles([]); setBulkPreviews([]); setBulkSummary(null); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={13} /> Clear queue
                </button>
              )}
            </div>
          </div>

          {/* Bulk queue header & action bar */}
          {bulkFiles.length > 0 && (
            <div
              className="card"
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                background: 'linear-gradient(135deg, rgba(91, 69, 234, 0.04), rgba(240, 180, 41, 0.04))',
                border: '1.5px solid var(--violet-soft-2)'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  📁 {bulkFiles.length} Paper File(s) Queued
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {bulkLoading ? (
                    'Scanning and validating files…'
                  ) : (
                    `Detected ${bulkPreviews.reduce((s, f) => s + (f.count || 0), 0)} total questions across ${bulkPreviews.length} file(s).`
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-amber"
                  onClick={commitBulk}
                  disabled={bulkImporting || bulkLoading || !bulkFiles.length}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, padding: '10px 22px' }}
                >
                  {bulkImporting ? <RefreshCw size={15} className="spin" /> : <Sparkles size={16} />}
                  {bulkImporting ? 'Importing & Saving Papers…' : `Import All ${bulkFiles.length} Papers`}
                </button>
              </div>
            </div>
          )}

          {/* Bulk files preview table */}
          {bulkPreviews.length > 0 && (
            <div className="card" style={{ marginTop: 12, overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Files in Queue</h3>
                <span className="tag green">{bulkPreviews.filter((f) => f.valid).length} Valid Files</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Exam Code & Title</th>
                    <th>Type / Family</th>
                    <th>Questions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreviews.map((f, i) => {
                    const firstPaper = f.papers?.[0];
                    return (
                      <tr key={i}>
                        <td>
                          <b>{f.name}</b>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(f.size / 1024).toFixed(1)} KB · {f.kind}</div>
                        </td>
                        <td>
                          {firstPaper ? (
                            <div>
                              <b>{firstPaper.exam_title || firstPaper.exam_code}</b>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{firstPaper.exam_code}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {firstPaper ? (
                            <span className="tag ink" style={{ fontSize: 11 }}>
                              {firstPaper.exam_type || 'subject'}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {f.valid ? (
                            <span className="tag green" style={{ fontSize: 11 }}>{f.count} Qs</span>
                          ) : (
                            <span className="tag gold" style={{ fontSize: 11 }}>Error</span>
                          )}
                        </td>
                        <td>
                          {bulkImporting ? (
                            <span className="tag ink" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                              <RefreshCw size={10} className="spin" /> Importing…
                            </span>
                          ) : f.valid ? (
                            <span className="tag green" style={{ fontSize: 11 }}>Ready</span>
                          ) : (
                            <span className="tag danger" style={{ fontSize: 11 }}>{f.error || 'Invalid'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bulk Summary Card */}
          {bulkSummary && (
            <div className="card" style={{ marginTop: 16, border: '2px solid var(--green)', background: 'rgba(34, 197, 94, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={24} color="var(--green)" />
                <h3 style={{ margin: 0, color: 'var(--green)' }}>Bulk Import Complete!</h3>
              </div>
              <p style={{ margin: '6px 0 14px', fontSize: 14, color: 'var(--ink)' }}>
                Successfully imported <b>{bulkSummary.totalPapers} paper(s)</b> with <b>{bulkSummary.totalQuestions} total questions</b>. All papers have been saved to SQLite and written to the <code>test/</code> folder on disk!
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <button
                  type="button"
                  className="btn btn-violet"
                  onClick={() => nav('/app/admin/exams')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  View All Papers in List <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-line"
                  onClick={() => { setBulkFiles([]); setBulkPreviews([]); setBulkSummary(null); }}
                >
                  Import More Files
                </button>
              </div>

              {bulkSummary.summary?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--muted)' }}>
                    IMPORTED PAPERS ({bulkSummary.summary.length}):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {bulkSummary.summary.map((s) => (
                      <div
                        key={s.code}
                        style={{
                          background: 'var(--paper)',
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{s.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {s.code} · <span style={{ color: 'var(--green)', fontWeight: 700 }}>{s.added} questions</span>
                        </div>
                        {s.filePath && (
                          <div style={{ fontSize: 11, color: 'var(--violet)', marginTop: 2 }}>
                            <code>{s.filePath}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASTE JSON TAB */}
      {tab === 'json' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Paste Raw JSON Bank</h3>
          <p className="lead" style={{ margin: '0 0 10px' }}>
            Paste single paper JSON or multiple papers array. JSON imported papers will be automatically saved to disk in <code>test/</code> folder as standardized CSVs.
          </p>
          <textarea
            rows={10}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{ "exam": { "code": "SEBI-P1-01", "title": "…", "exam_family": "SEBI_GRADE_A", "type": "full", "marks_per_q": 1 }, "questions": [ { "q_en": "…", "option_a": "…", "correct": "a" } ] }'
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-violet"
              onClick={commitJson}
              disabled={committing || !jsonText.trim()}
              style={{ fontWeight: 700 }}
            >
              {committing ? 'Saving & Committing…' : 'Commit JSON & Save to Disk'}
            </button>
            {jsonText && (
              <button className="btn btn-line" onClick={() => setJsonText('')}>Clear</button>
            )}
          </div>

          {summary && (
            <div style={{ marginTop: 14 }}>
              <span className="tag green" style={{ fontWeight: 700 }}>✓ Imported {summary.length} paper(s)</span>
              {summary.map((s) => (
                <div key={s.code} className="row-item" style={{ cursor: 'default', marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <b>{s.title}</b>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.code}</div>
                  </div>
                  <span className="tag green">{s.added} questions</span>
                  <button
                    className="btn btn-sm btn-violet"
                    onClick={() => nav(`/app/admin/exams/${s.examId}`)}
                    style={{ marginLeft: 8 }}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guidelines & templates footer card */}
      <div className="card" style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-2)' }}>
        <h3>Paper Format & Guidelines</h3>
        <p>
          One CSV row = one question. Repeat <b>exam_code</b> across rows for the same paper.
          Columns: <code>exam_code, exam_title, exam_type, exam_family, marks_per_q, negative, max_hints, question, option_a–e, correct, explanation, hint, hint_2, hint_3</code>.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="btn btn-sm btn-amber" href="/aaroh-questions.csv" download>Download CSV template</a>
          <a className="btn btn-sm btn-violet" href="/aaroh-questions.json" download>Download JSON template</a>
        </div>
      </div>
    </div>
  );
}

