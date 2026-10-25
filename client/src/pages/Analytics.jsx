import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, Loading, PageHead } from '../components/ui.jsx';

function enrichBuckets(map) {
  return Object.values(map).map((x) => {
    const attempted = x.correct + x.wrong;
    const acc = attempted ? (x.correct / attempted) * 100 : 0;
    return { ...x, attempted, total: attempted + x.skipped, accuracy: +acc.toFixed(1) };
  });
}

function fromReview(review) {
  const bySubject = {};
  const byTopic = {};
  function add(map, key, verdict, time) {
    map[key] ||= { key, correct: 0, wrong: 0, skipped: 0, time: 0 };
    map[key][verdict] += 1;
    map[key].time += time || 0;
  }
  (review || []).forEach((r) => {
    add(bySubject, r.subject || r.section || 'Paper', r.verdict, r.timeSpent);
    add(byTopic, r.topic || r.subject || r.section || 'Topic', r.verdict, r.timeSpent);
  });
  return {
    subjects: enrichBuckets(bySubject).sort((a, b) => b.accuracy - a.accuracy),
    topics: enrichBuckets(byTopic).sort((a, b) => a.accuracy - b.accuracy)
  };
}

function BarList({ rows }) {
  return rows.map((s) => (
    <div className="bar-row" key={s.key}>
      <span>{s.key}</span>
      <div className={`progress ${s.accuracy >= 70 ? 'green' : s.accuracy < 50 ? 'amber' : ''}`}>
        <span style={{ width: `${Math.min(100, s.accuracy)}%` }} />
      </div>
      <b>{Math.round(s.accuracy)}%</b>
    </div>
  ));
}

function PaperAnalytics({ attemptId }) {
  const [data, setData] = useState(null);
  const [sittings, setSittings] = useState([]);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    let live = true;
    api(`/api/attempts/${attemptId}/result`)
      .then(async (d) => {
        if (!live) return;
        setData(d);
        const all = await api('/api/attempts').catch(() => ({ attempts: [] }));
        if (!live) return;
        const mine = (all.attempts || []).filter((a) => a.exam_id === d.exam.id && a.status === 'submitted');
        setSittings(mine);
      })
      .catch((e) => { if (live) setErr(e.message || 'Could not load this paper'); });
    return () => { live = false; };
  }, [attemptId]);

  const split = useMemo(() => fromReview(data?.result?.review || []), [data]);

  if (err) {
    return (
      <div className="rise">
        <p className="date-k">This paper</p>
        <h1 className="hello">Could not open stats</h1>
        <p className="lead">{err}</p>
        <button className="btn btn-violet" type="button" onClick={() => nav('/app/analytics')}>All papers</button>
      </div>
    );
  }
  if (!data) return <Loading label="Reading this paper…" />;

  const { result, exam, attempt } = data;
  const strengths = split.topics.filter((t) => t.attempted > 0 && t.accuracy >= 65).slice(0, 4);
  const weaknesses = split.topics.filter((t) => t.attempted > 0 && t.accuracy < 75).sort((a, b) => a.accuracy - b.accuracy).slice(0, 4);
  const time = (data.result.review || []).reduce((s, r) => s + (r.timeSpent || 0), 0);

  return (
    <div className="rise">
      <button className="btn btn-sm btn-line" type="button" onClick={() => nav(`/app/result/${attempt.id}`)} style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} /> Back to review
      </button>
      <PageHead
        kicker={`This paper only · ${exam.code}`}
        title={exam.title}
        lead="Stats for this sitting — not the rest of your hall. Dock Stats still opens every paper."
      />

      <div className="kpi-row">
        <div className="kpi"><div className="n">{result.score}<span style={{ fontSize: 14, color: 'var(--muted)' }}>/{result.max}</span></div><div className="l">Score</div></div>
        <div className="kpi"><div className="n">{result.accuracy}%</div><div className="l">Accuracy</div></div>
        <div className="kpi"><div className="n">{result.correct}/{result.wrong}/{result.skipped}</div><div className="l">Correct / wrong / skipped</div></div>
        <div className="kpi"><div className="n">{time ? `${Math.round(time / 60)}m` : '—'}</div><div className="l">Time on questions</div></div>
      </div>

      <div className="sw-grid">
        <div className="card sw-card up">
          <div className="sw-kicker"><Sparkles size={14} /> Strong on this paper</div>
          <p className="lead" style={{ marginTop: 4 }}>Topics you got right here.</p>
          {strengths.length ? strengths.map((s) => (
            <div className="sw-row" key={s.key}>
              <div>
                <b>{s.key}</b>
                <div className="sw-meta">{s.correct} correct · {s.wrong} wrong · {s.skipped} skipped</div>
              </div>
              <span className="tag green">{s.accuracy}%</span>
            </div>
          )) : <p className="lead">No clear strength on this sitting.</p>}
        </div>
        <div className="card sw-card down">
          <div className="sw-kicker warn"><AlertTriangle size={14} /> Weak on this paper</div>
          <p className="lead" style={{ marginTop: 4 }}>Drill these before you sit it again.</p>
          {weaknesses.length ? weaknesses.map((s) => (
            <div className="sw-row" key={s.key}>
              <div>
                <b>{s.key}</b>
                <div className="sw-meta">{s.correct} correct · {s.wrong} wrong · {s.accuracy}% accuracy</div>
              </div>
              <button className="btn btn-sm btn-amber" type="button" onClick={() => nav(`/app/tests?q=${encodeURIComponent(s.key)}`)}>Drill</button>
            </div>
          )) : <p className="lead">Nothing weak enough to flag — or you skipped the lot.</p>}
        </div>
      </div>

      {split.subjects.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Subject split · this paper</h3>
          <BarList rows={split.subjects} />
        </div>
      )}

      {split.topics.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Topic split · this paper</h3>
          <p className="lead" style={{ margin: '0 0 10px' }}>Lowest accuracy first.</p>
          {split.topics.map((t) => (
            <div className="sw-row" key={t.key}>
              <div>
                <b>{t.key}</b>
                <div className="sw-meta">{t.correct} correct · {t.wrong} wrong · {t.skipped} skipped{t.time ? ` · ${t.time}s` : ''}</div>
              </div>
              <span className={`tag ${t.accuracy >= 70 ? 'green' : t.accuracy < 50 ? '' : 'gold'}`}>{t.accuracy}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Your sittings of this paper</h3>
        <p className="lead" style={{ margin: '0 0 10px' }}>Only this title — not other mocks.</p>
        {sittings.length ? sittings.map((a) => (
          <button
            key={a.id}
            className="sw-row"
            type="button"
            style={{ width: '100%', background: a.id === Number(attemptId) ? 'var(--violet-soft)' : 'none', border: 0, padding: '10px 8px', cursor: 'pointer', borderRadius: 12 }}
            onClick={() => nav(`/app/result/${a.id}`)}
          >
            <div style={{ textAlign: 'left' }}>
              <b>{a.id === Number(attemptId) ? 'This sitting' : 'Earlier sitting'}</b>
              <div className="sw-meta">{(a.submitted_at || '').slice(0, 16)} · {a.score} / {a.max_score}</div>
            </div>
            <span className="tag">{a.accuracy}%</span>
          </button>
        )) : <p className="lead">This is your first sitting.</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button className="btn btn-violet" type="button" onClick={() => nav(`/app/result/${attempt.id}`)}>Open review</button>
        <button className="btn btn-amber" type="button" onClick={() => nav(`/app/exam/${exam.id}`)}>Sit again</button>
        <button className="btn btn-line" type="button" onClick={() => nav('/app/analytics')}>All papers analytics</button>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [params] = useSearchParams();
  const attemptId = params.get('attempt');
  const [attempts, setAttempts] = useState([]);
  const [ins, setIns] = useState(null);
  const [ready, setReady] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (attemptId) return undefined;
    let live = true;
    Promise.all([
      api('/api/attempts').then((d) => live && setAttempts(d.attempts || [])).catch(() => live && setAttempts([])),
      api('/api/attempts/insights').then((d) => live && setIns(d)).catch(() => live && setIns(null))
    ]).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [attemptId]);

  if (attemptId) return <PaperAnalytics attemptId={attemptId} />;
  if (!ready) return <Loading label="Reading your papers…" />;

  const done = attempts.filter((a) => a.status === 'submitted');

  return (
    <div className="rise">
      <PageHead
        kicker="Analytics · all papers"
        title="Strengths & gaps"
        lead="Every submitted paper. Open a review, then This paper’s stats, to see one mock on its own."
      />

      {done.length > 0 && (
        <div className="kpi-row">
          <div className="kpi"><div className="n">{ins?.papers ?? done.length}</div><div className="l">Submitted papers</div></div>
          <div className="kpi"><div className="n">{Math.round(ins?.avg_accuracy ?? 0)}%</div><div className="l">Mean accuracy</div></div>
          <div className="kpi"><div className="n">{ins?.last_score ?? done[0]?.score ?? '—'}</div><div className="l">Last score</div></div>
        </div>
      )}

      {!done.length && (
        <Empty icon={BarChart3} title="No papers yet" text="Sit a mock. Strengths and weaknesses fill in from your answers.">
          <button className="btn btn-violet" style={{ marginTop: 12 }} onClick={() => nav('/app/tests')}>Choose a paper</button>
        </Empty>
      )}

      {done.length > 0 && (
        <div className="sw-grid">
          <div className="card sw-card up">
            <div className="sw-kicker"><Sparkles size={14} /> Strengths</div>
            <p className="lead" style={{ marginTop: 4 }}>Hold these. Don’t over-drill them.</p>
            {(ins?.strengths || []).length ? ins.strengths.map((s) => (
              <div className="sw-row" key={s.key}>
                <div>
                  <b>{s.key}</b>
                  <div className="sw-meta">{s.correct} correct · {s.wrong} wrong · {s.skipped} skipped</div>
                </div>
                <span className="tag green">{s.accuracy}%</span>
              </div>
            )) : <p className="lead">Sit a few more papers — a strength needs at least two attempts in a subject.</p>}
          </div>
          <div className="card sw-card down">
            <div className="sw-kicker warn"><AlertTriangle size={14} /> Weaknesses</div>
            <p className="lead" style={{ marginTop: 4 }}>These move the IBPS SO IT merit. Drill them next.</p>
            {(ins?.weaknesses || []).length ? ins.weaknesses.map((s) => (
              <div className="sw-row" key={s.key}>
                <div>
                  <b>{s.key}</b>
                  <div className="sw-meta">{s.correct} correct · {s.wrong} wrong · {s.accuracy}% accuracy</div>
                </div>
                {s.practice ? (
                  <button className="btn btn-sm btn-amber" onClick={() => nav(`/app/exam/${s.practice.id}`)}>Drill</button>
                ) : (
                  <span className="tag">{s.accuracy}%</span>
                )}
              </div>
            )) : <p className="lead">No clear gap yet. After a couple of papers this list writes itself.</p>}
          </div>
        </div>
      )}

      {ins?.subjects?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Accuracy by subject</h3>
          <BarList rows={ins.subjects} />
        </div>
      )}

      {ins?.topics?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Topics that need work</h3>
          <p className="lead" style={{ margin: '0 0 10px' }}>Lowest accuracy first. Tap a paper in Tests if you want a full drill.</p>
          {ins.topics.slice(0, 8).map((t) => (
            <div className="sw-row" key={t.key}>
              <div>
                <b>{t.key}</b>
                <div className="sw-meta">{t.attempted} attempted · {t.wrong} wrong</div>
              </div>
              <span className={`tag ${t.accuracy >= 70 ? 'green' : t.accuracy < 50 ? '' : 'gold'}`}>{t.accuracy}%</span>
            </div>
          ))}
        </div>
      )}

      {ins?.trend?.length > 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Recent papers</h3>
          {ins.trend.map((t) => (
            <button key={t.id} className="sw-row" style={{ width: '100%', background: 'none', border: 0, padding: '10px 0', cursor: 'pointer' }} onClick={() => nav(`/app/result/${t.id}`)}>
              <div style={{ textAlign: 'left' }}>
                <b>{t.title}</b>
                <div className="sw-meta">{(t.at || '').slice(0, 16)} · score {t.score}</div>
              </div>
              <span className={`tag ${t.accuracy >= 70 ? 'green' : 'gold'}`}>{Math.round(t.accuracy)}%</span>
            </button>
          ))}
        </div>
      )}

      {attempts.length > 0 && (
      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <h3>History — Review opens answers · Stats opens this paper only</h3>
        {attempts.length ? (
          <table className="table">
            <thead><tr><th>Paper</th><th>Type</th><th>Score</th><th>Accuracy</th><th>When</th><th /></tr></thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.title}</b></td>
                  <td><span className="tag">{a.type}</span></td>
                  <td>{a.status === 'submitted' ? a.score : 'In progress'}</td>
                  <td>{a.accuracy ? `${a.accuracy}%` : '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{(a.submitted_at || a.started_at || '').slice(0, 16)}</td>
                  <td>
                    {a.status === 'submitted' && (
                      <div className="row-actions">
                        <button className="btn btn-sm btn-violet" type="button" onClick={() => nav(`/app/result/${a.id}`)}>Review</button>
                        <button className="btn btn-sm btn-line" type="button" onClick={() => nav(`/app/analytics?attempt=${a.id}`)}>Stats</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      )}
    </div>
  );
}
