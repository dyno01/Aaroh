import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { Calculator, Lightbulb, Pause, Flag, Send, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

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
    const have = hintMap[q.id]?.length || 0;
    if (have >= (q.hint_count || 0)) return;
    try {
      const r = await api(`/api/attempts/${attemptId}/hint`, { method: 'POST', body: { questionId: q.id } });
      setHintMap((m) => ({ ...m, [q.id]: r.hints || [] }));
      setAnswers((a) => ({
        ...a,
        [q.id]: { ...(a[q.id] || {}), hintLevel: r.unlocked, hintUsed: true }
      }));
    } catch (e) {
      setToast(e.message);
      setTimeout(() => setToast(''), 3000);
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

  const chosen = answers[q.id]?.option;
  const unlocked = hintMap[q.id] || [];
  const liveCap = !settings?.hints_enabled ? 0 : Math.min(3, Number(settings.max_hints) > 0 && Number(settings.max_hints) < 4 ? Number(settings.max_hints) : 3);
  const maxHints = Math.min(q.hint_count || 0, liveCap);
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
        {settings?.hints_enabled && maxHints > 0 && (
          <div className="hint-pill"><Lightbulb size={14} /> Hint {unlocked.length}/{maxHints} on this Q</div>
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
          <div className="q-text">{lang === 'hi' && q.q_hi ? q.q_hi : q.q_en}</div>
          <div className="opts">
            {q.options.map((o) => (
              <button key={o.id} className={`opt ${chosen === o.id ? 'on' : ''}`} onClick={() => setOption(o.id)}>
                <span className="key">{o.id.toUpperCase()}</span>
                <span>{lang === 'hi' && o.hi ? o.hi : o.en}</span>
              </button>
            ))}
          </div>

          {settings?.hints_enabled && maxHints > 0 && (
            <div className="hint-ladder">
              <div className="hint-ladder-head">
                <Lightbulb size={16} />
                <b>Hints for this question</b>
                <span>{unlocked.length} of {maxHints} open · they never give the key</span>
              </div>
              {Array.from({ length: maxHints }).map((_, i) => {
                const open = i < unlocked.length;
                const next = i === unlocked.length;
                return (
                  <div key={i} className={`hint-step ${open ? 'open' : ''} ${next ? 'next' : ''}`}>
                    <div className="hint-step-k">{open ? <Lightbulb size={14} /> : <Lock size={14} />} Hint {i + 1}</div>
                    {open ? (
                      <p>{unlocked[i]}</p>
                    ) : next ? (
                      <button type="button" className="btn btn-sm btn-amber" onClick={useHint}>
                        Reveal hint {i + 1}
                      </button>
                    ) : (
                      <p className="muted-hint">Open hint {i} first.</p>
                    )}
                  </div>
                );
              })}
            </div>
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
        {settings?.hints_enabled && maxHints > 0 && (
          <button className="btn btn-line" style={{ color: '#9A6B00', borderColor: '#F0B429' }} onClick={useHint} disabled={unlocked.length >= maxHints}>
            <Lightbulb size={14} /> {unlocked.length >= maxHints ? 'All hints open' : `Hint ${unlocked.length + 1}`}
          </button>
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
