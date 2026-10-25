const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');
const { broadcastExamSettings, broadcastAttemptPatch } = require('../realtime');
const { packHints, buildHints } = require('../lib/hints');
const { catalog, upsertStyle, listStyles, slugFamily, slugType, prettySlug } = require('../lib/styles');
const { saveExamToDisk, examToCsvString, syncAllExamsToDisk } = require('../lib/paperSync');

const router = express.Router();
router.use(auth(), admin);

function log(req, action, entity, entity_id, payload) {
  db.prepare('INSERT INTO audit_log (admin_id, action, entity, entity_id, payload) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, action, entity, entity_id || null, JSON.stringify(payload || {}));
}

const SETTINGS_KEYS = [
  'max_hints', 'hint_mode', 'hints_enabled', 'calculator', 'mark_for_review', 'skip_allowed',
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

router.get('/exams/:id/export.csv', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).send('Not found');
  const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id').all(exam.id);
  const csv = examToCsvString(exam, questions);
  const safeCode = (exam.code || 'PAPER').replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeCode}.csv"`);
  res.send(csv);
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
    hint_mode: fresh.hint_mode || 'lifeline',
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
  if (b.hint_mode) bits.push(b.hint_mode === 'per_question' ? 'hint mode changed to per-question ladder' : 'hint mode changed to lifeline pool');
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

router.post('/exams/batch-settings', (req, res) => {
  const {
    scope = 'all',
    exam_family,
    exam_ids,
    settings = {},
    _message
  } = req.body || {};

  const mergedSettings = { ...settings };
  for (const k of SETTINGS_KEYS) {
    if (req.body[k] !== undefined && mergedSettings[k] === undefined) {
      mergedSettings[k] = req.body[k];
    }
  }

  let targetExams = [];
  if (scope === 'selected' && Array.isArray(exam_ids) && exam_ids.length) {
    const ph = exam_ids.map(() => '?').join(',');
    targetExams = db.prepare(`SELECT id, title, exam_family FROM exams WHERE id IN (${ph})`).all(...exam_ids);
  } else if (scope === 'family' && exam_family) {
    targetExams = db.prepare('SELECT id, title, exam_family FROM exams WHERE exam_family = ?').all(exam_family);
  } else {
    targetExams = db.prepare('SELECT id, title, exam_family FROM exams').all();
  }

  if (!targetExams.length) {
    return res.status(400).json({ error: 'No matching papers found' });
  }

  const updates = [];
  const params = [];
  for (const k of SETTINGS_KEYS) {
    if (mergedSettings[k] !== undefined) {
      const v = mergedSettings[k];
      updates.push(`${k} = ?`);
      params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
  }

  let addExtraSec = 0;
  if (req.body.add_extra_time_sec || mergedSettings.add_extra_time_sec) {
    addExtraSec = Number(req.body.add_extra_time_sec || mergedSettings.add_extra_time_sec);
  }

  if (!updates.length && !addExtraSec) {
    return res.status(400).json({ error: 'No permissions or settings provided to update' });
  }

  if (addExtraSec) {
    updates.push('extra_time_sec = COALESCE(extra_time_sec, 0) + ?');
    params.push(addExtraSec);
  }

  updates.push("updated_at = datetime('now')");

  const updateStmt = db.prepare(`UPDATE exams SET ${updates.join(', ')} WHERE id = ?`);
  const tx = db.transaction(() => {
    for (const ex of targetExams) {
      updateStmt.run(...params, ex.id);
    }
  });
  tx();

  // Broadcast to all active live sessions for each updated exam
  const changeMsg = _message || buildChangeMessage(mergedSettings);
  for (const ex of targetExams) {
    const fresh = db.prepare('SELECT * FROM exams WHERE id = ?').get(ex.id);
    if (fresh) {
      broadcastExamSettings(ex.id, {
        max_hints: fresh.max_hints,
        hint_mode: fresh.hint_mode || 'lifeline',
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
        shuffle_options: !!fresh.shuffle_options,
        show_explanations_after: !!fresh.show_explanations_after,
        allow_reattempt: !!fresh.allow_reattempt,
        is_published: !!fresh.is_published
      }, changeMsg, req.user.name);
    }
  }

  log(req, 'batch_update_settings', 'exams', null, {
    count: targetExams.length,
    scope,
    settings: mergedSettings
  });

  res.json({
    ok: true,
    count: targetExams.length,
    message: `Updated permissions & settings for ${targetExams.length} papers successfully!`
  });
});

router.post('/exams/batch-hints', (req, res) => {
  const {
    scope = 'all',
    exam_family,
    exam_ids,
    max_hints,
    hint_mode,
    hints_enabled
  } = req.body || {};

  let targetExams = [];
  if (scope === 'all') {
    targetExams = db.prepare('SELECT id, title, exam_family FROM exams').all();
  } else if (scope === 'family' && exam_family) {
    targetExams = db.prepare('SELECT id, title, exam_family FROM exams WHERE exam_family = ?').all(exam_family);
  } else if (scope === 'selected' && Array.isArray(exam_ids) && exam_ids.length) {
    const ph = exam_ids.map(() => '?').join(',');
    targetExams = db.prepare(`SELECT id, title, exam_family FROM exams WHERE id IN (${ph})`).all(...exam_ids);
  } else {
    targetExams = db.prepare('SELECT id, title, exam_family FROM exams').all();
  }

  if (!targetExams.length) {
    return res.status(400).json({ error: 'No matching papers found' });
  }

  const updates = [];
  const params = [];
  if (max_hints !== undefined) {
    updates.push('max_hints = ?');
    params.push(Number(max_hints));
  }
  if (hint_mode !== undefined) {
    updates.push('hint_mode = ?');
    params.push(String(hint_mode));
  }
  if (hints_enabled !== undefined) {
    updates.push('hints_enabled = ?');
    params.push(hints_enabled ? 1 : 0);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No hint settings provided to update' });
  }

  updates.push("updated_at = datetime('now')");

  const updateStmt = db.prepare(`UPDATE exams SET ${updates.join(', ')} WHERE id = ?`);
  const tx = db.transaction(() => {
    for (const ex of targetExams) {
      updateStmt.run(...params, ex.id);
    }
  });
  tx();

  // Broadcast to all active live sessions for each updated exam
  for (const ex of targetExams) {
    const fresh = db.prepare('SELECT * FROM exams WHERE id = ?').get(ex.id);
    if (fresh) {
      broadcastExamSettings(ex.id, {
        max_hints: fresh.max_hints,
        hint_mode: fresh.hint_mode || 'lifeline',
        hints_enabled: !!fresh.hints_enabled
      }, `Coach updated hint policy to ${fresh.max_hints} (${fresh.hint_mode}) across papers`, req.user.name);
    }
  }

  log(req, 'batch_update_hints', 'exams', null, {
    count: targetExams.length,
    scope,
    max_hints,
    hint_mode,
    hints_enabled
  });

  res.json({
    ok: true,
    count: targetExams.length,
    message: `Updated hint policy for ${targetExams.length} papers successfully!`
  });
});

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
  const targetId = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { role, name, email, password } = req.body || {};

  // Protect against admin accidentally removing their own admin role
  if (role && u.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin privileges.' });
  }

  if (role && ['admin', 'student'].includes(role)) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  }
  if (name && String(name).trim()) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 80), u.id);
  }
  if (email && String(email).trim()) {
    const em = String(email).trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(em, u.id);
    if (existing) return res.status(409).json({ error: 'That email is already registered by another user' });
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(em, u.id);
  }
  if (password && String(password).trim().length >= 6) {
    const hash = bcrypt.hashSync(String(password).trim(), 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, u.id);
  }
  log(req, 'update_user', 'users', u.id, { role, name, email, passwordChanged: !!password });
  const fresh = db.prepare('SELECT id, name, email, role, streak, avatar_color, username FROM users WHERE id = ?').get(u.id);
  res.json({ ok: true, user: fresh });
});

router.delete('/students/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (req.user.id === u.id) {
    return res.status(400).json({ error: 'You cannot delete your own account while logged in' });
  }
  if (u.email === 'ishwar@aaroh.in' || u.name === 'Ishwar Rathod') {
    return res.status(400).json({ error: 'Cannot delete the primary administrator account' });
  }
  db.prepare('DELETE FROM attempts WHERE user_id = ?').run(u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  log(req, 'delete_user', 'users', u.id, { name: u.name, email: u.email, role: u.role });
  res.json({ ok: true });
});

router.get('/students/:id/performance', (req, res) => {
  const targetId = Number(req.params.id);
  const u = db.prepare('SELECT id, name, email, role, streak, created_at, last_active, avatar_color FROM users WHERE id = ?').get(targetId);
  if (!u) return res.status(404).json({ error: 'Student not found' });

  const attempts = db.prepare(`
    SELECT a.id, a.exam_id, a.status, a.score, a.max_score, a.accuracy, a.correct_count, a.wrong_count,
           a.skipped_count, a.duration_sec, a.hints_used, a.started_at, a.submitted_at,
           e.title, e.code, e.exam_family, e.type, e.subject
    FROM attempts a JOIN exams e ON e.id = a.exam_id
    WHERE a.user_id = ? AND a.status = 'submitted'
    ORDER BY a.submitted_at DESC
  `).all(u.id);

  const liveAttempt = db.prepare(`
    SELECT a.id, a.exam_id, a.started_at, a.current_section, a.hints_used, e.title, e.code
    FROM attempts a JOIN exams e ON e.id = a.exam_id
    WHERE a.user_id = ? AND a.status = 'in_progress'
    LIMIT 1
  `).get(u.id);

  const bySubject = {};
  for (const a of attempts) {
    const questions = db.prepare('SELECT id, subject, section, topic, correct FROM questions WHERE exam_id = ?').all(a.exam_id);
    const row = db.prepare('SELECT answers_json FROM attempts WHERE id = ?').get(a.id);
    let answers = {};
    try { answers = JSON.parse(row?.answers_json || '{}'); } catch { answers = {}; }
    for (const q of questions) {
      const chosen = answers[q.id]?.option;
      const sub = q.subject || q.section || a.subject || 'Paper';
      bySubject[sub] ||= { subject: sub, correct: 0, wrong: 0, skipped: 0, total: 0 };
      bySubject[sub].total += 1;
      if (!chosen) bySubject[sub].skipped += 1;
      else if (chosen === q.correct) bySubject[sub].correct += 1;
      else bySubject[sub].wrong += 1;
    }
  }

  const subjects = Object.values(bySubject).map((s) => {
    const attempted = s.correct + s.wrong;
    const accuracy = attempted > 0 ? +((s.correct / attempted) * 100).toFixed(1) : 0;
    return { ...s, attempted, accuracy };
  }).sort((a, b) => b.accuracy - a.accuracy);

  const totalScore = attempts.reduce((acc, cur) => acc + (cur.score || 0), 0);
  const avgScore = attempts.length > 0 ? +(totalScore / attempts.length).toFixed(1) : 0;
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score || 0)) : 0;
  const avgAccuracy = attempts.length > 0 ? +(attempts.reduce((acc, cur) => acc + (cur.accuracy || 0), 0) / attempts.length).toFixed(1) : 0;

  res.json({
    student: u,
    stats: {
      tests_taken: attempts.length,
      avg_score: avgScore,
      best_score: bestScore,
      avg_accuracy: avgAccuracy
    },
    subjects,
    attempts,
    liveAttempt: liveAttempt || null
  });
});

router.get('/analytics', (_req, res) => {
  const students = db.prepare("SELECT id, name, email, streak, last_active FROM users WHERE role = 'student'").all();
  const totalAttempts = db.prepare("SELECT COUNT(*) AS c FROM attempts WHERE status = 'submitted'").get().c;
  const avgAccuracy = db.prepare("SELECT ROUND(AVG(accuracy), 1) AS a FROM attempts WHERE status = 'submitted'").get().a || 0;
  const avgScore = db.prepare("SELECT ROUND(AVG(score), 1) AS s FROM attempts WHERE status = 'submitted'").get().s || 0;

  const recentAttempts = db.prepare(`
    SELECT a.id, a.user_id, a.exam_id, a.score, a.max_score, a.accuracy, a.correct_count, a.wrong_count,
           a.skipped_count, a.duration_sec, a.hints_used, a.submitted_at,
           u.name AS student_name, u.email AS student_email,
           e.title AS exam_title, e.code AS exam_code, e.subject AS exam_subject
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN exams e ON e.id = a.exam_id
    WHERE a.status = 'submitted'
    ORDER BY a.submitted_at DESC
    LIMIT 50
  `).all();

  const examsSummary = db.prepare(`
    SELECT e.id, e.code, e.title, e.subject,
           COUNT(a.id) AS attempts_count,
           ROUND(AVG(a.score), 1) AS avg_score,
           ROUND(AVG(a.accuracy), 1) AS avg_accuracy
    FROM exams e
    LEFT JOIN attempts a ON a.exam_id = e.id AND a.status = 'submitted'
    GROUP BY e.id
    ORDER BY attempts_count DESC, e.title ASC
  `).all();

  res.json({
    summary: {
      total_students: students.length,
      total_attempts: totalAttempts,
      avg_accuracy: avgAccuracy,
      avg_score: avgScore
    },
    students,
    recentAttempts,
    examsSummary
  });
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

router.post('/styles/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const update = db.prepare('UPDATE paper_styles SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    ids.forEach((id, index) => {
      update.run(index, id);
    });
  });
  tx();
  log(req, 'reorder_styles', 'paper_styles', null, { count: ids.length });
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

const b2 = require('../lib/b2');

router.get('/b2/status', async (_req, res) => {
  try {
    const configured = b2.isB2Configured();
    if (!configured) return res.json({ configured: false });
    const files = await b2.listFiles('papers/');
    res.json({
      configured: true,
      bucket: b2.B2_BUCKET_NAME,
      filesCount: files.length,
      files: files.slice(0, 50).map((f) => ({ name: f.fileName, size: f.contentLength, uploaded: f.uploadTimestamp }))
    });
  } catch (err) {
    res.status(500).json({ configured: false, error: err.message });
  }
});

router.post('/b2/sync-to-cloud', async (req, res) => {
  try {
    const result = await b2.syncLocalPapersToB2();
    log(req, 'b2_sync_to_cloud', 'b2', null, result);
    res.json({ ok: true, ...result, message: `Uploaded ${result.uploaded} papers to Backblaze B2!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/b2/restore-from-cloud', async (req, res) => {
  try {
    const result = await b2.restorePapersFromB2();
    const { importTestFolder } = require('../lib/importPack');
    const imported = importTestFolder(db);
    log(req, 'b2_restore_from_cloud', 'b2', null, { restored: result.restored, imported: imported.length });
    res.json({ ok: true, restored: result.restored, imported: imported.length, message: `Restored ${result.restored} papers from Backblaze B2 and synced database!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
