const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbFile = process.env.DB_PATH || path.join(__dirname, 'aaroh.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  avatar_color TEXT DEFAULT '#5B45EA',
  streak INTEGER DEFAULT 0,
  last_active TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  exam_family TEXT NOT NULL,
  stage TEXT,
  type TEXT NOT NULL,
  subject TEXT,
  duration_sec INTEGER NOT NULL,
  marks_per_q REAL DEFAULT 1,
  negative_per_q REAL DEFAULT 0.25,
  difficulty TEXT DEFAULT 'moderate',
  is_published INTEGER DEFAULT 1,
  max_hints INTEGER DEFAULT 3,
  hints_enabled INTEGER DEFAULT 1,
  calculator INTEGER DEFAULT 0,
  mark_for_review INTEGER DEFAULT 1,
  skip_allowed INTEGER DEFAULT 1,
  show_palette INTEGER DEFAULT 1,
  bilingual INTEGER DEFAULT 0,
  extra_time_sec INTEGER DEFAULT 0,
  allow_pause INTEGER DEFAULT 0,
  show_timer INTEGER DEFAULT 1,
  allow_section_switch INTEGER DEFAULT 1,
  show_explanations_after INTEGER DEFAULT 1,
  allow_reattempt INTEGER DEFAULT 1,
  shuffle_questions INTEGER DEFAULT 0,
  shuffle_options INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 0,
  passing_pct REAL DEFAULT 0,
  instructions TEXT,
  coming_soon INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  duration_sec INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  section TEXT,
  subject TEXT,
  topic TEXT,
  difficulty TEXT DEFAULT 'moderate',
  q_en TEXT NOT NULL,
  q_hi TEXT,
  options_json TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  hint TEXT,
  marks REAL DEFAULT 1,
  negative REAL DEFAULT 0.25,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  exam_id INTEGER NOT NULL,
  status TEXT DEFAULT 'in_progress',
  started_at TEXT DEFAULT (datetime('now')),
  submitted_at TEXT,
  duration_sec INTEGER,
  extra_time_sec INTEGER DEFAULT 0,
  answers_json TEXT DEFAULT '{}',
  current_qid INTEGER,
  current_section TEXT,
  hints_used INTEGER DEFAULT 0,
  paused INTEGER DEFAULT 0,
  pause_remaining_sec INTEGER DEFAULT 0,
  score REAL,
  max_score REAL,
  correct_count INTEGER,
  wrong_count INTEGER,
  skipped_count INTEGER,
  accuracy REAL,
  settings_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT,
  entity TEXT,
  entity_id INTEGER,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);
`);

try {
  const cols = db.prepare('PRAGMA table_info(questions)').all().map((c) => c.name);
  if (!cols.includes('hints_json')) db.exec('ALTER TABLE questions ADD COLUMN hints_json TEXT');
} catch (e) {
  console.error('hints_json migrate', e);
}

try {
  const ucols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!ucols.includes('username')) db.exec('ALTER TABLE users ADD COLUMN username TEXT');
  db.prepare(`
    UPDATE users SET username = lower(replace(name, ' ', ''))
    WHERE username IS NULL OR username = ''
  `).run();
  db.prepare(`
    UPDATE users SET name = 'Nikita Rathod'
    WHERE email = 'demo@aaroh.in' AND name IN ('Aarav Shah', 'Aarav', 'Nikita')
  `).run();
} catch (e) {
  console.error('username migrate', e);
}

try {
  const { parseHints, buildHints } = require('./lib/hints');
  const rows = db.prepare('SELECT id, hint, explanation, topic, hints_json FROM questions').all();
  const upd = db.prepare('UPDATE questions SET hints_json = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const r of rows) {
      if (parseHints(r).length >= 3) continue;
      upd.run(JSON.stringify(buildHints(r)), r.id);
    }
  });
  tx();
} catch (e) {
  console.error('fillHints', e);
}

try {
  db.prepare("DELETE FROM exams WHERE code = 'AAROH-DEMO-UI'").run();
} catch (e) {
  console.error('removeDemo', e);
}

try {
  require('./lib/styles').ensureStyles(db);
} catch (e) {
  console.error('paper_styles', e);
}

try {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('Aaroh@123', 10);
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role, avatar_color, username, streak) VALUES (?, ?, ?, 'admin', '#5B45EA', 'coach', 0)"
    ).run('Coach', 'admin@aaroh.in', hash);
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role, avatar_color, username, streak) VALUES (?, ?, ?, 'student', '#F0B429', 'nikita', 0)"
    ).run('Nikita Rathod', 'demo@aaroh.in', hash);
    console.log('Created demo accounts admin@aaroh.in / demo@aaroh.in');
  }
} catch (e) {
  console.error('ensureUsers', e);
}

module.exports = db;
