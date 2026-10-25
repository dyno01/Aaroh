import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, X, Minus, Clock, Lightbulb } from 'lucide-react';
import { api } from '../lib/api';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'wrong', label: 'Wrong' },
  { id: 'correct', label: 'Correct' },
  { id: 'skipped', label: 'Skipped' }
];

export default function ExamResult() {
  const { attemptId } = useParams();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api(`/api/attempts/${attemptId}/result`).then(setData).catch((e) => setErr(e.message || 'Could not load result'));
  }, [attemptId]);

  const review = data?.result?.review || [];
  const visible = useMemo(
    () => (filter === 'all' ? review : review.filter((r) => r.verdict === filter)),
    [review, filter]
  );

  if (err) {
    return (
      <div className="rise">
        <p className="date-k">Results</p>
        <h1 className="hello">Could not open this paper</h1>
        <p className="lead">{err}</p>
        <button className="btn btn-violet" onClick={() => nav('/app/analytics')}>Back to all analytics</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rise">
        <p className="date-k">Results</p>
        <h1 className="hello">Marking your paper…</h1>
        <p className="lead">Correct answers and a plain-English why for every question.</p>
      </div>
    );
  }

  const { result, exam, bySubject, attempt } = data;
  const pct = result.max ? Math.round((result.score / result.max) * 100) : 0;
  const r = 62;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;

  return (
    <div className="rise result-page">
      <p className="date-k">{exam.code} · submitted {attempt.submitted_at}</p>
      <h1 className="hello" style={{ fontSize: 36 }}>{exam.title}</h1>
      <p className="lead">Each question: the rule, why the key is right, why the others fail. This review stays in Stats and on the paper in Tests.</p>

      <div className="score-hero" style={{ marginTop: 16 }}>
        <svg className="ring" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#2a2520" strokeWidth="12" />
          <circle
            cx="80" cy="80" r={r} fill="none" stroke="#F0B429" strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 80 80)"
          />
          <text x="80" y="78" textAnchor="middle" fill="#F6F1E8" fontSize="28" fontWeight="800" fontFamily="Outfit">{pct}%</text>
          <text x="80" y="100" textAnchor="middle" fill="#C9C2B6" fontSize="11">of {result.max}</text>
        </svg>
        <div>
          <div className="score-n">{result.score} <span style={{ fontSize: 18, color: '#C9C2B6' }}>/ {result.max}</span></div>
          <div style={{ color: '#C9C2B6', marginTop: 6 }}>
            Rank {result.rank} of {result.totalAttempts} on this paper · percentile {result.percentile}
          </div>
          <div className="stats-4">
            <div className="kpi" style={{ background: '#2a2520', color: '#fff' }}><div className="n">{result.correct}</div><div className="l">Correct</div></div>
            <div className="kpi" style={{ background: '#2a2520', color: '#fff' }}><div className="n">{result.wrong}</div><div className="l">Wrong</div></div>
            <div className="kpi" style={{ background: '#2a2520', color: '#fff' }}><div className="n">{result.skipped}</div><div className="l">Skipped</div></div>
            <div className="kpi" style={{ background: '#2a2520', color: '#fff' }}><div className="n">{result.accuracy}%</div><div className="l">Accuracy</div></div>
          </div>
        </div>
      </div>

      {bySubject?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Subject split</h3>
          {bySubject.map((s) => {
            const p = s.max ? Math.max(0, (s.score / s.max) * 100) : 0;
            return (
              <div key={s.subject} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <b>{s.subject}</b>
                  <span>{s.score.toFixed(1)} / {s.max} · {s.correct} correct · {s.wrong} wrong · {s.skipped} skipped</span>
                </div>
                <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, p)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card result-keep" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Come back to this paper</h3>
        <p className="lead" style={{ margin: '6px 0 12px', maxWidth: 'none' }}>
          The review is saved. Open it later from <b>Stats → History</b>, or tap <b>Review</b> on this paper in Tests.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-violet" onClick={() => nav(`/app/exam/${exam.id}`)}>Sit again</button>
          <button className="btn btn-line" onClick={() => nav(`/app/analytics?attempt=${attempt.id}`)}>This paper’s stats</button>
          <button className="btn btn-line" onClick={() => nav('/app/tests')}>All papers</button>
        </div>
      </div>

      <div className="page-head" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Answer review</h3>
        <div className="filters" style={{ margin: 0 }}>
          {FILTERS.map((f) => (
            <button key={f.id} className={`seg ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
              {f.id !== 'all' && ` · ${review.filter((x) => x.verdict === f.id).length}`}
            </button>
          ))}
        </div>
      </div>

      {visible.map((item, i) => {
        const n = review.indexOf(item) + 1;
        return (
          <article key={item.id} className={`rev-card ${item.verdict}`}>
            <header className="rev-card-top">
              <span className={`rev-badge ${item.verdict}`}>
                {item.verdict === 'correct' ? <Check size={14} /> : item.verdict === 'wrong' ? <X size={14} /> : <Minus size={14} />}
                {item.verdict}
              </span>
              <span className="q-num" style={{ margin: 0 }}>Q{n} · {item.section}{item.topic ? ` · ${item.topic}` : ''}</span>
              <span className={`tag ${item.delta > 0 ? 'green' : item.delta < 0 ? '' : 'gold'}`}>
                {item.delta > 0 ? '+' : ''}{item.delta} mark
              </span>
              {item.timeSpent > 0 && (
                <span className="tag" style={{ marginLeft: 'auto' }}><Clock size={12} /> {item.timeSpent}s</span>
              )}
            </header>
            <h3 className="rev-q">{item.q_en}</h3>
            <div className="rev-opts">
              {item.options.map((o) => {
                const isCorrect = o.id === item.correct;
                const isChosen = o.id === item.chosen;
                return (
                  <div key={o.id} className={`rev-opt ${isCorrect ? 'is-correct' : ''} ${isChosen && !isCorrect ? 'is-wrong' : ''}`}>
                    <span className="key">{o.id.toUpperCase()}</span>
                    <span className="txt">{o.en}</span>
                    {isCorrect && <span className="flag ok">Correct answer</span>}
                    {isChosen && !isCorrect && <span className="flag no">Your pick</span>}
                    {isChosen && isCorrect && <span className="flag ok">You got this</span>}
                  </div>
                );
              })}
            </div>
            <div className="why-box">
              <div className="why-kicker">The rule · {item.topic || item.section}</div>
              <p className="why-rule">{item.rule || item.explanation}</p>
              <div className="why-kicker" style={{ marginTop: 12 }}>Why {item.correct_label} is right</div>
              <p>
                <b>{item.correct_label}. {item.correct_text}</b>
                {item.body ? <> — {item.body}</> : null}
              </p>
              {item.verdict === 'wrong' && item.chosen_label && (
                <p>You chose <b>{item.chosen_label}. {item.chosen_text}</b>. That option does not match the rule.</p>
              )}
              {item.verdict === 'skipped' && <p>You left this blank, so it scored 0. The key still stands.</p>}
              {item.others?.length > 0 && (
                <div className="why-others">
                  <div className="why-kicker">Why the others fail</div>
                  {item.others.map((o) => (
                    <div key={o.id} className={`why-else ${item.chosen === o.id ? 'picked' : ''}`}>
                      <span className="key">{o.label}</span>
                      <span><b>{o.text}</b> — {o.note}</span>
                    </div>
                  ))}
                </div>
              )}
              {item.remember && (
                <div className="why-remember"><b>Remember.</b> {item.remember}</div>
              )}
              <button
                className="btn btn-sm btn-line"
                type="button"
                style={{ marginTop: 10 }}
                onClick={() => nav(`/app/tests?q=${encodeURIComponent(item.topic || item.subject || '')}`)}
              >
                Practice {item.topic || item.subject || 'this topic'}
              </button>
            </div>
            {item.hintLevel > 0 && item.hints?.length > 0 && (
              <div className="hint-used">
                <Lightbulb size={14} /> You opened {item.hintLevel} hint{item.hintLevel === 1 ? '' : 's'} here.
              </div>
            )}
          </article>
        );
      })}
      {!visible.length && <p className="lead">Nothing in this filter.</p>}

      <div style={{ display: 'flex', gap: 8, margin: '8px 0 24px', flexWrap: 'wrap' }}>
        <button className="btn btn-violet" onClick={() => nav(`/app/exam/${exam.id}`)}>Sit again</button>
        <button className="btn btn-line" onClick={() => nav(`/app/analytics?attempt=${attempt.id}`)}>This paper’s stats</button>
        <button className="btn btn-line" onClick={() => nav('/app/tests')}>All papers</button>
      </div>
    </div>
  );
}
