const TOKEN_KEY = 'aaroh_token';
const USER_KEY = 'aaroh_user';

function readStore(key) {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
  } catch { /* ignore */ }
  try {
    const v = sessionStorage.getItem(key);
    if (v) return v;
  } catch { /* ignore */ }
  return null;
}

function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
  try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
}

function delStore(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

function readCookie(name) {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(name, value) {
  try {
    const max = 60 * 60 * 24 * 30;
    const base = `${name}=${encodeURIComponent(value)}; path=/; max-age=${max}`;
    const https = typeof location !== 'undefined' && location.protocol === 'https:';
    document.cookie = `${base}; SameSite=Lax${https ? '; Secure' : ''}`;
    if (https) document.cookie = `${base}; SameSite=None; Secure`;
  } catch { /* ignore */ }
}

function clearCookie(name) {
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    document.cookie = `${name}=; path=/; max-age=0; SameSite=None; Secure`;
  } catch { /* ignore */ }
}

export function getToken() {
  if (typeof window !== 'undefined' && window.__AAROH_TOKEN) return window.__AAROH_TOKEN;
  return readStore(TOKEN_KEY) || readCookie('aaroh_token');
}

export function getSavedUser() {
  if (typeof window !== 'undefined' && window.__AAROH_USER) return window.__AAROH_USER;
  const raw = readStore(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setSession({ token, user } = {}) {
  if (token) {
    if (typeof window !== 'undefined') window.__AAROH_TOKEN = token;
    writeStore(TOKEN_KEY, token);
    writeCookie('aaroh_token', token);
  }
  if (user) {
    const plain = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      streak: user.streak,
      avatar_color: user.avatar_color,
      username: user.username || null
    };
    if (typeof window !== 'undefined') window.__AAROH_USER = plain;
    writeStore(USER_KEY, JSON.stringify(plain));
  }
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    delete window.__AAROH_TOKEN;
    delete window.__AAROH_USER;
  }
  delStore(TOKEN_KEY);
  delStore(USER_KEY);
  clearCookie('aaroh_token');
}

export function setToken(t) {
  if (t) setSession({ token: t });
  else clearSession();
}

export async function api(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  const token = getToken();
  const verb = String(method || 'GET').toUpperCase();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Aaroh-Token'] = token;
  }
  if (!isForm) headers['Content-Type'] = 'application/json';
  let url = path;
  let payload = body;
  if (token && !isForm) {
    if (verb === 'GET' || verb === 'HEAD') {
      url += (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token);
    } else {
      payload = { ...(payload && typeof payload === 'object' ? payload : {}), _token: token };
    }
  }
  let res;
  try {
    res = await fetch(url, {
      method: verb,
      headers,
      credentials: 'include',
      body: isForm ? body : payload !== undefined ? JSON.stringify(payload) : (verb === 'POST' || verb === 'PATCH' || verb === 'PUT' ? '{}' : undefined)
    });
  } catch {
    const err = new Error('Cannot reach Aaroh right now. Wait a moment and try again.');
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (data && data.token) setSession({ token: data.token, user: data.user });
  return data;
}
