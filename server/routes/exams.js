const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { catalog } = require('../lib/styles');

const router = express.Router();

function publicExam(row, extra = {}) {
  const qCount = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE exam_id = ?').get(row.id).c;
  const sections = db.prepare('SELECT id, name, duration_sec, order_index FROM sections WHERE exam_id = ? ORDER BY order_index').all(row.id);
  return {
    ...row,
    question_count: qCount,
    sections,
    total_marks: +(qCount * (row.marks_per_q || 1)).toFixed(2),
    ...extra
  };
}

router.get('/catalog', auth(), (_req, res) => {
  res.json(catalog(db));
});

router.get('/families', auth(), (_req, res) => {
  const { families } = catalog(db);
  res.json({
    families: families.map((f) => ({
      id: f.id,
      name: f.label,
      stage: f.coming_soon ? 'Coming soon' : 'Live',
      accent: '#5B45EA',
      blurb: f.label,
      pattern: ''
    }))
  });
});

router.get('/', auth(), (req, res) => {
  const { family, type, subject, q } = req.query;
  let sql = 'SELECT * FROM exams WHERE coming_soon = 0 AND is_published = 1';
  const params = [];
  if (family) { sql += ' AND exam_family = ?'; params.push(family); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (subject) { sql += ' AND subject = ?'; params.push(subject); }
  if (q) { sql += ' AND (title LIKE ? OR subject LIKE ? OR description LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY type, subject, title';
  const rows = db.prepare(sql).all(...params);
  const attempted = db.prepare(
    `SELECT exam_id, COUNT(*) AS n, MAX(score) AS best
     FROM attempts WHERE user_id = ? AND status = 'submitted' GROUP BY exam_id`
  ).all(req.user.id);
  const lasts = db.prepare(
    `SELECT exam_id, id FROM attempts WHERE user_id = ? AND status = 'submitted' ORDER BY submitted_at DESC, id DESC`
  ).all(req.user.id);
  const lastId = {};
  lasts.forEach((row) => { if (!lastId[row.exam_id]) lastId[row.exam_id] = row.id; });
  const map = Object.fromEntries(attempted.map((a) => [a.exam_id, { ...a, last_id: lastId[a.exam_id] }]));
  res.json({ exams: rows.map((r) => publicExam(r, { my: map[r.id] || null })) });
});

router.get('/start-pick', auth(), (_req, res) => {
  const hi = db.prepare(`
    SELECT id, title, code, type FROM exams
    WHERE is_published = 1 AND coming_soon = 0 AND type = 'high_influence'
    ORDER BY updated_at DESC LIMIT 1
  `).get();
  const full = db.prepare(`
    SELECT id, title, code, type FROM exams
    WHERE is_published = 1 AND coming_soon = 0 AND type = 'full'
    ORDER BY updated_at DESC LIMIT 1
  `).get();
  const any = db.prepare(`
    SELECT id, title, code, type FROM exams
    WHERE is_published = 1 AND coming_soon = 0
    ORDER BY updated_at DESC LIMIT 1
  `).get();
  const exam = hi || full || any;
  if (!exam) return res.status(404).json({ error: 'No paper to start' });
  res.json({ exam });
});

router.get('/subjects', auth(), (req, res) => {
  const family = req.query.family || 'IBPS_SO_IT';
  const rows = db.prepare(`
    SELECT subject, type, COUNT(*) AS tests, SUM((SELECT COUNT(*) FROM questions q WHERE q.exam_id = exams.id)) AS questions
    FROM exams WHERE exam_family = ? AND is_published = 1 AND coming_soon = 0 AND subject IS NOT NULL
    GROUP BY subject, type ORDER BY subject
  `).all(family);
  res.json({ subjects: rows });
});

router.get('/:id', auth(), (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const attempts = db.prepare(
    `SELECT id, status, score, max_score, accuracy, started_at, submitted_at
     FROM attempts WHERE user_id = ? AND exam_id = ? ORDER BY started_at DESC LIMIT 8`
  ).all(req.user.id, exam.id);
  const inProgress = attempts.find((a) => a.status === 'in_progress');
  res.json({ exam: publicExam(exam), attempts, inProgress: inProgress || null });
});

router.get('/:id/leaderboard', auth(), (req, res) => {
  const rows = db.prepare(`
    SELECT u.name, u.avatar_color, a.score, a.accuracy, a.submitted_at
    FROM attempts a JOIN users u ON u.id = a.user_id
    WHERE a.exam_id = ? AND a.status = 'submitted'
    ORDER BY a.score DESC, a.submitted_at ASC
    LIMIT 20
  `).all(req.params.id);
  res.json({ leaderboard: rows });
});

module.exports = router;
