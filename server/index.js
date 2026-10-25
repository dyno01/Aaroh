const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '8mb' }));

// Health check endpoint available immediately
app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'aaroh', time: new Date().toISOString() }));

async function bootstrap() {
  // 1. Restore SQLite database from Backblaze B2 before DB opens
  try {
    const { restoreDatabaseFromB2 } = require('./lib/dbBackup');
    const res = await restoreDatabaseFromB2();
    if (res && res.restored) {
      console.log(`[Startup] Backblaze B2 restored database (${res.size} bytes).`);
    }
  } catch (err) {
    console.warn('[Startup] Database cloud restore note:', err.message);
  }

  // 2. Initialize DB
  const db = require('./db');

  // 3. Restore any cloud papers if test folder is empty or has updates
  try {
    const { restorePapersFromB2 } = require('./lib/b2');
    const { importTestFolder } = require('./lib/importPack');
    const res = await restorePapersFromB2();
    if (res && res.restored > 0) {
      console.log(`[Startup] Backblaze B2 restored ${res.restored} cloud papers. Syncing...`);
      importTestFolder(db);
    }
  } catch (err) {
    console.warn('[Startup] Backblaze B2 cloud restore note:', err.message);
  }

  // 4. Mount API Routes
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

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true, credentials: true } });
  const { bind } = require('./realtime');
  bind(io);

  const PORT = Number(process.env.PORT || 5173);
  server.listen(PORT, '0.0.0.0', () => console.log(`Aaroh on http://0.0.0.0:${PORT}`));
  if (!process.env.RENDER && !process.env.NODE_ENV?.includes('production') && PORT !== 4000) {
    const apiServer = http.createServer(app);
    io.attach(apiServer);
    apiServer.listen(4000, '0.0.0.0', () => console.log('Aaroh API on http://0.0.0.0:4000'));
  }

  // 5. Periodic cloud backup every 10 minutes (debounced)
  const { scheduleDbBackup, backupDatabaseToB2 } = require('./lib/dbBackup');
  setInterval(() => {
    scheduleDbBackup(0);
  }, 10 * 60 * 1000);

  // 6. Graceful shutdown handler: back up DB immediately when Render sleeps / terminates container
  let isShuttingDown = false;
  const onShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Backing up database to Backblaze B2 before exit...`);
    try {
      await backupDatabaseToB2();
      console.log('[Shutdown] Cloud backup complete. Goodbye!');
    } catch (e) {
      console.error('[Shutdown] Backup error on shutdown:', e.message);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
  process.on('SIGINT', () => onShutdown('SIGINT'));
}

process.on('uncaughtException', (err) => console.error('uncaught', err));
process.on('unhandledRejection', (err) => console.error('unhandled', err));

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
