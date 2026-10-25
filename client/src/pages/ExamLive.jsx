import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { Calculator, Lightbulb, Pause, Flag, Send, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import MathText from '../components/MathText.jsx';

function fmt(sec) {
  const s = Math.max(0, sec | 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function ExamLive() {
  const { examId } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const [bundle, setBundle] = useState(loc.state || null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [settings, setSettings] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [hintMap, setHintMap] = useState({});
  const [hintsUsed, setHintsUsed] = useState(0);
  const [toast, setToast] = useState('');
  const [lang, setLang] = useState('en');
  const [showCalc, setShowCalc] = useState(false);
  const [calc, setCalc] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set());
  const lastTick = useRef(Date.now());
  const timeOnQ = useRef({});
  const submitting = useRef(false);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (bundle) return;
    api('/api/attempts/start', { method: 'POST', body: { examId: Number(examId) } })
      .then((d) => setBundle(d))
      .catch(() => nav(`/app/exam/${examId}`));
  }, [bundle, examId, nav]);

  useEffect(() => {
    if (!bundle) return;
    setAnswers(bundle.attempt.answers || {});
    setSettings(bundle.settings);
    setRemaining(bundle.attempt.remaining);
    setHintsUsed(bundle.attempt.hints_used || 0);
    const startIdx = bundle.questions.findIndex((q) => q.id === bundle.attempt.current_qid);
    setIdx(startIdx >= 0 ? startIdx : 0);
    const m = {};
    (bundle.questions || []).forEach((q) => {
      if (q.unlocked_hints?.length) m[q.id] = q.unlocked_hints;
    });
    setHintMap(m);
  }, [bundle]);

  const questions = bundle?.questions || [];
  const q = questions[idx];
  const attemptId = bundle?.attempt?.id;

  useEffect(() => {
    if (!q) return;
    seen.current.add(q.id);
    lastTick.current = Date.now();
  }, [q?.id]);

  useEffect(() => {
    if (!settings?.show_timer) return undefined;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (pausedRef.current) return r;
        if (r <= 1) {
          submit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [settings?.show_timer, attemptId]);

  useEffect(() => {
    if (!attemptId) return undefined;
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.emit('join', { examId: Number(examId), attemptId });
    socket.on('exam:settings', (msg) => {
      setSettings((s) => {
        if (typeof msg.settings?.extra_time_sec === 'number') {
          const delta = msg.settings.extra_time_sec - (s?.extra_time_sec || 0);
          if (delta) setRemaining((r) => r + delta);
        }
        return { ...s, ...msg.settings };
      });
      setToast(msg.message || 'Coach updated this paper live.');
      setTimeout(() => setToast(''), 5000);
    });
    socket.on('attempt:patch', (msg) => {
      if (msg.patch?.extra_time_sec) setRemaining((r) => r + msg.patch.extra_time_sec);
      if (msg.patch?.max_hints) setSettings((s) => ({ ...s, max_hints: msg.patch.max_hints }));
      setToast(msg.message || 'Coach sent you a boost.');
      setTimeout(() => setToast(''), 5000);
    });
    return () => socket.disconnect();
  }, [attemptId, examId]);

  const persist = useCallback(async (nextAnswers, nextIdx) => {
    if (!attemptId) return;
    const cur = questions[nextIdx] || questions[idx];
    try {
      await api(`/api/attempts/${attemptId}/save`, {
        method: 'POST',
        body: {
          answers: nextAnswers,
          current_qid: cur?.id,
          current_section: cur?.section
        }
      });
    } catch { /* autosave best-effort */ }
  }, [attemptId, questions, idx]);

  useEffect(() => {
    const t = setInterval(() => persist(answers, idx), 8000);
    return () => clearInterval(t);
  }, [answers, idx, persist]);

  function stampTime() {
    if (!q) return;
    const d = Math.round((Date.now() - lastTick.current) / 1000);
    lastTick.current = Date.now();
    timeOnQ.current[q.id] = (timeOnQ.current[q.id] || 0) + d;
  }

  function setOption(optId) {
    if (!q) return;
    stampTime();
    const next = {
      ...answers,
      [q.id]: { ...(answers[q.id] || {}), option: optId, timeSpent: timeOnQ.current[q.id] || 0 }
    };
    setAnswers(next);
    persist(next, idx);
  }

  function clearOption() {
    if (!q) return;
    const cur = { ...(answers[q.id] || {}) };
    delete cur.option;
    const next = { ...answers, [q.id]: cur };
    setAnswers(next);
    persist(next, idx);
  }

  function toggleMark() {
    if (!q || !settings?.mark_for_review) return;
    const next = {
      ...answers,
      [q.id]: { ...(answers[q.id] || {}), marked: !answers[q.id]?.marked }
    };
    setAnswers(next);
    persist(next, idx);
  }

  function go(n) {
    stampTime();
    const next = Math.min(questions.length - 1, Math.max(0, n));
    if (!settings?.allow_section_switch && questions[next]?.section !== q?.section) return;
    setIdx(next);
    persist(answers, next);
  }

  async function useHint() {
    if (!q || !settings?.hints_enabled) return;
    const isLadder = settings?.hint_mode === 'per_question';
    const have = hintMap[q.id]?.length || 0;
    if (isLadder) {
      if (have >= 3) return;
    } else {
      if (have > 0) return; // already unlocked on this question in lifeline mode
      const total = Number(settings?.max_hints ?? 3);
      if (hintsUsed >= total) return;
    }
    try {
      const r = await api(`/api/attempts/${attemptId}/hint`, { method: 'POST', body: { questionId: q.id } });
      setHintMap((m) => ({ ...m, [q.id]: r.hints || [] }));
      if (r.hints_used !== undefined) setHintsUsed(r.hints_used);
      setAnswers((a) => ({
        ...a,
        [q.id]: { ...(a[q.id] || {}), hintLevel: (r.hints || []).length, hintUsed: true }
      }));
      const unlockedCount = (r.hints || []).length;
      setToast(isLadder ? `💡 Hint ${unlockedCount} of 3 unlocked!` : '💡 Hint lifeline unlocked!');
      setTimeout(() => setToast(''), 2500);
    } catch (e) {
      setToast(e.message || 'Could not unlock hint');
      setTimeout(() => setToast(''), 3500);
    }
  }

  async function submit(auto) {
    if (submitting.current) return;
    if (!auto && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    submitting.current = true;
    setBusy(true);
    stampTime();
    const stamped = { ...answers };
    Object.keys(timeOnQ.current).forEach((id) => {
      stamped[id] = { ...(stamped[id] || {}), timeSpent: timeOnQ.current[id] };
    });
    try {
      const r = await api(`/api/attempts/${attemptId}/submit`, { method: 'POST', body: { answers: stamped, current_qid: q?.id } });
      nav(`/app/result/${r.attemptId}`, { replace: true });
    } catch (e) {
      submitting.current = false;
      setBusy(false);
      setToast(e.message);
    }
  }

  useEffect(() => {
    function onKey(ev) {
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
      const map = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', Digit1: 'a', Digit2: 'b', Digit3: 'c', Digit4: 'd' };
      if (map[ev.key]) setOption(map[ev.key]);
      if (ev.key === 'n' || ev.key === 'N' || ev.key === 'ArrowRight') go(idx + 1);
      if (ev.key === 'p' || ev.key === 'P' || ev.key === 'ArrowLeft') go(idx - 1);
      if (ev.key === 'm' || ev.key === 'M') toggleMark();
      if (ev.key === 'h' || ev.key === 'H') useHint();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sections = useMemo(() => {
    const s = [];
    questions.forEach((qq) => { if (!s.includes(qq.section)) s.push(qq.section); });
    return s;
  }, [questions]);

  const counts = useMemo(() => {
    let answered = 0, marked = 0;
    questions.forEach((qq) => {
      if (answers[qq.id]?.option) answered += 1;
      if (answers[qq.id]?.marked) marked += 1;
    });
    return { answered, marked, left: questions.length - answered };
  }, [answers, questions]);

  if (!bundle || !q) {
    return (
      <div className="exam-live">
        <div className="q-pane"><p className="lead">Preparing your paper…</p></div>
      </div>
    );
  }

  const isLadderMode = settings?.hint_mode === 'per_question';
  const chosen = answers[q.id]?.option;
  const unlocked = hintMap[q.id] || [];
  const hasUnlockedOnQ = unlocked.length > 0;
  const totalLifelines = !settings?.hints_enabled
    ? 0
    : Number.isFinite(Number(settings?.max_hints)) && Number(settings?.max_hints) >= 0
      ? Number(settings?.max_hints)
      : (bundle?.exam?.max_hints || 3);
  const remainingLifelines = Math.max(0, totalLifelines - hintsUsed);

  const statusOf = (qq) => {
    const a = answers[qq.id] || {};
    const st = [];
    if (qq.id === q.id) st.push('current');
    if (a.option) st.push('answered');
    if (a.marked) st.push('marked');
    else if (!a.option && seen.current.has(qq.id) && qq.id !== q.id) st.push('seen');
    return st.join(' ');
  };

  return (
    <div className="exam-live">
      {toast && <div className="live-toast">{toast}</div>}
      <header className="exam-top">
        <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 8 }}>A</div>
        <div className="title">{bundle.exam.title}</div>
        {settings?.hints_enabled && (
          isLadderMode ? (
            <div className="hint-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#26211c', padding: '6px 12px', borderRadius: 999 }}>
              <Lightbulb size={14} color="#F0B429" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Ladder: Q.{idx + 1} ({unlocked.length}/3 hints)
              </span>
              <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: i < unlocked.length ? '#1B9468' : 'rgba(255,255,255,0.22)'
                    }}
                  />
                ))}
              </span>
            </div>
          ) : totalLifelines > 0 && (
            <div className="hint-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#26211c', padding: '6px 12px', borderRadius: 999 }}>
              <Lightbulb size={14} color="#F0B429" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Lifelines: {remainingLifelines}/{totalLifelines}
              </span>
              <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
                {Array.from({ length: totalLifelines }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: i < remainingLifelines ? '#F0B429' : 'rgba(255,255,255,0.22)'
                    }}
                  />
                ))}
              </span>
            </div>
          )
        )}
        {settings?.calculator && (
          <button className="btn btn-sm btn-ghost" onClick={() => setShowCalc((v) => !v)}><Calculator size={14} /> Calc</button>
        )}
        {settings?.bilingual && (
          <button className="btn btn-sm btn-ghost" onClick={() => setLang((l) => l === 'en' ? 'hi' : 'en')}>{lang === 'en' ? 'हिन्दी' : 'EN'}</button>
        )}
        {settings?.allow_pause && (
          <button className="btn btn-sm btn-ghost" onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>
            <Pause size={14} /> {paused ? 'Resume' : 'Pause'}
          </button>
        )}
        {settings?.show_timer && <div className={`timer ${remaining < 60 ? 'warn' : ''}`}>{fmt(remaining)}</div>}
        <button className="btn btn-sm btn-amber" onClick={() => submit(false)} disabled={busy}><Send size={14} /> Submit</button>
      </header>

      <div className="exam-body">
        <div className="q-pane">
          {sections.length > 1 && (
            <div className="sec-tabs">
              {sections.map((s) => (
                <button key={s} className={`sec-tab ${q.section === s ? 'on' : ''}`} onClick={() => {
                  const i = questions.findIndex((qq) => qq.section === s);
                  if (i >= 0) go(i);
                }}>{s}</button>
              ))}
            </div>
          )}
          <div className="q-num">Question {idx + 1} of {questions.length} · {q.section}{q.topic ? ` · ${q.topic}` : ''} · {q.marks} mark{q.marks === 1 ? '' : 's'}</div>
          <div className="q-text">
            <MathText text={lang === 'hi' && q.q_hi ? q.q_hi : q.q_en} />
          </div>
          <div className="opts">
            {q.options.map((o) => (
              <button key={o.id} className={`opt ${chosen === o.id ? 'on' : ''}`} onClick={() => setOption(o.id)}>
                <span className="key">{o.id.toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <MathText text={lang === 'hi' && o.hi ? o.hi : o.en} />
                </span>
              </button>
            ))}
          </div>

          {/* Hint Block on the Question */}
          {settings?.hints_enabled && (
            isLadderMode ? (
              /* Per-Question Progressive Ladder Mode */
              <div style={{ marginTop: 22 }}>
                <div style={{ background: '#FFFDF9', border: '1px solid #E8DFD0', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#9A6B00' }}>
                      <Lightbulb size={18} color="#F0B429" />
                      <span>Per-Question Hint Ladder (Q.{idx + 1})</span>
                    </div>
                    <span className="tag" style={{ fontSize: 11, fontWeight: 700, background: unlocked.length > 0 ? '#E3F6EE' : '#F5F1E8', color: unlocked.length > 0 ? '#1B9468' : 'var(--muted)' }}>
                      {unlocked.length === 0 ? '0/3 unlocked' : `${unlocked.length}/3 unlocked`}
                    </span>
                  </div>

                  {unlocked.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                      Stuck? You can reveal up to 3 progressive hints for this question (Concept Nudge → Rule & Formula → Method).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      {unlocked.map((hintText, hIdx) => (
                        <div key={hIdx} style={{ background: 'white', border: '1px solid #EDE4D4', borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9A6B00', marginBottom: 4 }}>
                            Hint {hIdx + 1} · {hIdx === 0 ? 'Concept Nudge' : hIdx === 1 ? 'Rule & Elimination' : 'Direct Method'}
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>
                            <MathText text={hintText} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {unlocked.length < 3 ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-amber"
                      onClick={useHint}
                      style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Lightbulb size={14} /> Reveal Hint {unlocked.length + 1} ({unlocked.length === 0 ? 'Concept nudge' : unlocked.length === 1 ? 'Rule & elimination' : 'Step-by-step approach'})
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: '#1B9468', fontWeight: 600 }}>
                      ✓ All 3 hint levels unlocked for this question.
                    </div>
                  )}
                </div>
              </div>
            ) : totalLifelines > 0 ? (
              /* Lifeline Pool Mode (Default 3 lifelines across paper) */
              <div style={{ marginTop: 22 }}>
                {hasUnlockedOnQ ? (
                  <div className="hint-ladder" style={{ background: '#FFFDF9', border: '1px solid #E8DFD0', borderRadius: 14, padding: 16 }}>
                    <div className="hint-ladder-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#9A6B00' }}>
                        <Lightbulb size={16} color="#F0B429" />
                        <span>Hint Lifeline Active for Q.{idx + 1}</span>
                      </div>
                      <span className="tag green" style={{ fontSize: 11, fontWeight: 700 }}>Unlocked</span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>
                      <MathText text={unlocked[0]} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      💡 Hints nudge your concept without revealing the correct option key.
                    </div>
                  </div>
                ) : remainingLifelines > 0 ? (
                  <div style={{
                    background: 'rgba(240, 180, 41, 0.08)',
                    border: '1.5px dashed rgba(240, 180, 41, 0.55)',
                    borderRadius: 14,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FCE7B2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lightbulb size={18} color="#9A6B00" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#6A4800' }}>
                          Stuck? Use a Hint Lifeline
                        </div>
                        <div style={{ fontSize: 12, color: '#8A6820' }}>
                          You have <b>{remainingLifelines}</b> of {totalLifelines} hint lifelines left across this paper.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-amber"
                      onClick={useHint}
                      style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Lightbulb size={14} /> Reveal hint on Q.{idx + 1}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--surface-sunken, #F5F1E8)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--muted)',
                    fontSize: 12
                  }}>
                    <Lock size={14} />
                    <span>All {totalLifelines} hint lifelines have been used. Solve remaining questions independently!</span>
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
        {settings?.show_palette !== false && (
          <aside className="palette">
            <h4>Question palette</h4>
            <div className="p-grid">
              {questions.map((qq, i) => (
                <button key={qq.id} className={`p-btn ${statusOf(qq)}`} onClick={() => go(i)}>{i + 1}</button>
              ))}
            </div>
            <div className="legend">
              <div><i style={{ background: '#1B9468' }} /> Answered {counts.answered}</div>
              <div><i style={{ background: '#5B45EA' }} /> Marked {counts.marked}</div>
              <div><i style={{ background: '#E24B4A' }} /> Seen, not answered</div>
              <div><i style={{ background: '#EFE8D8', border: '1px solid #C4B9A8' }} /> Not visited · {counts.left} unanswered</div>
            </div>
          </aside>
        )}
      </div>

      <footer className="exam-foot">
        <button className="btn btn-line" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronLeft size={16} /> Previous</button>
        <button className="btn btn-line" onClick={clearOption}>Clear</button>
        {settings?.mark_for_review && (
          <button className={`btn ${answers[q.id]?.marked ? 'btn-violet' : 'btn-line'}`} onClick={toggleMark}>
            <Flag size={14} /> {answers[q.id]?.marked ? 'Marked' : 'Mark for review'}
          </button>
        )}
        {settings?.hints_enabled && (
          isLadderMode ? (
            <button
              className="btn btn-line"
              style={{
                color: unlocked.length > 0 ? '#137333' : '#9A6B00',
                borderColor: unlocked.length > 0 ? '#CEEAD6' : '#F0B429'
              }}
              onClick={useHint}
              disabled={unlocked.length >= 3}
              title={unlocked.length < 3 ? `Reveal hint ${unlocked.length + 1} of 3` : 'All 3 hints unlocked'}
            >
              <Lightbulb size={14} />
              {unlocked.length === 0
                ? 'Reveal Hint (1/3)'
                : unlocked.length < 3
                  ? `Reveal Next Hint (${unlocked.length + 1}/3)`
                  : '3 Hints Unlocked'}
            </button>
          ) : totalLifelines > 0 && (
            <button
              className="btn btn-line"
              style={{
                color: hasUnlockedOnQ ? '#137333' : remainingLifelines > 0 ? '#9A6B00' : 'var(--muted)',
                borderColor: hasUnlockedOnQ ? '#CEEAD6' : remainingLifelines > 0 ? '#F0B429' : 'var(--border)'
              }}
              onClick={useHint}
              disabled={hasUnlockedOnQ || remainingLifelines <= 0}
              title={hasUnlockedOnQ ? 'Hint already unlocked on this Q' : remainingLifelines > 0 ? `Use 1 lifeline (${remainingLifelines} left)` : '0 Lifelines left'}
            >
              <Lightbulb size={14} />
              {hasUnlockedOnQ
                ? 'Hint active on this Q'
                : remainingLifelines > 0
                  ? `Hint Lifelines (${remainingLifelines} left)`
                  : '0 Lifelines left'}
            </button>
          )
        )}
        <div style={{ flex: 1 }} />
        <button className="btn btn-violet" onClick={() => (idx === questions.length - 1 ? submit(false) : go(idx + 1))}>
          {idx === questions.length - 1 ? 'Review & submit' : <>Save & next <ChevronRight size={16} /></>}
        </button>
      </footer>

      {confirmSubmit && (
        <div className="exam-confirm" onClick={() => setConfirmSubmit(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Submit this paper?</h3>
            <p className="lead">{counts.left} unanswered · {counts.marked} marked. After the bell you will see every correct answer and a plain-English why.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-line" onClick={() => setConfirmSubmit(false)}>Keep writing</button>
              <button className="btn btn-amber" disabled={busy} onClick={() => submit(true)}>Submit now</button>
            </div>
          </div>
        </div>
      )}

      {showCalc && (
        <div className="calc-pop">
          <input value={calc} onChange={(e) => setCalc(e.target.value)} placeholder="Expression" />
          <div className="calc-keys">
            {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'].map((k) => (
              <button key={k} onClick={() => {
                if (k === '=') {
                  try { setCalc(String(Function(`"use strict"; return (${calc})`)())); } catch { setCalc('Err'); }
                } else setCalc((c) => c + k);
              }}>{k}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
