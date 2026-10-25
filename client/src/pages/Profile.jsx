import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Avatar, PageHead } from '../components/ui.jsx';

const COLORS = ['#5B45EA', '#F0B429', '#1F9D6C', '#E24B4A', '#3B82F6', '#0EA5A4', '#DB2777', '#1A1612'];

export default function Profile() {
  const { user, stats, logout, updateProfile } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    username: '',
    name: '',
    email: '',
    avatar_color: '#5B45EA',
    current_password: '',
    password: '',
    confirm: ''
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      username: user.username || '',
      name: user.name || '',
      email: user.email || '',
      avatar_color: user.avatar_color || '#5B45EA'
    }));
  }, [user]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (form.password && form.password !== form.confirm) {
      setErr('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const body = {
        username: form.username,
        name: form.name,
        email: form.email,
        avatar_color: form.avatar_color
      };
      if (form.password) {
        body.password = form.password;
        body.current_password = form.current_password;
      }
      await updateProfile(body);
      setForm((f) => ({ ...f, password: '', confirm: '', current_password: '' }));
      setMsg('Saved. Your hall now uses this name and email.');
    } catch (ex) {
      setErr(ex.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise">
      <PageHead kicker="You · settings" title={user?.name || 'Your seat'} lead="Change how you appear in the hall. Password only if you want a new one." />

      <div className="card" style={{ maxWidth: 560, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar name={form.name || user?.name} color={form.avatar_color} size={64} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{form.name || user?.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              {form.username ? `@${form.username}` : 'No username yet'} · streak {user?.streak || 0}
            </div>
            {user?.role === 'admin' && (
              <button className="btn btn-sm btn-violet" style={{ marginTop: 10 }} type="button" onClick={() => nav('/app/admin')}>Open coach desk</button>
            )}
          </div>
        </div>
        <div className="kpi-row" style={{ marginTop: 18 }}>
          <div className="kpi"><div className="n">{stats?.tests_taken || 0}</div><div className="l">Tests</div></div>
          <div className="kpi"><div className="n">{Math.round(stats?.avg_score || 0)}</div><div className="l">Avg score</div></div>
          <div className="kpi"><div className="n">{Math.round(stats?.best_score || 0)}</div><div className="l">Best</div></div>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 560, marginTop: 14 }} onSubmit={save}>
        <h3>Account</h3>
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok-msg">{msg}</div>}
        <div className="stack" style={{ marginTop: 12 }}>
          <div>
            <label className="fld">Username</label>
            <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="nikita" autoComplete="username" />
            <p className="hint-n">Letters, numbers, underscore. Shown as @{form.username || 'you'}.</p>
          </div>
          <div>
            <label className="fld">Full name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nikita Rathod" autoComplete="name" />
          </div>
          <div>
            <label className="fld">Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="fld">Avatar colour</label>
            <div className="color-row">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot ${form.avatar_color === c ? 'on' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('avatar_color', c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <hr className="soft-hr" />
          <p className="hint-n" style={{ marginTop: 0 }}>Leave the next three blank unless you want a new password.</p>
          <div>
            <label className="fld">Current password</label>
            <input type="password" value={form.current_password} onChange={(e) => set('current_password', e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className="fld">New password</label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="fld">Confirm new password</label>
            <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} autoComplete="new-password" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-violet" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button className="btn btn-line" type="button" onClick={() => nav('/app/analytics')}>Analytics</button>
            <button className="btn btn-danger" type="button" onClick={() => { logout(); nav('/'); }}>Sign out</button>
          </div>
        </div>
      </form>
    </div>
  );
}
