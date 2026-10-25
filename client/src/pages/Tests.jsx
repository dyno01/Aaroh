import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, FileQuestion, Search, CheckCircle2, RotateCcw, Eye, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, PageHead } from '../components/ui.jsx';

function pretty(slug) {
  const known = {
    subject: 'Subject-wise',
    subject_drill: 'Subject drill',
    full: 'Full mock',
    full_mock: 'Full mock',
    high_influence: 'High influence',
    high_influence_pk: 'High influence PK',
    debugging_error_test: 'Debugging error test'
  };
  if (known[slug]) return known[slug];
  return String(slug || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Tests() {
  const [exams, setExams] = useState([]);
  const [catalogFamilies, setCatalogFamilies] = useState([]);
  const [catalogTypes, setCatalogTypes] = useState([]);
  const [soon, setSoon] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'attempted' | 'unattempted'
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || '';
  const family = params.get('family') || '';
  const nav = useNavigate();

  useEffect(() => {
    api('/api/exams').then((d) => setExams(d.exams || [])).catch(() => {});
    api('/api/exams/catalog').then((d) => {
      const fam = d.families || [];
      const ty = d.types || [];
      setCatalogFamilies(fam);
      setCatalogTypes(ty);
      setSoon(fam.filter((f) => f.coming_soon));
    }).catch(() => {});
  }, []);

  // Compute test counts for each family
  const familyList = useMemo(() => {
    const total = exams.length;
    const base = [{ id: '', label: 'All exams', count: total }];
    const seen = new Set();
    const all = [...catalogFamilies];
    // Gather any family found in exams
    exams.forEach((e) => {
      if (e.exam_family && !all.some((f) => f.id === e.exam_family)) {
        all.push({ id: e.exam_family, label: pretty(e.exam_family), coming_soon: false });
      }
    });

    all.forEach((f) => {
      if (!f.id || seen.has(f.id)) return;
      seen.add(f.id);
      const count = exams.filter((e) => e.exam_family === f.id).length;
      if (f.coming_soon || count > 0) {
        base.push({ ...f, count });
      }
    });
    return base;
  }, [catalogFamilies, exams]);

  // Exams matching the chosen family
  const familyFilteredExams = useMemo(() => {
    if (!family) return exams;
    return exams.filter((e) => e.exam_family === family);
  }, [exams, family]);

  // Compute test counts for each paper style / type under the active family
  const typeList = useMemo(() => {
    const total = familyFilteredExams.length;
    const base = [{ id: '', label: 'All papers', count: total }];
    const seen = new Set();
    const all = [...catalogTypes];
    // Gather any types found in exams
    exams.forEach((e) => {
      if (e.type && !all.some((t) => t.id === e.type)) {
        all.push({ id: e.type, label: pretty(e.type), coming_soon: false });
      }
    });

    all.forEach((t) => {
      if (!t.id || seen.has(t.id)) return;
      seen.add(t.id);
      const count = familyFilteredExams.filter((e) => e.type === t.id).length;
      if (t.coming_soon || count > 0) {
        base.push({ ...t, count });
      }
    });
    return base;
  }, [catalogTypes, familyFilteredExams, exams]);

  // Completed stats
  const completedCount = useMemo(() => exams.filter((e) => e.my && e.my.n > 0).length, [exams]);
  const unattemptedCount = Math.max(0, exams.length - completedCount);
  const newCount = useMemo(() => exams.filter((e) => Boolean(e.is_new)).length, [exams]);

  // Final filtered list
  const list = useMemo(() => exams.filter((e) => {
    if (type && e.type !== type) return false;
    if (family && e.exam_family !== family) return false;
    if (statusFilter === 'new' && !e.is_new) return false;
    if (statusFilter === 'attempted' && (!e.my || !e.my.n)) return false;
    if (statusFilter === 'unattempted' && (e.my && e.my.n > 0)) return false;
    if (q && !`${e.title} ${e.subject || ''} ${e.code}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [exams, type, q, family, statusFilter]);

  function setFilter(next) {
    const cur = {};
    const nextFamily = next.family !== undefined ? next.family : family;
    const nextType = next.type !== undefined ? next.type : type;
    if (nextFamily) cur.family = nextFamily;
    if (nextType) cur.type = nextType;
    setParams(cur);
  }

  function typeLabel(id) {
    return typeList.find((t) => t.id === id)?.label || pretty(id);
  }

  return (
    <div className="rise">
      <PageHead
        kicker="Question bank"
        title="Choose a paper"
        lead="Select a paper to test your speed and accuracy. Each category displays exact available test counts."
      />

      {/* Primary Exam Family Filters */}
      <div className="filters" aria-label="Exams">
        {familyList.map((t) => (
          <button
            key={t.id || 'all-ex'}
            className={`seg ${family === t.id ? 'on' : ''}`}
            onClick={() => setFilter({ family: t.id })}
          >
            <span>{t.label}</span>
            {t.coming_soon ? (
              <span className="seg-n">soon</span>
            ) : (
              <span className="seg-n">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Paper Style / Type Filters with search & status quick filters */}
      <div className="filter-toolbar">
        <div className="filters" aria-label="Paper styles" style={{ margin: 0 }}>
          {typeList.map((t) => (
            <button
              key={t.id || 'all-ty'}
              className={`seg ${type === t.id ? 'on' : ''}`}
              onClick={() => setFilter({ type: t.id })}
            >
              <span>{t.label}</span>
              {t.coming_soon ? (
                <span className="seg-n">soon</span>
              ) : (
                <span className="seg-n">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} color="#8A8378" />
          <input
            placeholder="Search DBMS, prelims, SEBI…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      {/* Status quick toggle bar with smooth touch horizontal scroll */}
      <div className="status-bar-container">
        <div className="status-scroll-track">
          <span className="status-tag-label">Status:</span>
          <button
            type="button"
            className={`status-pill ${statusFilter === 'all' ? 'active-ink' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All papers <span className="pill-count">{exams.length}</span>
          </button>
          {newCount > 0 && (
            <button
              type="button"
              className={`status-pill new-filter ${statusFilter === 'new' ? 'active-new' : ''}`}
              onClick={() => setStatusFilter('new')}
            >
              <Sparkles size={12} strokeWidth={2.8} /> Newly Uploaded <span className="pill-count">{newCount}</span>
            </button>
          )}
          <button
            type="button"
            className={`status-pill ${statusFilter === 'attempted' ? 'active-green' : ''}`}
            onClick={() => setStatusFilter('attempted')}
          >
            <CheckCircle2 size={12} strokeWidth={2.6} /> Attempted <span className="pill-count">{completedCount}</span>
          </button>
          <button
            type="button"
            className={`status-pill ${statusFilter === 'unattempted' ? 'active-ink' : ''}`}
            onClick={() => setStatusFilter('unattempted')}
          >
            Not attempted <span className="pill-count">{unattemptedCount}</span>
          </button>
        </div>

        {completedCount > 0 && (
          <div className="completion-badge">
            <CheckCircle2 size={14} strokeWidth={2.4} />
            <span>Completed {completedCount} of {exams.length} papers ({Math.round((completedCount / (exams.length || 1)) * 100)}%)</span>
          </div>
        )}
      </div>

      {/* Test Cards Grid */}
      <div className="test-grid">
        {list.map((e) => {
          const isAttempted = Boolean(e.my && e.my.n > 0);
          const bestScore = e.my?.best ?? 0;
          const bestPct = e.total_marks > 0 ? Math.round((bestScore / e.total_marks) * 100) : 0;

          return (
            <article
              key={e.id}
              className={`test-card ${isAttempted ? 'completed' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {Boolean(e.is_new) && (
                    <span
                      className="tag new-pill"
                      style={{
                        background: 'linear-gradient(135deg, #FF3B30, #FF9500)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3.5,
                        boxShadow: '0 2px 8px rgba(255, 59, 48, 0.35)',
                        letterSpacing: '0.4px'
                      }}
                    >
                      <Sparkles size={11} strokeWidth={2.8} /> NEW
                    </span>
                  )}
                  <span className={`tag ${e.type === 'high_influence_pk' || e.type === 'high_influence' ? 'gold' : e.type === 'full_mock' || e.type === 'full' ? 'ink' : ''}`}>
                    {typeLabel(e.type)}
                  </span>
                  {e.stage && <span className="tag green">{e.stage}</span>}
                </div>

                {/* Prominent label when test is completed/attempted */}
                {isAttempted ? (
                  <span
                    className="tag green"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 700,
                      background: '#E6F4EA',
                      color: '#137333',
                      border: '1px solid #CEEAD6',
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: 12
                    }}
                  >
                    <CheckCircle2 size={13} strokeWidth={2.6} /> Attempted · Best {bestScore}/{e.total_marks} ({bestPct}%)
                  </span>
                ) : (
                  <span
                    className="tag"
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      background: 'rgba(26,22,18,0.04)',
                      border: '1px solid var(--border)',
                      padding: '3px 8px',
                      borderRadius: 999
                    }}
                  >
                    Not attempted
                  </span>
                )}
              </div>

              <h3 style={{ marginTop: 2 }}>{e.title}</h3>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{e.description}</div>

              <div className="meta-line">
                <span><FileQuestion size={13} /> {e.question_count} Q</span>
                <span><Clock size={13} /> {Math.round(e.duration_sec / 60)} min</span>
                <span>{e.total_marks} marks</span>
                {e.max_hints > 0 && <span>{e.max_hints} hints</span>}
              </div>

              <div className="foot" style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {isAttempted ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#137333', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} strokeWidth={2.5} /> Completed {e.my.n > 1 ? `(${e.my.n} attempts)` : ''}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Best: {bestScore}/{e.total_marks} ({bestPct}%)
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Ready to sit
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {e.my?.last_id && (
                    <button
                      className="btn btn-sm btn-line test-card-btn"
                      type="button"
                      title="Review questions & solutions"
                      onClick={() => nav(`/app/result/${e.my.last_id}`)}
                    >
                      <Eye size={13} /> Review
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${isAttempted ? 'btn-line' : 'btn-violet'} test-card-btn`}
                    type="button"
                    onClick={() => nav(`/app/exam/${e.id}`)}
                  >
                    {isAttempted ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <RotateCcw size={12} /> Retake
                      </span>
                    ) : (
                      'Sit paper →'
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!list.length && (
        <Empty
          title="No papers match"
          text={
            statusFilter !== 'all'
              ? `You don't have any papers under "${statusFilter}". Try switching back to "All papers".`
              : "Import a CSV from the coach desk, or pick another filter."
          }
        />
      )}

      {soon.length > 0 && (
        <div className="grid-home" style={{ marginTop: 28 }}>
          {soon.map((f) => (
            <div className="card" key={f.id}>
              <span className="tag gold">Coming soon</span>
              <h3 style={{ marginTop: 10 }}>{f.label}</h3>
              <p className="lead">Import a CSV with exam_family {f.id} and this tile lights up the same minute.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
