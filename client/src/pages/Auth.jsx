import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Auth({ mode }) {
  const { login, register, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', remember: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isReg = mode === 'register';

  function destFor(u) {
    const from = loc.state?.from;
    if (from && (from.startsWith('/app') || from.startsWith('/exam'))) return from;
    return u?.role === 'admin' ? '/app/admin' : '/app';
  }

  useEffect(() => {
    if (user) nav(destFor(user), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function enter(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErr('');
    setBusy(true);
    try {
      const u = isReg
        ? await register(form.name, form.email, form.password)
        : await login(form.email, form.password);
      const dest = destFor(u);
      nav(dest, { replace: true });
    } catch (ex) {
      setErr(ex.message || 'Could not sign in');
      setBusy(false);
    }
  }

  function fill(email) {
    setForm((f) => ({
      ...f,
      email,
      password: 'Aaroh@123',
      name: email.startsWith('admin') ? 'Meera Iyer' : 'Nikita Rathod',
      remember: true
    }));
  }

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="brand"><div className="brand-mark">A</div> Aaroh</div>
        <div>
          <h1>Sit the paper. Let the coach sit behind the glass.</h1>
          <p>IBPS SO IT is live. Import SEBI or NABARD whenever the bank is ready — students see it the moment you commit.</p>
        </div>
        <p style={{ color: '#8A8378' }}>Keep me signed in stays on this device for 30 days.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h2>{isReg ? 'Create your seat' : 'Welcome back'}</h2>
          <p className="muted">{isReg ? 'Two minutes. Then a mock.' : 'Continue your IBPS SO IT path.'}</p>
          {err && <div className="err">{err}</div>}
          <form className="stack" onSubmit={enter} noValidate>
            {isReg && (
              <div>
                <label className="fld">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </div>
            )}
            <div>
              <label className="fld">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            </div>
            <div>
              <label className="fld">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete={isReg ? 'new-password' : 'current-password'}
              />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 550 }}>
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: 'var(--violet)' }}
              />
              Keep me signed in on this device
            </label>
            <button className="btn btn-amber btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing you in…' : isReg ? 'Create account' : 'Enter hall'}
            </button>
          </form>
          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Students and Administrators sign in with your email and password.
          </div>
          <p className="muted" style={{ marginTop: 18 }}>
            {isReg ? <>Already seated? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create account</Link></>}
          </p>
        </div>
      </div>
    </div>
  );
}
