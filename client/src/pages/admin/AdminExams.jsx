import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, Lightbulb, Zap, Check, ChevronDown, Cloud, Download,
  Sliders, ShieldCheck, Calculator, PauseCircle, Shuffle, Eye, EyeOff,
  Clock, RotateCcw, CheckSquare, Square, HelpCircle, Layers, CheckCircle2,
  Sparkles
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { PageHead } from '../../components/ui.jsx';

function Toggle({ on, set }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => set(!on)}
      aria-pressed={on}
    >
      <i />
    </button>
  );
}

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTab, setBatchTab] = useState('permissions'); // 'permissions' | 'presets' | 'hints' | 'scoring'
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [b2Status, setB2Status] = useState(null);
  const [b2Syncing, setB2Syncing] = useState(false);

  // Selected papers for targeted batch updates
  const [selectedIds, setSelectedIds] = useState([]);

  // Batch scope: 'all' | 'family' | 'selected'
  const [batchScope, setBatchScope] = useState('all');
  const [batchFamily, setBatchFamily] = useState('');

  // Granular settings to update in bulk
  const [batchSettings, setBatchSettings] = useState({
    // Hall permissions
    calculator: false,
    allow_pause: false,
    mark_for_review: true,
    skip_allowed: true,
    show_palette: true,
    bilingual: false,
    show_timer: true,
    allow_section_switch: true,

    // Exam flow & security
    shuffle_questions: false,
    shuffle_options: false,
    show_explanations_after: true,
    allow_reattempt: true,
    is_published: true,

    // Hints & lifelines
    hints_enabled: true,
    hint_mode: 'lifeline',
    max_hints: 3,

    // Marking
    negative_per_q: 0.25,
    marks_per_q: 1
  });

  // Keep track of which fields the user specifically toggled in this batch session
  const [activeFields, setActiveFields] = useState({
    calculator: false,
    allow_pause: false,
    mark_for_review: false,
    skip_allowed: false,
    show_palette: false,
    bilingual: false,
    show_timer: false,
    allow_section_switch: false,
    shuffle_questions: false,
    shuffle_options: false,
    show_explanations_after: false,
    allow_reattempt: false,
    is_published: false,
    hints_enabled: false,
    hint_mode: false,
    max_hints: false,
    negative_per_q: false
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

  // Handle selecting / deselecting individual rows
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length > 0 && batchScope !== 'selected') {
        setBatchScope('selected');
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.length === list.length && list.length > 0) {
      setSelectedIds([]);
      if (batchScope === 'selected') setBatchScope('all');
    } else {
      setSelectedIds(list.map((e) => e.id));
      setBatchScope('selected');
    }
  }

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
    } catch (err) {
      toast.push(`B2 Sync failed: ${err.message}`);
    } finally {
      setB2Syncing(false);
    }
  }

  const newBadgesCount = useMemo(() => exams.filter((e) => Boolean(e.is_new)).length, [exams]);

  async function clearAllNewBadges() {
    if (!window.confirm("Remove 'NEW' badge from all tests?")) return;
    try {
      const res = await api('/api/admin/exams/clear-new-badges', { method: 'POST' });
      setExams((prev) => prev.map((e) => ({ ...e, is_new: 0 })));
      toast.push(`✓ ${res.message || 'Cleared all NEW badges'}`);
    } catch (err) {
      toast.push(`Failed to clear badges: ${err.message}`);
    }
  }

  async function toggleNewBadge(examId, isNew) {
    try {
      await api(`/api/admin/exams/${examId}`, {
        method: 'PATCH',
        body: { is_new: isNew ? 1 : 0 }
      });
      setExams((prev) => prev.map((e) => (e.id === examId ? { ...e, is_new: isNew ? 1 : 0 } : e)));
      toast.push(isNew ? "Paper marked with 'NEW' badge" : "Removed 'NEW' badge from paper");
    } catch (err) {
      toast.push(`Failed to update badge: ${err.message}`);
    }
  }

  // Unified batch update executor
  async function applyBatchUpdate(overrideSettings, customLabel) {
    setBatchSaving(true);
    const scopeToUse = (selectedIds.length > 0 && batchScope === 'selected') ? 'selected' : batchScope;

    // Filter settings: only send fields that are either explicitly passed or marked active
    const payloadSettings = {};
    if (overrideSettings) {
      Object.assign(payloadSettings, overrideSettings);
    } else {
      for (const [k, isActive] of Object.entries(activeFields)) {
        if (isActive) {
          payloadSettings[k] = batchSettings[k];
        }
      }
    }

    if (Object.keys(payloadSettings).length === 0 && !overrideSettings?.add_extra_time_sec) {
      toast.push('Please select or enable at least one permission to update.');
      setBatchSaving(false);
      return;
    }

    try {
      const res = await api('/api/admin/exams/batch-settings', {
        method: 'POST',
        body: {
          scope: scopeToUse,
          exam_family: batchFamily,
          exam_ids: selectedIds,
          settings: payloadSettings,
          _message: customLabel ? `Admin updated: ${customLabel}` : undefined
        }
      });
      toast.push(`✓ ${res.message || 'Updated permissions across papers!'}`);
      load();
      if (overrideSettings) {
        // If it was a quick preset button, keep open or close based on preference
      }
    } catch (err) {
      toast.push(`Error: ${err.message}`);
    } finally {
      setBatchSaving(false);
    }
  }

  // Helper to mark a field active when changed
  function updateBatchField(key, val) {
    setBatchSettings((prev) => ({ ...prev, [key]: val }));
    setActiveFields((prev) => ({ ...prev, [key]: true }));
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

  // Count target papers for display
  const targetCount = useMemo(() => {
    if (batchScope === 'selected' && selectedIds.length > 0) return selectedIds.length;
    if (batchScope === 'family' && batchFamily) return exams.filter((e) => e.exam_family === batchFamily).length;
    return exams.length;
  }, [batchScope, selectedIds, batchFamily, exams]);

  return (
    <div className="rise">
      <PageHead kicker="Bank" title="Papers" lead="Manage your question bank, live exam permissions, calculators, hint caps, and paper visibility.">
        <label className="search">
          <Search size={16} color="#8A8378" />
          <input placeholder="Search code or title" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {newBadgesCount > 0 && (
          <button
            type="button"
            className="btn btn-line"
            onClick={clearAllNewBadges}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#FF3B30',
              borderColor: 'rgba(255, 59, 48, 0.35)',
              fontWeight: 700
            }}
            title="Remove 'NEW' badge from all tests"
          >
            <Sparkles size={13} strokeWidth={2.6} /> Clear 'NEW' Badges ({newBadgesCount})
          </button>
        )}
        <button
          className="btn btn-violet"
          onClick={() => { setBatchOpen((v) => !v); setOpen(false); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          title="Update permissions, calculators, hints, pause, or timers for all papers at once"
        >
          <Sliders size={14} />
          {batchOpen ? 'Close Bulk Controls' : '⚡ Bulk Permissions & Settings'}
        </button>
        <button
          className="btn btn-line"
          onClick={syncB2Cloud}
          disabled={b2Syncing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title={b2Status?.dbBackup?.lastBackupTime
            ? `Full Cloud Backup Active. Last saved: ${new Date(b2Status.dbBackup.lastBackupTime).toLocaleString()} (${Math.round((b2Status.dbBackup.lastBackupSize || 0) / 1024)} KB)`
            : "Sync papers and database to Backblaze B2 so scores, attempts & settings never disappear on Render restarts"}
        >
          <Cloud size={14} className={b2Syncing ? 'spin' : ''} />
          {b2Syncing ? 'Syncing Cloud…' : `☁ Cloud Backup (${b2Status?.filesCount ?? 0} papers + DB)`}
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
        <button className="btn btn-amber" onClick={() => { setOpen((v) => !v); setBatchOpen(false); }}>
          {open ? 'Close' : 'New paper'}
        </button>
      </PageHead>

      {/* Floating Selection Bar if papers are checked */}
      {selectedIds.length > 0 && (
        <div style={{
          background: '#2A2520',
          color: '#fff',
          padding: '10px 16px',
          borderRadius: 12,
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tag green" style={{ fontWeight: 700, fontSize: 12 }}>
              ✓ {selectedIds.length} of {exams.length} papers selected
            </span>
            <span style={{ fontSize: 13, color: '#C9C2B6' }}>
              Bulk updates will target these specific papers.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-violet"
              onClick={() => { setBatchScope('selected'); setBatchOpen(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Sliders size={12} /> Edit Permissions for {selectedIds.length}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-line"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => applyBatchUpdate({ is_published: true }, 'Published selected papers')}
            >
              <Eye size={12} /> Publish ({selectedIds.length})
            </button>
            <button
              type="button"
              className="btn btn-sm btn-line"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => applyBatchUpdate({ is_published: false }, 'Unpublished selected papers')}
            >
              <EyeOff size={12} /> Unpublish ({selectedIds.length})
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ color: '#C9C2B6' }}
              onClick={() => setSelectedIds([])}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Global & Batch Permissions Control Drawer */}
      {batchOpen && (
        <div className="card" style={{
          marginTop: 14,
          border: '2px solid var(--violet)',
          background: 'linear-gradient(180deg, rgba(91,69,234,0.04) 0%, rgba(255,255,255,0.98) 100%)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="tag violet" style={{ fontSize: 11, fontWeight: 800 }}>⚡ BATCH PERMISSIONS CONTROLLER</span>
                <span className="tag ink" style={{ fontSize: 11 }}>
                  Applies instantly to {targetCount} paper{targetCount === 1 ? '' : 's'}
                </span>
              </div>
              <h3 style={{ margin: '6px 0 2px', fontSize: 20 }}>Update Paper Permissions & Settings At Once</h3>
              <p className="lead" style={{ margin: 0, fontSize: 13 }}>
                Live updates push instantly into student halls via WebSockets — no need for students to reload or restart.
              </p>
            </div>

            {/* Target Scope Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>TARGET:</span>
              <select
                value={batchScope === 'selected' ? 'selected' : batchScope === 'family' ? `family:${batchFamily}` : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setBatchScope('all');
                    setBatchFamily('');
                  } else if (val === 'selected') {
                    setBatchScope('selected');
                  } else {
                    setBatchScope('family');
                    setBatchFamily(val.replace('family:', ''));
                  }
                }}
                style={{ fontWeight: 600, fontSize: 13, border: 'none', background: 'transparent', outline: 'none' }}
              >
                <option value="all">⚡ All Papers Everywhere ({exams.length} papers)</option>
                {(catalog.families || []).map((f) => (
                  <option key={f.id} value={`family:${f.id}`}>Only {f.label} papers</option>
                ))}
                {selectedIds.length > 0 && (
                  <option value="selected">🎯 Only Checked Papers ({selectedIds.length} selected)</option>
                )}
              </select>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div style={{ margin: '14px 0', padding: 12, background: '#fff', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
              ⚡ 1-Click Instant Presets (Applies immediately to {targetCount} papers)
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({
                  hints_enabled: true,
                  hint_mode: 'lifeline',
                  max_hints: 3,
                  calculator: true,
                  allow_pause: true,
                  skip_allowed: true,
                  show_palette: true,
                  show_explanations_after: true,
                  allow_reattempt: true
                }, 'Practice Mode: Hints + Calc + Pause + Explanations enabled')}
                title="Enable hints, calculator, pause, and review after submit"
              >
                🎓 Practice & Learning Mode
              </button>

              <button
                type="button"
                className="btn btn-sm btn-ink"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({
                  hints_enabled: false,
                  max_hints: 0,
                  calculator: false,
                  allow_pause: false,
                  show_timer: true,
                  shuffle_questions: true,
                  shuffle_options: true,
                  negative_per_q: 0.25
                }, 'Strict Exam Mode: No hints, no calc, no pause, questions shuffled')}
                title="Strict examination mode: No hints, no calc, no pause, shuffled"
              >
                🏛️ Strict Real Exam Mode
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ is_published: true }, 'Published all papers')}
              >
                <Eye size={12} color="#16a34a" /> Publish All ({targetCount})
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ is_published: false }, 'Unpublished all papers')}
              >
                <EyeOff size={12} color="#dc2626" /> Unpublish All ({targetCount})
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ calculator: true }, 'Calculator enabled for all')}
              >
                <Calculator size={12} /> Calculator ON for All
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ calculator: false }, 'Calculator disabled for all')}
              >
                Calculator OFF for All
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ allow_pause: true }, 'Pause enabled for all')}
              >
                <PauseCircle size={12} /> Allow Pause for All
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ add_extra_time_sec: 300 }, '+5 min extra time for all')}
                title="Bank +5 minutes extra time across all papers"
              >
                <Clock size={12} /> +5 Min Extra Time
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ max_hints: 3, hint_mode: 'lifeline', hints_enabled: true }, 'Set 3 Lifelines')}
              >
                🎯 3 Lifelines
              </button>

              <button
                type="button"
                className="btn btn-sm btn-line"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ max_hints: 3, hint_mode: 'per_question', hints_enabled: true }, 'Set 3 Hints/Q')}
              >
                🪜 3 Hints/Q Ladder
              </button>

              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={batchSaving}
                onClick={() => applyBatchUpdate({ max_hints: 0, hints_enabled: false }, 'Frozen hints')}
              >
                🧊 Freeze Hints (0)
              </button>
            </div>
          </div>

          {/* Granular Permissions Section Tabs */}
          <div className="tabs" style={{ margin: '10px 0 14px' }}>
            {[
              ['permissions', 'Hall Permissions & Tools'],
              ['security', 'Shuffling, Retakes & Review'],
              ['hints', 'Hints & Lifelines Policy'],
              ['marking', 'Scoring & Penalties']
            ].map(([k, label]) => (
              <button
                key={k}
                className={`tab ${batchTab === k ? 'on' : ''}`}
                onClick={() => setBatchTab(k)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab 1: Hall Permissions & Tools */}
          {batchTab === 'permissions' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {[
                {
                  id: 'calculator',
                  label: 'On-Screen Calculator',
                  desc: 'Provide floating scientific calculator pad inside exam hall',
                  icon: Calculator
                },
                {
                  id: 'allow_pause',
                  label: 'Allow Pause Exam',
                  desc: 'Student can pause the timer and take a breather',
                  icon: PauseCircle
                },
                {
                  id: 'mark_for_review',
                  label: 'Mark for Review',
                  desc: 'Show purple flag pill in question palette for flagged questions',
                  icon: CheckCircle2
                },
                {
                  id: 'skip_allowed',
                  label: 'Allow Question Skip',
                  desc: 'Student can leave answers unselected without penalty',
                  icon: RotateCcw
                },
                {
                  id: 'show_palette',
                  label: 'Question Palette Rail',
                  desc: 'Show right rail of numbered question buttons',
                  icon: Layers
                },
                {
                  id: 'bilingual',
                  label: 'Bilingual Mode (EN / HI)',
                  desc: 'Provide Hindi / English translation toggle on top bar',
                  icon: HelpCircle
                },
                {
                  id: 'show_timer',
                  label: 'Show Countdown Timer',
                  desc: 'Display ticking exam timer in header',
                  icon: Clock
                },
                {
                  id: 'allow_section_switch',
                  label: 'Switch Sections Freely',
                  desc: 'Allow student to jump back and forth across paper sections',
                  icon: Layers
                }
              ].map((item) => {
                const isChecked = !!batchSettings[item.id];
                const isActivated = !!activeFields[item.id];
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#fff',
                      border: isActivated ? '1.5px solid var(--violet)' : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'border .15s'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14 }}>
                        <IconComponent size={15} color={isChecked ? 'var(--violet)' : 'var(--muted)'} />
                        <span>{item.label}</span>
                        {isActivated && <span className="tag violet" style={{ fontSize: 9 }}>staged</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                        {item.desc}
                      </div>
                    </div>
                    <Toggle
                      on={isChecked}
                      set={(v) => updateBatchField(item.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Shuffling, Retakes & Review */}
          {batchTab === 'security' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {[
                {
                  id: 'shuffle_questions',
                  label: 'Shuffle Questions',
                  desc: 'Randomize the order of questions for every student attempt',
                  icon: Shuffle
                },
                {
                  id: 'shuffle_options',
                  label: 'Shuffle Option Choices',
                  desc: 'Randomize the A/B/C/D option order per question',
                  icon: Shuffle
                },
                {
                  id: 'show_explanations_after',
                  label: 'Show Solutions After Submit',
                  desc: 'Display full answer key and step-by-step reasoning on results',
                  icon: CheckCircle2
                },
                {
                  id: 'allow_reattempt',
                  label: 'Allow Retakes / Reattempt',
                  desc: 'Permit students to sit this paper more than once',
                  icon: RotateCcw
                },
                {
                  id: 'is_published',
                  label: 'Published / Live Status',
                  desc: 'Paper is visible and unlocked in the student hall',
                  icon: Eye
                }
              ].map((item) => {
                const isChecked = !!batchSettings[item.id];
                const isActivated = !!activeFields[item.id];
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#fff',
                      border: isActivated ? '1.5px solid var(--violet)' : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14 }}>
                        <IconComponent size={15} color={isChecked ? 'var(--violet)' : 'var(--muted)'} />
                        <span>{item.label}</span>
                        {isActivated && <span className="tag violet" style={{ fontSize: 9 }}>staged</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                        {item.desc}
                      </div>
                    </div>
                    <Toggle
                      on={isChecked}
                      set={(v) => updateBatchField(item.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 3: Hints & Lifelines Policy */}
          {batchTab === 'hints' && (
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div className="settings-grid">
                <div>
                  <label className="fld">Hints Master Switch</label>
                  <select
                    value={batchSettings.hints_enabled ? '1' : '0'}
                    onChange={(e) => updateBatchField('hints_enabled', e.target.value === '1')}
                  >
                    <option value="1">✓ Enabled (Students can use hints/lifelines)</option>
                    <option value="0">✕ Disabled (Freeze hints across papers)</option>
                  </select>
                </div>

                <div>
                  <label className="fld">Hint Strategy Architecture</label>
                  <select
                    value={batchSettings.hint_mode}
                    onChange={(e) => updateBatchField('hint_mode', e.target.value)}
                  >
                    <option value="lifeline">🎯 Lifelines Pool (Total budget across paper, e.g. 3)</option>
                    <option value="per_question">🪜 Per-Question Ladder (Progressive levels on each Q)</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label className="fld">
                    Hint Cap ({batchSettings.hint_mode === 'lifeline' ? 'Lifelines Total Budget' : 'Hints Per Question'})
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--cream-2)', padding: '10px 14px', borderRadius: 10 }}>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={batchSettings.max_hints}
                      onChange={(e) => updateBatchField('max_hints', Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 800, fontSize: 18, minWidth: 32, textAlign: 'center' }}>
                      {batchSettings.max_hints}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Scoring & Penalties */}
          {batchTab === 'marking' && (
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div className="settings-grid">
                <div>
                  <label className="fld">Negative Marking Penalty (Per Wrong Answer)</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {[
                      [0, '0 (No penalty)'],
                      [0.25, '0.25 (IBPS Standard)'],
                      [0.33, '0.33 (1/3rd)'],
                      [0.5, '0.5 (Half mark)']
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={`btn btn-sm ${batchSettings.negative_per_q === val ? 'btn-violet' : 'btn-line'}`}
                        onClick={() => updateBatchField('negative_per_q', val)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="5"
                    value={batchSettings.negative_per_q}
                    onChange={(e) => updateBatchField('negative_per_q', Number(e.target.value))}
                    placeholder="Custom negative mark"
                  />
                </div>

                <div>
                  <label className="fld">Marks Per Question</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {[1, 2, 3, 4].map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`btn btn-sm ${batchSettings.marks_per_q === m ? 'btn-violet' : 'btn-line'}`}
                        onClick={() => updateBatchField('marks_per_q', m)}
                      >
                        {m} mark{m > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={batchSettings.marks_per_q}
                    onChange={(e) => updateBatchField('marks_per_q', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save & Apply Bar */}
          <div style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {Object.values(activeFields).filter(Boolean).length > 0 ? (
                <span>
                  <b>{Object.values(activeFields).filter(Boolean).length}</b> permission(s) staged to apply to <b>{targetCount}</b> paper{targetCount === 1 ? '' : 's'}.
                </span>
              ) : (
                <span>Tip: Toggle any setting above, or click one of the instant presets.</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBatchOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-violet"
                disabled={batchSaving || Object.values(activeFields).filter(Boolean).length === 0}
                onClick={() => applyBatchUpdate()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Zap size={14} />
                {batchSaving ? 'Applying to papers…' : `Save & Apply Staged Changes to ${targetCount} Papers`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Paper Form */}
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

      {/* Papers Table */}
      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.length === list.length && list.length > 0}
                  onChange={toggleSelectAll}
                  title="Select all papers"
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Paper</th>
              <th>Type & Status</th>
              <th>Live Permissions</th>
              <th>Q</th>
              <th>Live</th>
              <th>Sat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => {
              const isSelected = selectedIds.includes(e.id);
              return (
                <tr key={e.id} style={{ background: isSelected ? 'rgba(91,69,234,0.04)' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(e.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <b>{e.title}</b>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {e.code} · {(e.exam_family || '').replaceAll('_', ' ')}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      {Boolean(e.is_new) ? (
                        <button
                          type="button"
                          onClick={() => toggleNewBadge(e.id, false)}
                          title="Click to remove 'NEW' badge from this paper"
                          style={{
                            cursor: 'pointer',
                            background: 'linear-gradient(135deg, #FF3B30, #FF9500)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 999,
                            padding: '2px 8px',
                            fontSize: 10,
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <Sparkles size={10} strokeWidth={2.8} /> NEW ✕
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleNewBadge(e.id, true)}
                          title="Click to mark this paper as NEW"
                          style={{
                            cursor: 'pointer',
                            background: 'transparent',
                            color: 'var(--muted)',
                            border: '1px dashed var(--line)',
                            borderRadius: 999,
                            padding: '1px 6px',
                            fontSize: 10,
                            opacity: 0.65
                          }}
                        >
                          + Mark NEW
                        </button>
                      )}
                      <span className={`tag ${e.type === 'high_influence' ? 'gold' : e.type === 'full' ? 'ink' : ''}`}>
                        {e.type}
                      </span>
                      <span className={`tag ${e.is_published ? 'green' : ''}`}>
                        {e.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Hint pill */}
                      <span className={`tag ${e.hints_enabled ? (e.hint_mode === 'per_question' ? 'ink' : 'green') : ''}`} style={{ fontSize: 11 }} title="Hint policy">
                        {e.hints_enabled
                          ? (e.hint_mode === 'per_question' ? `🪜 ${e.max_hints}/Q` : `🎯 ${e.max_hints} Life`)
                          : '🧊 No hints'}
                      </span>

                      {/* Calculator pill */}
                      <span
                        className={`tag ${e.calculator ? 'violet' : ''}`}
                        style={{ fontSize: 11, opacity: e.calculator ? 1 : 0.4 }}
                        title={e.calculator ? 'Calculator allowed' : 'Calculator disabled'}
                      >
                        🧮 {e.calculator ? 'Calc' : '—'}
                      </span>

                      {/* Pause pill */}
                      <span
                        className={`tag ${e.allow_pause ? 'ink' : ''}`}
                        style={{ fontSize: 11, opacity: e.allow_pause ? 1 : 0.4 }}
                        title={e.allow_pause ? 'Pause allowed' : 'Pause locked'}
                      >
                        ⏸️ {e.allow_pause ? 'Pause' : '—'}
                      </span>

                      {/* Shuffle pill */}
                      {(e.shuffle_questions || e.shuffle_options) && (
                        <span className="tag gold" style={{ fontSize: 10 }} title="Questions/Options shuffled">
                          🔀 Shuffled
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{e.question_count}</td>
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
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="lead" style={{ padding: 12 }}>No papers match.</p>}
      </div>
    </div>
  );
}
