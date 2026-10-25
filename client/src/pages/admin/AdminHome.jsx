import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Radio, BookOpen, Users, Tags } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth.jsx';
import { Loading, PageHead } from '../../components/ui.jsx';

export default function AdminHome() {
  const [d, setD] = useState(null);
  const nav = useNavigate();
  const { user } = useAuth();
  useEffect(() => { api('/api/admin/overview').then(setD).catch(() => setD({ users: 0, exams: 0, questions: 0, live: 0, recent: [] })); }, []);
  if (!d) return <Loading label="Opening coach desk…" />;
  const first = (user?.name || 'Coach').split(' ')[0];

  return (
    <div className="rise">
      <PageHead kicker="Coach desk" title={`Hello, ${first}`} lead="Import a bank, watch live sessions, change hint caps without restarting a paper." />
      <div className="admin-grid" style={{ marginTop: 18 }}>
        {[
          [d.users, 'People', '/app/admin/students'],
          [d.exams, 'Papers', '/app/admin/exams'],
          [d.questions, 'Questions', '/app/admin/exams'],
          [d.live, 'Writing now', '/app/admin/live']
        ].map(([n, l, to]) => (
          <button className="kpi click" key={l} onClick={() => nav(to)}>
            <div className="n">{n}</div>
            <div className="l">{l === 'Writing now' ? <><span className={`live-dot ${n ? '' : 'off'}`} />{l}</> : l}</div>
          </button>
        ))}
      </div>
      <div className="action-grid">
        <button className="action-tile gold" onClick={() => nav('/app/admin/import')}>
          <div className="ico"><Upload size={18} /></div>
          <h3>Import a paper</h3>
          <p>CSV or JSON. SEBI and NABARD use the same door.</p>
        </button>
        <button className="action-tile" onClick={() => nav('/app/admin/live')}>
          <div className="ico"><Radio size={18} /></div>
          <h3>Live control</h3>
          <p>+1 minute or +1 hint while a student is on Q.14.</p>
        </button>
        <button className="action-tile ink" onClick={() => nav('/app/admin/exams')}>
          <div className="ico"><BookOpen size={18} /></div>
          <h3>Paper bank</h3>
          <p>Create, publish, set hint caps and permissions.</p>
        </button>
        <button className="action-tile" onClick={() => nav('/app/admin/styles')}>
          <div className="ico"><Tags size={18} /></div>
          <h3>Buttons & styles</h3>
          <p>Add an exam pill or a paper style. Students see it on Tests.</p>
        </button>
      </div>
      <div className="card" style={{ marginTop: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Latest submissions</h3>
          <button className="btn btn-sm btn-line" onClick={() => nav('/app/admin/students')}><Users size={14} /> People</button>
        </div>
        {d.recent?.length ? (
          <table className="table">
            <thead><tr><th>Student</th><th>Paper</th><th>Score</th><th>Accuracy</th></tr></thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.id}><td><b>{r.name}</b></td><td>{r.title}</td><td>{r.score}</td><td>{r.accuracy}%</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="lead" style={{ marginTop: 12 }}>No submissions yet. Have a student sit a mock.</p>}
      </div>
    </div>
  );
}
