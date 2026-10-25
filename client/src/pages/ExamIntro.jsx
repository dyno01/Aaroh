import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, FileQuestion, Lightbulb, AlertTriangle, Calculator, Languages, Flag } from 'lucide-react';
import { api } from '../lib/api';
import { Loading } from '../components/ui.jsx';

export default function ExamIntro() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    api(`/api/exams/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="err">{err}</div>;
  if (!data) return <Loading label="Opening paper…" />;
  const e = data.exam;

  async function start(resume) {
    setBusy(true);
    try {
      const r = await api('/api/attempts/start', {
        method: 'POST',
        body: resume ? { resumeId: data.inProgress.id } : { examId: e.id, forceNew: !!data.inProgress }
      });
      nav(`/exam/${e.id}/live`, { state: r });
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  const flags = [
    [!!e.hints_enabled, <Lightbulb size={12} />, `${e.max_hints} hints`],
    [!!e.calculator, <Calculator size={12} />, 'Calculator'],
    [!!e.bilingual, <Languages size={12} />, 'EN / हिन्दी'],
    [!!e.mark_for_review, <Flag size={12} />, 'Mark for review'],
    [!!e.show_palette, null, 'Question palette'],
    [!!e.allow_pause, null, 'Pause allowed']
  ];

  return (
    <div className="rise" style={{ maxWidth: 760 }}>
      <p className="date-k">{(e.exam_family || '').replaceAll('_', ' ')} · {e.code}</p>
      <h1 className="hello" style={{ fontSize: 36 }}>{e.title}</h1>
      <p className="lead">{e.description}</p>
      <div className="kpi-row">
        <div className="kpi"><FileQuestion size={16} className="ico-sm" /><div className="n">{e.question_count}</div><div className="l">Questions</div></div>
        <div className="kpi"><Clock size={16} className="ico-sm" /><div className="n">{Math.round(e.duration_sec / 60)}</div><div className="l">Minutes</div></div>
        <div className="kpi"><Lightbulb size={16} className="ico-sm" /><div className="n">{e.max_hints}</div><div className="l">Hint cap</div></div>
      </div>
      <div className="intro-flags">
        {flags.map(([on, icon, label]) => (
          <span key={label} className={`flag ${on ? 'on' : ''}`}>{icon}{label}</span>
        ))}
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Instructions</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--ink-2)', fontSize: 14, margin: 0 }}>{e.instructions}</pre>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, color: 'var(--muted)', fontSize: 13, alignItems: 'center' }}>
          <AlertTriangle size={14} /> Negative marking {e.negative_per_q} per wrong. Coach may change hints and extra time while you write.
        </div>
      </div>
      {e.sections?.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Sections</h3>
          {e.sections.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              <span style={{ color: 'var(--muted)' }}>{s.duration_sec ? `${Math.round(s.duration_sec / 60)} min` : 'Shared timer'}</span>
            </div>
          ))}
        </div>
      )}
      {data.attempts?.some((a) => a.status === 'submitted') && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>Your last review is saved</h3>
          <p className="lead" style={{ margin: '6px 0 12px' }}>Open the marked paper — answers, why the key is right, why the rest fail.</p>
          <button
            className="btn btn-line"
            type="button"
            onClick={() => nav(`/app/result/${data.attempts.find((a) => a.status === 'submitted').id}`)}
          >
            Open last review
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {data.inProgress && <button className="btn btn-amber" disabled={busy} onClick={() => start(true)}>Resume attempt</button>}
        <button className="btn btn-violet" disabled={busy} onClick={() => start(false)}>{data.inProgress ? 'Start a new attempt' : 'Begin paper'}</button>
        <button className="btn btn-line" onClick={() => nav(-1)}>Back</button>
      </div>
    </div>
  );
}
