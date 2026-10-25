const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');
const { broadcastExamSettings, broadcastAttemptPatch } = require('../realtime');
const { packHints, buildHints } = require('../lib/hints');
const { catalog, upsertStyle, listStyles, slugFamily, slugType, prettySlug } = require('../lib/styles');

const router = express.Router();
router.use(auth(), admin);

function log(req, action, entity, entity_id, payload) {
  db.prepare('INSERT INTO audit_log (admin_id, action, entity, entity_id, payload) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, action, entity, entity_id || null, JSON.stringify(payload || {}));
}

const SETTINGS_KEYS = [
  'max_hints', 'hints_enabled', 'calculator', 'mark_for_review', 'skip_allowed',
  'show_palette', 'bilingual', 'extra_time_sec', 'allow_pause', 'show_timer',
  'allow_section_switch', 'show_explanations_after', 'allow_reattempt',
  'shuffle_questions', 'shuffle_options', 'max_attempts', 'passing_pct',
  'is_published', 'duration_sec', 'marks_per_q', 'negative_per_q', 'difficulty',
  'title', 'description', 'instructions', 'type', 'subject', 'stage', 'exam_family'
];

router.get('/overview', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const exams = db.prepare('SELECT COUNT(*) AS c FROM exams').get().c;
  const questions = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c;
  const attempts = db.prepare("SELECT COUNT(*) AS c FROM attempts WHERE status = 'submitted'").get().c;
  const live = db.prepare("SELECT COUNT(*) AS c FROM attempts WHERE status = 'in_progress'").get().c;
  const recent = db.prepare(`
    SELECT a.id, a.score, a.accuracy, a.submitted_at, u.name, e.title
    FROM attempts a JOIN users u ON u.id = a.user_id JOIN exams e ON e.id = a.exam_id
    WHERE a.status = 'submitted' ORDER BY a.submitted_at DESC LIMIT 8
  `).all();
  const byFamily = db.prepare('SELECT exam_family, COUNT(*) AS c FROM exams GROUP BY exam_family').all();
  res.json({ users, exams, questions, attempts, live, recent, byFamily });
});

router.get('/exams', (req, res) => {
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
      (SELECT COUNT(*) FROM attempts a WHERE a.exam_id = e.id AND a.status = 'submitted') AS attempt_count,
      (SELECT COUNT(*) FROM attempts a WHERE a.exam_id = e.id AND a.status = 'in_progress') AS live_count
    FROM exams e ORDER BY e.updated_at DESC
  `).all();
  res.json({ exams: rows });
});

router.post('/exams', (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.code) return res.status(400).json({ error: 'Title and code are required' });
  try {
    const info = db.prepare(`
      INSERT INTO exams (code, title, description, exam_family, stage, type, subject, duration_sec,
        marks_per_q, negative_per_q, difficulty, max_hints, instructions, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.code, b.title, b.description || '', b.exam_family || 'IBPS_SO_IT', b.stage || 'prelims',
      b.type || 'subject', b.subject || null, b.duration_sec || 600,
      b.marks_per_q ?? 1, b.negative_per_q ?? 0.25, b.difficulty || 'moderate',
      b.max_hints ?? 3, b.instructions || '', b.is_published ?? 1
    );
    if (Array.isArray(b.sections)) {
      const ins = db.prepare('INSERT INTO sections (exam_id, name, duration_sec, order_index) VALUES (?, ?, ?, ?)');
      b.sections.forEach((s, i) => ins.run(info.lastInsertRowid, s.name, s.duration_sec || 0, i));
    }
    upsertStyle(db, 'family', b.exam_family || 'IBPS_SO_IT', prettySlug(b.exam_family || 'IBPS_SO_IT'), { live: true });
    upsertStyle(db, 'type', b.type || 'subject', prettySlug(b.type || 'subject'), { live: true });
    log(req, 'create_exam', 'exam', info.lastInsertRowid, { code: b.code });
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Exam code already exists' });
    throw e;
  }
});

router.get('/exams/:id', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id').all(exam.id);
  const sections = db.prepare('SELECT * FROM sections WHERE exam_id = ? ORDER BY order_index').all(exam.id);
  res.json({ exam, questions, sections });
});

router.patch('/exams/:id', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const updates = [];
  const vals = [];
  for (const k of SETTINGS_KEYS) {
    if (b[k] !== undefined) {
      updates.push(`${k} = ?`);
      const v = b[k];
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
  }
  if (!updates.length) return res.json({ exam, applied: false });
  updates.push("updated_at = datetime('now')");
  db.prepare(`UPDATE exams SET ${updates.join(', ')} WHERE id = ?`).run(...vals, exam.id);
  const fresh = db.prepare('SELECT * FROM exams WHERE id = ?').get(exam.id);
  if (fresh.exam_family) upsertStyle(db, 'family', fresh.exam_family, prettySlug(fresh.exam_family), { live: true });
  if (fresh.type) upsertStyle(db, 'type', fresh.type, prettySlug(fresh.type), { live: true });
  log(req, 'update_exam', 'exam', exam.id, b);
  const liveSettings = {
    max_hints: fresh.max_hints,
    hints_enabled: !!fresh.hints_enabled,
    calculator: !!fresh.calculator,
    mark_for_review: !!fresh.mark_for_review,
    skip_allowed: !!fresh.skip_allowed,
    show_palette: !!fresh.show_palette,
    bilingual: !!fresh.bilingual,
    extra_time_sec: fresh.extra_time_sec || 0,
    allow_pause: !!fresh.allow_pause,
    show_timer: !!fresh.show_timer,
    allow_section_switch: !!fresh.allow_section_switch,
    shuffle_questions: !!fresh.shuffle_questions,
    shuffle_options: !!fresh.shuffle_options
  };
  const message = b._message || buildChangeMessage(b);
  broadcastExamSettings(exam.id, liveSettings, message, req.user.name);
  res.json({ exam: fresh, applied: true, live: true });
});

function buildChangeMessage(b) {
  const bits = [];
  if (b.max_hints !== undefined) bits.push(`hints cap is now ${b.max_hints}`);
  if (b.hints_enabled === 0 || b.hints_enabled === false) bits.push('hints were turned off');
  if (b.hints_enabled === 1 || b.hints_enabled === true) bits.push('hints were turned on');
  if (b.extra_time_sec) bits.push(`+${Math.round(b.extra_time_sec / 60)} min extra time`);
  if (b.calculator !== undefined) bits.push(b.calculator ? 'calculator enabled' : 'calculator disabled');
  if (b.allow_pause !== undefined) bits.push(b.allow_pause ? 'pause allowed' : 'pause locked');
  if (b.bilingual !== undefined) bits.push(b.bilingual ? 'Hindi unlocked' : 'English only');
  if (b.mark_for_review !== undefined) bits.push(b.mark_for_review ? 'mark-for-review on' : 'mark-for-review off');
  return bits.length ? `Live update: ${bits.join(' · ')}` : 'Exam settings updated — applied instantly';
}

router.delete('/exams/:id', (req, res) => {
  db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
  log(req, 'delete_exam', 'exam', Number(req.params.id), {});
  res.json({ ok: true });
});

router.post('/exams/:id/questions', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const b = req.body || {};
  if (!b.q_en || !b.options || !b.correct) return res.status(400).json({ error: 'Question, options and correct answer are required' });
  const maxOrd = db.prepare('SELECT COALESCE(MAX(order_index), 0) AS m FROM questions WHERE exam_id = ?').get(exam.id).m;
  const hintsList = Array.isArray(b.hints) ? b.hints : [b.hint, b.hint_2, b.hint_3];
  const hintsJson = packHints(hintsList.filter(Boolean).length ? hintsList : buildHints({
    hint: b.hint, explanation: b.explanation, topic: b.topic
  }));
  const info = db.prepare(`
    INSERT INTO questions (exam_id, section, subject, topic, difficulty, q_en, q_hi, options_json, correct, explanation, hint, hints_json, marks, negative, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    exam.id, b.section || exam.subject || 'Paper', b.subject || exam.subject, b.topic || '',
    b.difficulty || 'moderate', b.q_en, b.q_hi || '', JSON.stringify(b.options),
    b.correct, b.explanation || '', (hintsList.filter(Boolean)[0] || b.hint || ''), hintsJson,
    b.marks ?? exam.marks_per_q, b.negative ?? exam.negative_per_q, maxOrd + 1
  );
  res.json({ id: info.lastInsertRowid });
});

router.patch('/questions/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  const fields = ['section', 'subject', 'topic', 'difficulty', 'q_en', 'q_hi', 'correct', 'explanation', 'hint', 'marks', 'negative', 'order_index'];
  const updates = [];
  const vals = [];
  fields.forEach((k) => {
    if (b[k] !== undefined) { updates.push(`${k} = ?`); vals.push(b[k]); }
  });
  if (b.options) { updates.push('options_json = ?'); vals.push(JSON.stringify(b.options)); }
  if (b.hints || b.hint_2 || b.hint_3) {
    updates.push('hints_json = ?');
    vals.push(packHints(Array.isArray(b.hints) ? b.hints : [b.hint, b.hint_2, b.hint_3]));
  }
  if (!updates.length) return res.json({ ok: true });
  db.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`).run(...vals, q.id);
  res.json({ ok: true });
});

router.delete('/questions/:id', (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/live', (_req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.user_id, a.exam_id, a.started_at, a.hints_used, a.current_section, a.extra_time_sec,
           u.name, u.email, u.avatar_color,
           e.title, e.max_hints, e.duration_sec, e.extra_time_sec AS exam_extra
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN exams e ON e.id = a.exam_id
    WHERE a.status = 'in_progress'
    ORDER BY a.started_at DESC
  `).all();
  res.json({ sessions: rows });
});

router.post('/live/:attemptId/patch', (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(req.params.attemptId);
  if (!attempt || attempt.status !== 'in_progress') return res.status(404).json({ error: 'No live attempt' });
  const { extra_time_sec, bonus_hints, message } = req.body || {};
  if (extra_time_sec) {
    db.prepare('UPDATE attempts SET extra_time_sec = extra_time_sec + ? WHERE id = ?').run(Number(extra_time_sec), attempt.id);
  }
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
  const patch = {
    extra_time_sec: extra_time_sec ? Number(extra_time_sec) : 0,
    bonus_hints: bonus_hints ? Number(bonus_hints) : 0,
    max_hints: (exam.max_hints || 0) + (bonus_hints ? Number(bonus_hints) : 0)
  };
  if (bonus_hints) {
    db.prepare('UPDATE exams SET max_hints = max_hints + ? WHERE id = ?').run(Number(bonus_hints), exam.id);
  }
  broadcastAttemptPatch(attempt.id, attempt.exam_id, patch, message || 'Coach sent you a live boost');
  log(req, 'live_patch', 'attempt', attempt.id, patch);
  res.json({ ok: true, patch });
});

router.get('/students', (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.streak, u.created_at, u.last_active, u.avatar_color,
      (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id AND a.status = 'submitted') AS tests,
      (SELECT ROUND(AVG(score), 1) FROM attempts a WHERE a.user_id = u.id AND a.status = 'submitted') AS avg_score
    FROM users u ORDER BY u.created_at DESC
  `).all();
  res.json({ students: rows });
});

router.patch('/students/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { role, name } = req.body || {};
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, u.id);
  res.json({ ok: true });
});

router.get('/audit', (_req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.name AS admin_name
    FROM audit_log l LEFT JOIN users u ON u.id = l.admin_id
    ORDER BY l.created_at DESC LIMIT 50
  `).all();
  res.json({ audit: rows });
});

router.get('/styles', (_req, res) => {
  res.json({
    families: listStyles(db, 'family'),
    types: listStyles(db, 'type'),
    catalog: catalog(db)
  });
});

router.post('/styles', (req, res) => {
  const { kind, label, slug, coming_soon } = req.body || {};
  if (!['family', 'type'].includes(kind)) return res.status(400).json({ error: 'kind must be family or type' });
  if (!label || !String(label).trim()) return res.status(400).json({ error: 'Give the button a name' });
  const id = kind === 'family'
    ? (slug ? slugFamily(slug) : slugFamily(label))
    : (slug ? slugType(slug) : slugType(label));
  const rowId = upsertStyle(db, kind, id, String(label).trim(), { coming_soon: !!coming_soon });
  const row = db.prepare('SELECT * FROM paper_styles WHERE id = ?').get(rowId);
  if (coming_soon !== undefined) {
    db.prepare('UPDATE paper_styles SET coming_soon = ? WHERE id = ?').run(coming_soon ? 1 : 0, rowId);
  }
  log(req, 'create_style', 'paper_styles', rowId, { kind, slug: id });
  res.json({ style: db.prepare('SELECT * FROM paper_styles WHERE id = ?').get(rowId) || row });
});

router.patch('/styles/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM paper_styles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { label, coming_soon, sort_order } = req.body || {};
  db.prepare('UPDATE paper_styles SET label = ?, coming_soon = ?, sort_order = ? WHERE id = ?').run(
    label != null ? String(label).trim() : row.label,
    coming_soon === undefined ? row.coming_soon : (coming_soon ? 1 : 0),
    sort_order != null ? Number(sort_order) : row.sort_order,
    row.id
  );
  res.json({ style: db.prepare('SELECT * FROM paper_styles WHERE id = ?').get(row.id) });
});

router.delete('/styles/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM paper_styles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM paper_styles WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

router.post('/students', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, String(email).toLowerCase(), hash, role || 'student');
    res.json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'Email already exists' });
  }
});

module.exports = router;
