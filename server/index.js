const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
require('./db');
const { bind } = require('./realtime');

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'aaroh', time: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/import', require('./routes/import'));

const dist = path.join(__dirname, '../client/dist');
if (fs.existsSync(dist)) app.use(express.static(dist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  const index = path.join(dist, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(503).type('html').send('<!doctype html><title>Aaroh</title><p>Aaroh is starting. Refresh in a moment.</p>');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

process.on('uncaughtException', (err) => console.error('uncaught', err));
process.on('unhandledRejection', (err) => console.error('unhandled', err));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
bind(io);

const PORT = Number(process.env.PORT || 5173);
server.listen(PORT, '0.0.0.0', () => console.log(`Aaroh on http://0.0.0.0:${PORT}`));
if (!process.env.RENDER && !process.env.NODE_ENV?.includes('production') && PORT !== 4000) {
  const apiServer = http.createServer(app);
  io.attach(apiServer);
  apiServer.listen(4000, '0.0.0.0', () => console.log('Aaroh API on http://0.0.0.0:4000'));
}
