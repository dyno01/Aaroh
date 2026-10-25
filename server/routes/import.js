const express = require('express');
const multer = require('multer');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');
const { packHints, buildHints } = require('../lib/hints');
const { upsertStyle, prettySlug, slugFamily, slugType } = require('../lib/styles');

const router = express.Router();
router.use(auth(), admin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function optionList(row) {
  const opts = [];
  ['a', 'b', 'c', 'd', 'e'].forEach((k) => {
    const val = row[`option_${k}`] || row[`opt_${k}`] || row[k];
    if (val) opts.push({ id: k, en: val, hi: row[`option_${k}_hi`] || '' });
  });
  if (row.options) {
    try {
      const parsed = JSON.parse(row.options);
      if (Array.isArray(parsed)) return parsed.map((p, i) => (typeof p === 'string' ? { id: 'abcde'[i], en: p } : p));
    } catch { /* ignore */ }
  }
  return opts;
}

function upsertExam(meta) {
  const code = meta.code || meta.exam_code;
  if (!code) throw new Error('Each exam needs a code');
  const existing = db.prepare('SELECT id FROM exams WHERE code = ?').get(code);
  const fields = {
    code,
    title: meta.title || meta.exam_title || code,
    description: meta.description || '',
    exam_family: meta.exam_family || 'IBPS_SO_IT',
    stage: meta.stage || 'prelims',
    type: meta.type || meta.exam_type || 'subject',
    subject: meta.subject || null,
    duration_sec: Number(meta.duration_sec || (Number(meta.duration_min || 10) * 60)),
    marks_per_q: Number(meta.marks_per_q ?? 1),
    negative_per_q: Number(meta.negative_per_q ?? meta.negative ?? 0.25),
    difficulty: meta.difficulty || 'moderate',
    max_hints: Number(meta.max_hints ?? 3),
    hints_enabled: meta.hints_enabled === '0' ? 0 : 1,
    calculator: meta.calculator === '1' || meta.calculator === true ? 1 : 0,
    instructions: meta.instructions || '',
    is_published: meta.is_published === '0' ? 0 : 1,
    coming_soon: 0
  };
  if (existing) {
    db.prepare(`
      UPDATE exams SET title=?, description=?, exam_family=?, stage=?, type=?, subject=?, duration_sec=?,
        marks_per_q=?, negative_per_q=?, difficulty=?, max_hints=?, hints_enabled=?, calculator=?, instructions=?,
        is_published=?, updated_at=datetime('now') WHERE id=?
    `).run(fields.title, fields.description, fields.exam_family, fields.stage, fields.type, fields.subject,
      fields.duration_sec, fields.marks_per_q, fields.negative_per_q, fields.difficulty, fields.max_hints,
      fields.hints_enabled, fields.calculator, fields.instructions, fields.is_published, existing.id);
    return existing.id;
  }
  const info = db.prepare(`
    INSERT INTO exams (code, title, description, exam_family, stage, type, subject, duration_sec, marks_per_q,
      negative_per_q, difficulty, max_hints, hints_enabled, calculator, instructions, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fields.code, fields.title, fields.description, fields.exam_family, fields.stage, fields.type, fields.subject,
    fields.duration_sec, fields.marks_per_q, fields.negative_per_q, fields.difficulty, fields.max_hints,
    fields.hints_enabled, fields.calculator, fields.instructions, fields.is_published);
  return info.lastInsertRowid;
}

function insertQuestion(examId, row, index, examMeta) {
  const q = row.q_en || row.question || row.question_en;
  if (!q) return false;
  const options = optionList(row);
  if (options.length < 2) return false;
  let correct = String(row.correct || row.answer || 'a').toLowerCase().trim();
  if (['1', '2', '3', '4', '5'].includes(correct)) correct = 'abcde'[Number(correct) - 1];
  if (!['a', 'b', 'c', 'd', 'e'].includes(correct)) {
    const match = options.find((o) => o.en.toLowerCase() === correct);
    correct = match ? match.id : 'a';
  }
  const hintsJson = packHints(buildHints({
    hint: row.hint || row.hint_1,
    hint_2: row.hint_2,
    hint_3: row.hint_3,
    explanation: row.explanation,
    topic: row.topic
  }));
  db.prepare(`
    INSERT INTO questions (exam_id, section, subject, topic, difficulty, q_en, q_hi, options_json, correct, explanation, hint, hints_json, marks, negative, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    examId,
    row.section || examMeta.subject || 'Paper',
    row.subject || examMeta.subject || '',
    row.topic || '',
    row.q_difficulty || row.difficulty || 'moderate',
    q,
    row.q_hi || row.question_hi || '',
    JSON.stringify(options),
    correct,
    row.explanation || '',
    row.hint || row.hint_1 || '',
    hintsJson,
    Number(row.marks ?? examMeta.marks_per_q ?? 1),
    Number(row.negative ?? examMeta.negative_per_q ?? 0.25),
    index
  );
  return true;
}

const META_KEYS = [
  'exam_title', 'title', 'exam_family', 'exam_type', 'type', 'stage', 'subject',
  'duration_min', 'duration_sec', 'marks_per_q', 'negative', 'max_hints',
  'family_label', 'type_label', 'description', 'instructions'
];

function applyMeta(rows, ov) {
  if (!ov || typeof ov !== 'object') return rows;
  const patch = {};
  META_KEYS.forEach((k) => {
    if (ov[k] !== undefined && ov[k] !== '') patch[k] = ov[k];
  });
  if (!Object.keys(patch).length) return rows;
  return rows.map((r) => ({ ...r, ...patch }));
}

function papersFromRows(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const code = r.exam_code || r.code || 'IMPORTED';
    if (!map.has(code)) {
      map.set(code, {
        exam_code: code,
        exam_title: r.exam_title || r.title || code,
        exam_family: r.exam_family || 'IBPS_SO_IT',
        exam_type: r.exam_type || r.type || 'subject',
        stage: r.stage || '',
        subject: r.subject || '',
        duration_min: Number(r.duration_min || (Number(r.duration_sec || 0) / 60) || 10),
        marks_per_q: Number(r.marks_per_q ?? 1),
        negative: Number(r.negative ?? r.negative_per_q ?? 0.25),
        max_hints: Number(r.max_hints ?? 3),
        family_label: r.family_label || '',
        type_label: r.type_label || '',
        count: 0
      });
    }
    map.get(code).count += 1;
  });
  return [...map.values()];
}

function ingestRows(rows, replaceQuestions) {
  const grouped = new Map();
  rows.forEach((r) => {
    const code = r.exam_code || r.code || 'IMPORTED';
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code).push(r);
  });
  const summary = [];
  for (const [code, list] of grouped) {
    const meta = { ...list[0], code, title: list[0].exam_title || list[0].title || code };
    const fam = slugFamily(meta.family_label || meta.exam_family || 'IBPS_SO_IT');
    const typ = slugType(meta.type_label || meta.exam_type || meta.type || 'subject');
    meta.exam_family = fam;
    meta.type = typ;
    upsertStyle(db, 'family', fam, meta.family_label || prettySlug(fam), { live: true });
    upsertStyle(db, 'type', typ, meta.type_label || prettySlug(typ), { live: true });
    const examId = upsertExam(meta);
    if (replaceQuestions) db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
    let added = 0;
    list.forEach((row, i) => {
      if (insertQuestion(examId, row, i + 1, meta)) added += 1;
    });
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    summary.push({ examId, code, title: exam.title, added });
  }
  return summary;
}

router.post('/preview', upload.single('file'), (req, res) => {
  try {
    const { rows, kind } = readUpload(req);
    res.json({
      kind,
      count: rows.length,
      sample: rows.slice(0, 8),
      headers: Object.keys(rows[0] || {}),
      papers: papersFromRows(rows)
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/commit', upload.single('file'), (req, res) => {
  try {
    let { rows } = readUpload(req);
    let ov = req.body?.overrides;
    if (typeof ov === 'string') {
      try { ov = JSON.parse(ov); } catch { ov = {}; }
    }
    rows = applyMeta(rows, ov);
    const replace = req.body?.replace === '1' || req.body?.replace === true;
    const summary = ingestRows(rows, replace);
    db.prepare('INSERT INTO audit_log (admin_id, action, entity, payload) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'import', 'exam', JSON.stringify(summary));
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/json', (req, res) => {
  try {
    const body = req.body;
    let rows = [];
    if (Array.isArray(body)) rows = body;
    else if (body.questions && body.exam) {
      rows = body.questions.map((q) => ({ ...body.exam, ...q, exam_code: body.exam.code, exam_title: body.exam.title }));
    } else if (body.exams) {
      body.exams.forEach((ex) => {
        (ex.questions || []).forEach((q) => rows.push({ ...ex, ...q, exam_code: ex.code, exam_title: ex.title, question: q.q_en || q.question }));
      });
    } else {
      return res.status(400).json({ error: 'Unrecognised JSON shape' });
    }
    rows = applyMeta(rows, body.overrides || body.exam || {});
    const summary = ingestRows(rows, !!body.replace);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function readUpload(req) {
  if (req.body?.rows) return { rows: req.body.rows, kind: 'json' };
  if (!req.file) throw new Error('Upload a CSV or JSON file');
  const text = req.file.buffer.toString('utf8');
  const name = (req.file.originalname || '').toLowerCase();
  if (name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { rows: parsed, kind: 'json' };
    if (parsed.questions && parsed.exam) {
      return {
        kind: 'json',
        rows: parsed.questions.map((q) => ({ ...parsed.exam, ...q, exam_code: parsed.exam.code, exam_title: parsed.exam.title, q_en: q.q_en || q.question }))
      };
    }
    throw new Error('JSON must be an array of rows or { exam, questions }');
  }
  const { rows } = parseCsv(text);
  if (!rows.length) throw new Error('CSV has no data rows');
  return { rows, kind: 'csv' };
}

module.exports = router;
