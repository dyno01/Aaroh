import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, FileQuestion, Search } from 'lucide-react';
import { api } from '../lib/api';
import { Empty, PageHead } from '../components/ui.jsx';

function pretty(slug) {
  const known = {
    subject: 'Subject-wise',
    full: 'Full mock',
    high_influence: 'High influence'
  };
  if (known[slug]) return known[slug];
  return String(slug || '').replace(/[_-]+/g, ' ');
}

export default function Tests() {
  const [exams, setExams] = useState([]);
  const [families, setFamilies] = useState([{ id: '', label: 'All exams' }]);
  const [types, setTypes] = useState([{ id: '', label: 'All papers' }]);
  const [soon, setSoon] = useState([]);
  const [q, setQ] = useState('');
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || '';
  const family = params.get('family') || '';
  const nav = useNavigate();

  useEffect(() => {
    api('/api/exams').then((d) => setExams(d.exams || [])).catch(() => {});
    api('/api/exams/catalog').then((d) => {
      const fam = d.families || [];
      const ty = d.types || [];
      setFamilies([{ id: '', label: 'All exams' }, ...fam]);
      setTypes([{ id: '', label: 'All papers' }, ...ty]);
      setSoon(fam.filter((f) => f.coming_soon));
    }).catch(() => {});
  }, []);

  const list = useMemo(() => exams.filter((e) => {
    if (type && e.type !== type) return false;
    if (family && e.exam_family !== family) return false;
    if (q && !`${e.title} ${e.subject || ''} ${e.code}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [exams, type, q, family]);

  function setFilter(next) {
    const cur = {};
    if (next.family ?? family) cur.family = next.family ?? family;
    if (next.type ?? type) cur.type = next.type ?? type;
    if (!cur.family) delete cur.family;
    if (!cur.type) delete cur.type;
    setParams(cur);
  }

  function typeLabel(id) {
    return types.find((t) => t.id === id)?.label || pretty(id);
  }

  return (
    <div className="rise">
      <PageHead
        kicker="Question bank"
        title="Choose a paper"
        lead="Filters follow the papers you import. New exam or style in the template becomes a button here."
      />

      <div className="filters" aria-label="Exams">
        {families.map((t) => (
          <button key={t.id || 'all-ex'} className={`seg ${family === t.id ? 'on' : ''}`} onClick={() => setFilter({ family: t.id })}>
            {t.label}{t.coming_soon ? ' · soon' : ''}
          </button>
        ))}
      </div>
      <div className="filter-toolbar">
        <div className="filters" aria-label="Paper styles" style={{ margin: 0 }}>
          {types.map((t) => (
            <button key={t.id || 'all-ty'} className={`seg ${type === t.id ? 'on' : ''}`} onClick={() => setFilter({ type: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} color="#8A8378" />
          <input placeholder="Search DBMS, prelims, SEBI…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="test-grid">
        {list.map((e) => (
          <article key={e.id} className="test-card">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className={`tag ${e.type === 'high_influence' ? 'gold' : e.type === 'full' ? 'ink' : ''}`}>
                {typeLabel(e.type)}
              </span>
              {e.stage && <span className="tag green">{e.stage}</span>}
            </div>
            <h3>{e.title}</h3>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45 }}>{e.description}</div>
            <div className="meta-line">
              <span><FileQuestion size={13} /> {e.question_count} Q</span>
              <span><Clock size={13} /> {Math.round(e.duration_sec / 60)} min</span>
              <span>{e.total_marks} marks</span>
              {e.max_hints > 0 && <span>{e.max_hints} hints</span>}
            </div>
            <div className="foot">
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.my ? `Best ${e.my.best}` : 'Not attempted'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {e.my?.last_id && (
                  <button className="btn btn-sm btn-line" type="button" onClick={() => nav(`/app/result/${e.my.last_id}`)}>Review</button>
                )}
                <button className="btn btn-sm btn-violet" type="button" onClick={() => nav(`/app/exam/${e.id}`)}>Sit</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!list.length && <Empty title="No papers match" text="Import a CSV from the coach desk, or pick another filter." />}

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
