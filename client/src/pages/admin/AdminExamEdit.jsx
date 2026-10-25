import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { Loading, PageHead } from '../../components/ui.jsx';

function Toggle({ on, set }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => set(!on)} aria-pressed={on}><i /></button>;
}

export default function AdminExamEdit() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [tab, setTab] = useState('live');
  const [qform, setQform] = useState({ q_en: '', a: '', b: '', c: '', d: '', correct: 'a', hint: '', hint2: '', hint3: '', explanation: '', topic: '', section: '' });
  const [catalog, setCatalog] = useState({ families: [], types: [] });
  const toast = useToast();
  const nav = useNavigate();

  async function load() {
    const d = await api(`/api/admin/exams/${id}`);
    setExam(d.exam);
    setQuestions(d.questions);
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => { api('/api/exams/catalog').then(setCatalog).catch(() => {}); }, []);

  async function patch(partial, message) {
    const r = await api(`/api/admin/exams/${id}`, { method: 'PATCH', body: { ...partial, _message: message } });
    setExam(r.exam);
    toast.push(r.live ? 'Applied live — students already writing see this now.' : 'Saved');
  }

  async function addQ(e) {
    e.preventDefault();
    await api(`/api/admin/exams/${id}/questions`, {
      method: 'POST',
      body: {
        q_en: qform.q_en,
        options: [
          { id: 'a', en: qform.a }, { id: 'b', en: qform.b },
          { id: 'c', en: qform.c }, { id: 'd', en: qform.d }
        ],
        correct: qform.correct, hint: qform.hint, hints: [qform.hint, qform.hint2, qform.hint3],
        explanation: qform.explanation,
        topic: qform.topic, section: qform.section || exam.subject
      }
    });
    setQform({ q_en: '', a: '', b: '', c: '', d: '', correct: 'a', hint: '', hint2: '', hint3: '', explanation: '', topic: '', section: '' });
    toast.push('Question added');
    load();
  }

  async function delQ(qid) {
    if (!window.confirm('Remove this question?')) return;
    await api(`/api/admin/questions/${qid}`, { method: 'DELETE' });
    load();
  }

  if (!exam) return <Loading label="Opening paper controls…" />;

  const flags = [
    ['hints_enabled', 'Hints on', 'Students can spend the cap'],
    ['calculator', 'Calculator', 'On-screen pad'],
    ['mark_for_review', 'Mark for review', 'Purple on the palette'],
    ['skip_allowed', 'Skip allowed', 'Leave a question blank'],
    ['show_palette', 'Question palette', 'Right rail of numbers'],
    ['bilingual', 'Bilingual EN/HI', 'Toggle on the top bar'],
    ['allow_pause', 'Allow pause', 'Timer freezes'],
    ['show_timer', 'Show timer', 'Countdown in the hall'],
    ['allow_section_switch', 'Switch sections', 'Jump across sections'],
    ['is_published', 'Published', 'Visible to students']
  ];

  return (
    <div className="rise">
      <PageHead kicker={`${exam.code} · live controls apply without restarting`} title={exam.title} lead={exam.description}>
        <button className="btn btn-line" onClick={() => nav('/app/admin/exams')}>All papers</button>
        <button className="btn btn-violet" onClick={() => nav('/app/admin/live')}>Live desk</button>
      </PageHead>

      <div className="tabs" style={{ margin: '8px 0 16px' }}>
        {[['live', 'Live controls'], ['meta', 'Paper meta'], ['qs', `Questions (${questions.length})`]].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'live' && (
        <div className="card">
          <h3>Live permissions</h3>
          <p className="lead">Flip a switch or drag a cap. Students already in the hall receive it instantly — no reload, no new attempt.</p>
          <div className="settings-grid" style={{ marginTop: 12 }}>
            <div className="hint-cap">
              <div style={{ flex: 1 }}>
                <label className="fld">Hint cap · {exam.max_hints}</label>
                <input type="range" min="0" max="20" value={exam.max_hints} onChange={(e) => patch({ max_hints: Number(e.target.value) })} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-sm btn-amber" onClick={() => patch({ max_hints: exam.max_hints + 1 }, 'Coach added +1 hint')}>+1 hint now</button>
                  <button className="btn btn-sm btn-line" onClick={() => patch({ max_hints: 0, hints_enabled: false }, 'Hints frozen')}>Freeze hints</button>
                </div>
              </div>
            </div>
            <div className="hint-cap">
              <div style={{ flex: 1 }}>
                <label className="fld">Extra time for everyone still writing</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-violet" onClick={() => patch({ extra_time_sec: (exam.extra_time_sec || 0) + 60 }, 'Coach added +1 minute')}>+1 min</button>
                  <button className="btn btn-sm btn-violet" onClick={() => patch({ extra_time_sec: (exam.extra_time_sec || 0) + 300 }, 'Coach added +5 minutes')}>+5 min</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Banked extra: {exam.extra_time_sec || 0}s</div>
              </div>
            </div>
          </div>
          <div className="perm-grid" style={{ marginTop: 16 }}>
            {flags.map(([k, l, s]) => (
              <div key={k} className="perm">
                <div><b>{l}</b><span>{s}</span></div>
                <Toggle on={!!exam[k]} set={(v) => patch({ [k]: v })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'meta' && (
        <div className="card">
          <h3>Paper meta</h3>
          <div className="settings-grid">
            <div><label className="fld">Title</label><input defaultValue={exam.title} onBlur={(e) => e.target.value !== exam.title && patch({ title: e.target.value })} /></div>
            <div>
              <label className="fld">Type</label>
              <select value={exam.type} onChange={(e) => patch({ type: e.target.value })}>
                {catalog.types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                {exam.type && !catalog.types.some((t) => t.id === exam.type) && <option value={exam.type}>{exam.type}</option>}
              </select>
            </div>
            <div><label className="fld">Duration (sec)</label><input type="number" defaultValue={exam.duration_sec} onBlur={(e) => patch({ duration_sec: Number(e.target.value) })} /></div>
            <div><label className="fld">Marks / Q</label><input type="number" step="0.25" defaultValue={exam.marks_per_q} onBlur={(e) => patch({ marks_per_q: Number(e.target.value) })} /></div>
            <div><label className="fld">Negative / wrong</label><input type="number" step="0.05" defaultValue={exam.negative_per_q} onBlur={(e) => patch({ negative_per_q: Number(e.target.value) })} /></div>
            <div>
              <label className="fld">Family</label>
              <select value={exam.exam_family} onChange={(e) => patch({ exam_family: e.target.value })}>
                {catalog.families.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                {exam.exam_family && !catalog.families.some((f) => f.id === exam.exam_family) && (
                  <option value={exam.exam_family}>{exam.exam_family}</option>
                )}
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'qs' && (
        <>
          <div className="card">
            <h3>Add a question</h3>
            <form onSubmit={addQ} className="stack">
              <textarea rows={3} placeholder="Question" value={qform.q_en} onChange={(e) => setQform({ ...qform, q_en: e.target.value })} required />
              <div className="settings-grid">
                {['a', 'b', 'c', 'd'].map((k) => (
                  <input key={k} placeholder={`Option ${k.toUpperCase()}`} value={qform[k]} onChange={(e) => setQform({ ...qform, [k]: e.target.value })} required />
                ))}
              </div>
              <div className="settings-grid">
                <select value={qform.correct} onChange={(e) => setQform({ ...qform, correct: e.target.value })}>
                  <option value="a">Correct: A</option><option value="b">Correct: B</option><option value="c">Correct: C</option><option value="d">Correct: D</option>
                </select>
                <input placeholder="Topic" value={qform.topic} onChange={(e) => setQform({ ...qform, topic: e.target.value })} />
                <input placeholder="Hint 1 — gentle nudge" value={qform.hint} onChange={(e) => setQform({ ...qform, hint: e.target.value })} />
                <input placeholder="Section" value={qform.section} onChange={(e) => setQform({ ...qform, section: e.target.value })} />
                <input placeholder="Hint 2 — stronger" value={qform.hint2} onChange={(e) => setQform({ ...qform, hint2: e.target.value })} />
                <input placeholder="Hint 3 — last nudge, still not the key" value={qform.hint3} onChange={(e) => setQform({ ...qform, hint3: e.target.value })} />
              </div>
              <textarea rows={2} placeholder="Explanation" value={qform.explanation} onChange={(e) => setQform({ ...qform, explanation: e.target.value })} />
              <button className="btn btn-violet" type="submit">Add question</button>
            </form>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h3>{questions.length} questions</h3>
            {questions.map((q, i) => (
              <div key={q.id} className="q-card">
                <div style={{ display: 'flex', gap: 12 }}>
                  <span className="tag">Q{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div className="q">{q.q_en}</div>
                    <div className="meta-chips">
                      {q.topic && <span className="tag">{q.topic}</span>}
                      <span className="tag green">ans {q.correct.toUpperCase()}</span>
                      {q.hint && <span className="tag gold">hint</span>}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={() => delQ(q.id)}>Remove</button>
                </div>
              </div>
            ))}
            {!questions.length && <p className="lead">No questions yet — add one above or import a CSV.</p>}
          </div>
        </>
      )}
    </div>
  );
}
