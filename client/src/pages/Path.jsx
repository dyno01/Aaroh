import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHead } from '../components/ui.jsx';

const TRACK = [
  { title: 'Foundation', text: 'English, Reasoning, Quant — keep them qualifying-safe.', types: ['English', 'Reasoning', 'Quant'] },
  { title: 'High influence PK', text: 'DBMS, Networks, OS. Sit each, then the mixed paper.', types: ['DBMS', 'Networks', 'OS', 'High Yield Mix'] },
  { title: 'Rest of PK', text: 'DSA, SE, OOP, Cyber, COA, Web — the remaining 40% of mains.', types: ['DSA', 'Software Engineering', 'OOP', 'Cyber Security', 'COA', 'Web Tech'] },
  { title: 'Hall papers', text: 'Prelims full mocks, then Mains PK full mock.', types: [] }
];

export default function Path() {
  const [exams, setExams] = useState([]);
  const nav = useNavigate();
  useEffect(() => { api('/api/exams?family=IBPS_SO_IT').then((d) => setExams(d.exams || [])); }, []);

  return (
    <div className="rise">
      <PageHead
        kicker="Your path · IBPS SO IT 2026"
        title="Climb in this order"
        lead="Merit is 80% mains PK + 20% interview. Prelims is a gate. Don’t over-invest in English once you’re clearing it."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18 }}>
        {TRACK.map((t, i) => {
          const papers = t.types.length
            ? exams.filter((e) => t.types.includes(e.subject))
            : exams.filter((e) => e.type === 'full');
          const sat = papers.filter((p) => p.my).length;
          return (
            <div className="card" key={t.title}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tag">{String(i + 1).padStart(2, '0')}</span>
                <h3 style={{ margin: 0, flex: 1 }}>{t.title}</h3>
                <span className="tag green">{sat}/{papers.length} sat</span>
              </div>
              <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '8px 0 12px' }}>{t.text}</p>
              <div className="list-quiet">
                {papers.map((e) => (
                  <button key={e.id} className="row-item" onClick={() => nav(`/app/exam/${e.id}`)}>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <b>{e.title}</b>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.question_count} Q · {Math.round(e.duration_sec / 60)} min</div>
                    </div>
                    {e.my ? <span className="tag green">sat</span> : <span className="btn btn-sm btn-violet">Open</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
