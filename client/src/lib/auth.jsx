import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api, clearSession, getSavedUser, getToken, setSession } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSavedUser());
  const [stats, setStats] = useState(null);
  const [ready, setReady] = useState(true);
  const gen = useRef(0);

  const refresh = useCallback(async () => {
    const token = getToken();
    const myGen = gen.current;
    if (!token) {
      setReady(true);
      return;
    }
    try {
      const data = await api('/api/auth/me');
      if (myGen !== gen.current) return;
      if (data && data.user) {
        setUser(data.user);
        setStats(data.stats || null);
        setSession({ token: getToken() || token, user: data.user });
      }
    } catch {
      // Never kick a signed-in user out because /me failed (iframe, race, blip).
    } finally {
      if (myGen === gen.current) setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (!data?.token || !data?.user) throw new Error('Sign in did not return a session');
    gen.current += 1;
    flushSync(() => {
      setSession({ token: data.token, user: data.user });
      setUser(data.user);
      setStats(data.stats || null);
      setReady(true);
    });
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
    if (!data?.token || !data?.user) throw new Error('Could not create account');
    gen.current += 1;
    flushSync(() => {
      setSession({ token: data.token, user: data.user });
      setUser(data.user);
      setStats(data.stats || null);
      setReady(true);
    });
    return data.user;
  }, []);

  const logout = useCallback(() => {
    gen.current += 1;
    clearSession();
    setUser(null);
    setStats(null);
    setReady(true);
  }, []);

  const updateProfile = useCallback(async (body) => {
    const data = await api('/api/auth/profile', { method: 'PATCH', body });
    if (!data?.user) throw new Error('Could not save profile');
    gen.current += 1;
    const next = { ...data.user };
    flushSync(() => {
      setSession({ token: data.token || getToken(), user: next });
      setUser(next);
    });
    return next;
  }, []);

  const value = useMemo(
    () => ({ user, stats, ready, login, register, logout, refresh, updateProfile }),
    [user, stats, ready, login, register, logout, refresh, updateProfile]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
