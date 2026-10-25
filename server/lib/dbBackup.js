const fs = require('fs');
const path = require('path');
const b2 = require('./b2');

const DB_REMOTE_NAME = 'database/aaroh.db';
let isBackingUp = false;
let backupPending = false;
let debounceTimer = null;
let lastBackupTime = null;
let lastBackupSize = 0;
let lastBackupError = null;
let isDirty = false;

function getDbFile() {
  return process.env.DB_PATH || path.join(__dirname, '../aaroh.db');
}

/**
 * Creates a clean atomic snapshot of the SQLite database using better-sqlite3 backup API
 * and uploads it directly to Backblaze B2.
 */
async function backupDatabaseToB2() {
  if (!b2.isB2Configured()) {
    console.warn('[DB Backup] Backblaze B2 credentials not configured. Skipping cloud backup.');
    return { success: false, reason: 'B2 not configured' };
  }

  if (isBackingUp) {
    backupPending = true;
    return { success: false, inProgress: true };
  }

  isBackingUp = true;
  const dbFile = getDbFile();
  const tempBackupPath = path.join(path.dirname(dbFile), `_aaroh_cloud_backup_${Date.now()}.db`);

  try {
    let db;
    try {
      db = require('../db');
    } catch (err) {
      console.warn('[DB Backup] Could not access DB instance:', err.message);
      return { success: false, error: err.message };
    }

    // Flush any pending WAL pages safely
    try {
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch { /* ignore checkpoint error */ }

    // Atomic snapshot via better-sqlite3 backup API
    await db.backup(tempBackupPath);

    if (!fs.existsSync(tempBackupPath)) {
      throw new Error('Temporary snapshot file was not created');
    }

    const buffer = fs.readFileSync(tempBackupPath);
    // Verify it is a valid SQLite file
    const header = buffer.toString('utf8', 0, 15);
    if (!header.startsWith('SQLite format 3')) {
      throw new Error('Created backup file does not have a valid SQLite format header');
    }

    console.log(`[DB Backup] Uploading SQLite snapshot (${buffer.length} bytes) to Backblaze B2 '${DB_REMOTE_NAME}'...`);
    await b2.uploadFile(DB_REMOTE_NAME, buffer, 'application/x-sqlite3');

    // Delete previous backup file versions in Backblaze B2 so storage does not accumulate old backups
    try {
      await b2.pruneOldFileVersions(DB_REMOTE_NAME, 1);
    } catch (pruneErr) {
      console.warn('[DB Backup] Could not prune older backup versions:', pruneErr.message);
    }

    lastBackupTime = new Date().toISOString();
    lastBackupSize = buffer.length;
    lastBackupError = null;
    isDirty = false;
    console.log(`[DB Backup] ✓ Successfully backed up database to Backblaze B2 at ${lastBackupTime} (${buffer.length} bytes)`);

    return { success: true, size: buffer.length, timestamp: lastBackupTime };
  } catch (err) {
    lastBackupError = err.message;
    console.error('[DB Backup] Failed to back up database to Backblaze B2:', err.message);
    return { success: false, error: err.message };
  } finally {
    try {
      if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
    } catch { /* ignore cleanup error */ }
    isBackingUp = false;
    if (backupPending) {
      backupPending = false;
      setTimeout(backupDatabaseToB2, 1000);
    }
  }
}

/**
 * Debounces backup calls so rapid successive changes (e.g. test attempts, multiple setting toggles)
 * only perform a single consolidated cloud backup once settled.
 */
function scheduleDbBackup(delayMs = 2500) {
  isDirty = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    backupDatabaseToB2().catch((err) => {
      console.warn('[DB Backup] Scheduled backup error:', err.message);
    });
  }, delayMs);
}

/**
 * Restores the database from Backblaze B2 into the local DB path.
 * This runs on startup BEFORE the DB connection is opened.
 */
async function restoreDatabaseFromB2({ force = false } = {}) {
  if (!b2.isB2Configured()) {
    console.warn('[DB Restore] Backblaze B2 credentials not configured. Skipping cloud restore.');
    return { restored: false, reason: 'B2 not configured' };
  }

  const dbFile = getDbFile();
  const exists = fs.existsSync(dbFile);
  const localSize = exists ? fs.statSync(dbFile).size : 0;

  console.log(`[DB Restore] Checking Backblaze B2 for remote database backup '${DB_REMOTE_NAME}'...`);
  try {
    const buffer = await b2.downloadBuffer(DB_REMOTE_NAME);
    if (!buffer || buffer.length === 0) {
      console.log(`[DB Restore] No existing remote database found in Backblaze B2. Keeping local database (${localSize} bytes).`);
      return { restored: false, reason: 'Remote backup not found', localSize };
    }

    const header = buffer.toString('utf8', 0, 15);
    if (!header.startsWith('SQLite format 3')) {
      console.error('[DB Restore] Downloaded cloud file is not a valid SQLite database.');
      return { restored: false, reason: 'Invalid SQLite header' };
    }

    fs.mkdirSync(path.dirname(dbFile), { recursive: true });

    // Clean up stale WAL / SHM files if any exist
    try {
      if (fs.existsSync(`${dbFile}-wal`)) fs.unlinkSync(`${dbFile}-wal`);
      if (fs.existsSync(`${dbFile}-shm`)) fs.unlinkSync(`${dbFile}-shm`);
    } catch { /* ignore */ }

    fs.writeFileSync(dbFile, buffer);
    console.log(`[DB Restore] ✓ Successfully restored database from Backblaze B2 (${buffer.length} bytes)!`);
    lastBackupTime = new Date().toISOString();
    lastBackupSize = buffer.length;
    isDirty = false;
    return { restored: true, size: buffer.length };
  } catch (err) {
    console.warn('[DB Restore] Could not restore database from Backblaze B2:', err.message);
    return { restored: false, error: err.message };
  }
}

function getBackupStatus() {
  return {
    isConfigured: b2.isB2Configured(),
    bucket: b2.B2_BUCKET_NAME,
    remotePath: DB_REMOTE_NAME,
    lastBackupTime,
    lastBackupSize,
    lastBackupError,
    isBackingUp,
    isDirty
  };
}

module.exports = {
  getDbFile,
  backupDatabaseToB2,
  scheduleDbBackup,
  restoreDatabaseFromB2,
  getBackupStatus
};
