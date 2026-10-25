import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, X, BookOpen, Target, Trophy, BarChart3 } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api';
import { Avatar } from '../components/ui.jsx';

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function Home() {
  const { user, stats } = useAuth();
  const nav = useNavigate();
  const [exams, setExams] = useState([]);
  const [recent, setRecent] = useState([]);
  const [note, setNote] = useState(true);
  const first = (user?.name || 'there').split(' ')[0];

  useEffect(() => {
    api('/api/exams?family=IBPS_SO_IT').then((d) => setExams(d.exams || [])).catch(() => {});
    api('/api/attempts').then((d) => setRecent((d.attempts || []).filter((a) => a.status === 'submitted').slice(0, 4))).catch(() => {});
  }, []);

  const pick = exams.find((e) => e.code === 'SOIT-HI-YIELD') || exams.find((e) => e.type === 'full');
  const recentSubject = exams.filter((e) => e.type === 'subject').slice(0, 5);

  const plan = [
    { t: 'Warm-up', s: 'English drill', p: 70, c: '', to: '/app/tests?type=subject&family=IBPS_SO_IT' },
    { t: 'Fix drill', s: 'DBMS subject', p: 35, c: 'amber', to: '/app/path' },
    { t: 'High influence', s: 'DBMS+Net+OS', p: 0, c: '', to: pick ? `/app/exam/${pick.id}` : '/app/tests?type=high_influence' },
    { t: 'Cards', s: 'Review path', p: 15, c: 'green', to: '/app/analytics' }
  ];

  return (
    <div className="rise">
      <div className="top-row">
        <div>
          <p className="date-k">{todayLabel()}</p>
          <h1 className="hello">Hello, {first}</h1>
          <p className="lead">PK is the merit paper. Sit high-influence before another full prelims.</p>
        </div>
        <button className="btn-icon" onClick={() => nav('/app/you')} title="You" style={{ width: 48, height: 48, border: 0, padding: 0, background: 'transparent' }}>
          <Avatar key={user?.name} name={user?.name} color={user?.avatar_color} size={48} />
        </button>
      </div>

      {note && (
        <div className="coach-note" style={{ marginTop: 16 }}>
          <span style={{ color: '#1B9468' }}>●</span>
          <div style={{ flex: 1 }}>
            Your coach queued a <b>high-influence mix</b> of DBMS, Networks and OS — the three subjects that actually make IBPS SO IT merit.
          </div>
          <button className="btn-icon" onClick={() => setNote(false)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="grid-home">
        <div>
          {pick && (
            <div className="pick-card">
              <div className="eyebrow">Coach’s pick · about {Math.round(pick.duration_sec / 60)} min</div>
              <h3>{pick.title}</h3>
              <p>{pick.description}</p>
              <div className="pick-links">
                <button type="button" onClick={() => nav(`/app/exam/${pick.id}`)}>Why this?</button>
                <button type="button" onClick={() => nav('/app/tests?type=subject')}>Swap</button>
                <button type="button" onClick={() => nav('/app/tests?type=subject')}>Easier</button>
              </div>
              <button className="btn btn-amber" type="button" onClick={() => nav(`/app/exam/${pick.id}`)}>Start</button>
            </div>
          )}
          <div className="card plan-card" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>Today’s plan</h3>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>about 42 min</span>
            </div>
            <div className="steps">
              {plan.map((s) => (
                <button key={s.t} className="step" onClick={() => nav(s.to)} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                  <div className={`progress ${s.c}`}><span style={{ width: `${s.p}%` }} /></div>
                  <div className="meta"><b style={{ color: 'var(--ink)' }}>{s.t}</b></div>
                  <div className="meta">{s.s}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="kpi-row" style={{ marginTop: 0, gridTemplateColumns: '1fr 1fr 1fr' }}>
            <button className="kpi click" onClick={() => nav('/app/analytics')}><Trophy size={16} className="ico-sm" /><div className="n">{stats?.tests_taken || 0}</div><div className="l">Tests sat</div></button>
            <button className="kpi click" onClick={() => nav('/app/analytics')}><Target size={16} className="ico-sm" /><div className="n">{Math.round(stats?.avg_accuracy || 0)}%</div><div className="l">Accuracy</div></button>
            <button className="kpi click" onClick={() => nav('/app/you')}><Flame size={16} className="ico-sm" /><div className="n">{user?.streak || 0}</div><div className="l">Streak</div></button>
          </div>

          <div className="card home-cta" style={{ marginTop: 14 }}>
            <div className="ico"><BarChart3 size={18} /></div>
            <h3 style={{ margin: '8px 0 0' }}>Your analytics</h3>
            <p className="lead" style={{ marginTop: 4 }}>Strengths, gaps, and every paper you sat — open it in one tap.</p>
            <button className="btn btn-violet" type="button" onClick={() => nav('/app/analytics')}>Open analytics</button>
          </div>

          {recent.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Open a review</h3>
                <button className="btn btn-sm btn-line" type="button" onClick={() => nav('/app/analytics')}>All</button>
              </div>
              <div className="list-quiet" style={{ marginTop: 12 }}>
                {recent.map((a) => (
                  <button key={a.id} className="row-item" type="button" onClick={() => nav(`/app/result/${a.id}`)}>
                    <div className="ico" style={{ width: 34, height: 34 }}><Trophy size={14} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.score} / {a.max_score} · {a.accuracy}%</div>
                    </div>
                    <span className="tag">Review</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Subject path</h3>
              <button className="btn btn-sm btn-line" onClick={() => nav('/app/path')}>Full path</button>
            </div>
            <div className="list-quiet" style={{ marginTop: 12 }}>
              {recentSubject.map((e) => (
                <button key={e.id} className="row-item" onClick={() => nav(`/app/exam/${e.id}`)}>
                  <div className="ico" style={{ width: 34, height: 34 }}><BookOpen size={14} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 650 }}>{e.subject}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.question_count} Q · {Math.round(e.duration_sec / 60)} min</div>
                  </div>
                  <span className="tag">{e.difficulty}</span>
                </button>
              ))}
              {!recentSubject.length && <p className="lead">Papers load here once the bank is up.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
