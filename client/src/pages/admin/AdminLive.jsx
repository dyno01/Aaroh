import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast.jsx';
import { Avatar, Empty, PageHead } from '../../components/ui.jsx';

export default function AdminLive() {
  const [sessions, setSessions] = useState([]);
  const toast = useToast();
  const nav = useNavigate();

  async function load() {
    try {
      const d = await api('/api/admin/live');
      setSessions(d.sessions || []);
    } catch { /* keep last */ }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  async function boost(id, body, msg) {
    await api(`/api/admin/live/${id}/patch`, { method: 'POST', body: { ...body, message: msg } });
    toast.push('Sent live — student sees a toast now');
    load();
  }

  return (
    <div className="rise">
      <PageHead
        kicker="Realtime · no restart"
        title="Writing now"
        lead="Every card is a student still in a paper. Extra minutes and bonus hints land on their screen instantly."
      >
        <span className="tag green"><span className={`live-dot ${sessions.length ? '' : 'off'}`} />{sessions.length} live</span>
      </PageHead>
      {!sessions.length && (
        <Empty icon={Radio} title="Hall is quiet" text="Open another tab as demo@aaroh.in, start a mock, then come back here to gift time or hints." />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {sessions.map((s) => (
          <div className="card" key={s.id} style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar name={s.name} color={s.avatar_color} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <b>{s.name}</b>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {s.title} · hints {s.hints_used}/{s.max_hints} · {s.current_section || '—'}
              </div>
            </div>
            <button className="btn btn-sm btn-amber" onClick={() => boost(s.id, { extra_time_sec: 60 }, 'Coach added one extra minute')}>+1 min</button>
            <button className="btn btn-sm btn-violet" onClick={() => boost(s.id, { bonus_hints: 1 }, 'Coach gifted you an extra hint')}>+1 hint</button>
            <button className="btn btn-sm btn-line" onClick={() => nav(`/app/admin/exams/${s.exam_id}`)}>Paper controls</button>
          </div>
        ))}
      </div>
    </div>
  );
}
