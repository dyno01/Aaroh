const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'aaroh-dev-secret-change-me';

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    SECRET,
    { expiresIn: '30d' }
  );
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (k === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return rest.join('='); }
    }
  }
  return null;
}

function cookieHeader(token, req) {
  const proto = String((req && (req.headers['x-forwarded-proto'] || req.protocol)) || 'http');
  const secure = proto.includes('https');
  return [
    `aaroh_token=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 30}`,
    `SameSite=${secure ? 'None' : 'Lax'}`,
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ');
}

function tokenFromReq(req) {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Bearer ')) {
    const t = header.slice(7).trim();
    if (t) return t;
  }
  const x = req.headers['x-aaroh-token'] || req.headers['x-access-token'];
  if (x && String(x).trim()) return String(x).trim();
  const ck = readCookie(req, 'aaroh_token');
  if (ck) return ck;
  const body = req.body || {};
  if (body._token || body.token) return String(body._token || body.token);
  const q = req.query || {};
  if (q.access_token || q.token) return String(q.access_token || q.token);
  return null;
}

function auth(required = true) {
  return (req, res, next) => {
    const token = tokenFromReq(req);
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'Sign in to continue' });
    }
    try {
      const payload = jwt.verify(token, SECRET);
      const user = db.prepare('SELECT id, name, email, role, streak, avatar_color, username FROM users WHERE id = ?').get(payload.id);
      if (!user) {
        if (!required) return next();
        return res.status(401).json({ error: 'Account not found' });
      }
      req.user = user;
      next();
    } catch {
      if (!required) return next();
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  };
}

function admin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { sign, auth, admin, SECRET, cookieHeader, tokenFromReq };
