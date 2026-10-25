const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { auth, admin } = require('../middleware/auth');
const { packHints, buildHints } = require('../lib/hints');
const { upsertStyle, prettySlug, slugFamily, slugType } = require('../lib/styles');

const router = express.Router();
router.use(auth(), admin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024 } });

const CSV_HEADERS = [
  'exam_code', 'exam_title', 'exam_type', 'exam_family', 'stage', 'subject', 'section',
  'duration_min', 'marks_per_q', 'negative', 'max_hints', 'question',
  'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
  'correct', 'explanation', 'hint', 'hint_2', 'hint_3',
  'topic', 'difficulty', 'family_label', 'type_label', 'marks'
];

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getTestFolderForType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('debug')) return 'debugging';
  if (t.includes('full')) return 'full';
  if (t.includes('high')) return 'high_influence';
  if (t.includes('subject')) return 'subject';
  return slugType(type) || 'subject';
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length);
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

function rowToCsvLine(row, meta) {
  const opts = optionList(row);
  const optMap = {};
  opts.forEach((o) => { optMap[`option_${o.id}`] = o.en; });

  const q = row.q_en || row.question || row.question_en || '';
  let correct = String(row.correct || row.answer || 'a').toLowerCase().trim();
  if (['1', '2', '3', '4', '5'].includes(correct)) correct = 'abcde'[Number(correct) - 1];
  if (!['a', 'b', 'c', 'd', 'e'].includes(correct)) {
    const match = opts.find((o) => o.en.toLowerCase() === correct);
    correct = match ? match.id : 'a';
  }

  const explanation = row.explanation || '';
  const hint = row.hint || row.hint_1 || '';
  const hint2 = row.hint_2 || '';
  const hint3 = row.hint_3 || '';

  const values = [
    meta.code || meta.exam_code || row.exam_code || 'IMPORTED',
    meta.title || meta.exam_title || row.exam_title || meta.code || '',
    meta.type || meta.exam_type || row.exam_type || 'subject',
    meta.exam_family || row.exam_family || 'IBPS_SO_IT',
    meta.stage || row.stage || 'prelims',
    meta.subject || row.subject || '',
    row.section || meta.subject || 'Paper',
    meta.duration_min || row.duration_min || 10,
    meta.marks_per_q ?? row.marks_per_q ?? 1,
    meta.negative ?? row.negative ?? 0.25,
    meta.max_hints ?? row.max_hints ?? 3,
    q,
    optMap.option_a || row.option_a || row.opt_a || row.a || '',
    optMap.option_b || row.option_b || row.opt_b || row.b || '',
    optMap.option_c || row.option_c || row.opt_c || row.c || '',
    optMap.option_d || row.option_d || row.opt_d || row.d || '',
    optMap.option_e || row.option_e || row.opt_e || row.e || '',
    correct,
    explanation,
    hint,
    hint2,
    hint3,
    row.topic || '',
    row.difficulty || row.q_difficulty || 'moderate',
    meta.family_label || row.family_label || '',
    meta.type_label || row.type_label || '',
    row.marks ?? meta.marks_per_q ?? 1
  ];

  return values.map(escapeCsvCell).join(',');
}

function persistPaperToDisk(meta, rows) {
  try {
    const testDir = path.join(__dirname, '../../test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const sub = getTestFolderForType(meta.type || meta.exam_type);
    const targetFolder = path.join(testDir, sub);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const safeCode = (meta.code || meta.exam_code || 'IMPORTED').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(targetFolder, `${safeCode}.csv`);
    const csvContent = CSV_HEADERS.join(',') + '\n' + rows.map((r) => rowToCsvLine(r, meta)).join('\n') + '\n';
    fs.writeFileSync(filePath, csvContent, 'utf8');
    const relPath = path.relative(path.join(__dirname, '../..'), filePath);
    console.log(`[Import] Saved paper ${meta.code} to ${relPath}`);

    // Asynchronously push to Backblaze B2 cloud storage so it survives redeployment
    try {
      const b2 = require('../lib/b2');
      b2.uploadPaperCsv(sub, `${safeCode}.csv`, csvContent).catch((b2Err) => {
        console.warn(`[Backblaze B2] Background upload warning for ${safeCode}:`, b2Err.message);
      });
    } catch { /* ignore */ }

    return relPath;
  } catch (err) {
    console.error(`[Import] Failed to save paper to disk:`, err);
    return null;
  }
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

function ingestRows(rows, replaceQuestions = true, saveToDisk = true) {
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
    if (replaceQuestions !== false) {
      db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
    }
    let added = 0;
    const tx = db.transaction(() => {
      list.forEach((row, i) => {
        if (insertQuestion(examId, row, i + 1, meta)) added += 1;
      });
    });
    tx();

    let filePath = null;
    if (saveToDisk !== false) {
      filePath = persistPaperToDisk(meta, list);
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    summary.push({
      examId,
      code,
      title: exam.title,
      added,
      filePath,
      exam_family: fam,
      type: typ
    });
  }
  return summary;
}

function parseUploadBuffer(buffer, originalName = '') {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const name = originalName.toLowerCase();
  if (name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { rows: parsed, kind: 'json', headers: Object.keys(parsed[0] || {}) };
    if (parsed.questions && parsed.exam) {
      const rows = parsed.questions.map((q) => ({
        ...parsed.exam,
        ...q,
        exam_code: parsed.exam.code,
        exam_title: parsed.exam.title,
        q_en: q.q_en || q.question
      }));
      return { rows, kind: 'json', headers: Object.keys(rows[0] || {}) };
    }
    if (parsed.exams && Array.isArray(parsed.exams)) {
      const rows = [];
      parsed.exams.forEach((ex) => {
        (ex.questions || []).forEach((q) => rows.push({
          ...ex,
          ...q,
          exam_code: ex.code,
          exam_title: ex.title,
          question: q.q_en || q.question
        }));
      });
      return { rows, kind: 'json', headers: Object.keys(rows[0] || {}) };
    }
    throw new Error('JSON must be an array of rows or { exam, questions } or { exams: [...] }');
  }
  const { rows, headers } = parseCsv(text);
  if (!rows.length) throw new Error('CSV has no data rows');
  return { rows, headers, kind: 'csv' };
}

function readUpload(req) {
  if (req.body?.rows) return { rows: req.body.rows, kind: 'json' };
  const file = req.file || (req.files && req.files[0]);
  if (!file) throw new Error('Upload a CSV or JSON file');
  return parseUploadBuffer(file.buffer, file.originalname || '');
}

router.post('/preview', upload.any(), (req, res) => {
  try {
    const { rows, kind, headers } = readUpload(req);
    res.json({
      kind,
      count: rows.length,
      sample: rows.slice(0, 8),
      headers: headers || Object.keys(rows[0] || {}),
      papers: papersFromRows(rows)
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/commit', upload.any(), (req, res) => {
  try {
    let { rows } = readUpload(req);
    let ov = req.body?.overrides;
    if (typeof ov === 'string') {
      try { ov = JSON.parse(ov); } catch { ov = {}; }
    }
    rows = applyMeta(rows, ov);
    const replace = req.body?.replace !== '0' && req.body?.replace !== false;
    const saveToDisk = req.body?.saveToDisk !== '0' && req.body?.saveToDisk !== false;
    const summary = ingestRows(rows, replace, saveToDisk);
    db.prepare('INSERT INTO audit_log (admin_id, action, entity, payload) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'import', 'exam', JSON.stringify(summary));
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Bulk preview endpoint: Inspects up to 100 files without committing
router.post('/bulk-preview', upload.array('files', 100), (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });
    const fileSummaries = [];
    let totalQuestions = 0;
    for (const f of files) {
      try {
        const { rows, kind } = parseUploadBuffer(f.buffer, f.originalname || '');
        const papers = papersFromRows(rows);
        totalQuestions += rows.length;
        fileSummaries.push({
          name: f.originalname,
          size: f.size,
          kind,
          count: rows.length,
          papers,
          valid: true
        });
      } catch (err) {
        fileSummaries.push({
          name: f.originalname,
          size: f.size,
          valid: false,
          error: err.message
        });
      }
    }
    res.json({
      ok: true,
      totalFiles: files.length,
      totalQuestions,
      files: fileSummaries
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Bulk commit endpoint: Ingests all uploaded files into database AND persists to disk in test/ folder
router.post('/bulk-commit', upload.array('files', 100), (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files uploaded' });
    const allSummary = [];
    const errors = [];
    const replace = req.body?.replace !== '0' && req.body?.replace !== false;
    const saveToDisk = req.body?.saveToDisk !== '0' && req.body?.saveToDisk !== false;

    for (const f of files) {
      try {
        const { rows } = parseUploadBuffer(f.buffer, f.originalname || '');
        const sum = ingestRows(rows, replace, saveToDisk);
        allSummary.push(...sum);
      } catch (err) {
        errors.push({ file: f.originalname, error: err.message });
      }
    }

    db.prepare('INSERT INTO audit_log (admin_id, action, entity, payload) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'bulk_import', 'exam', JSON.stringify({ imported: allSummary.length, errors }));

    res.json({
      ok: true,
      summary: allSummary,
      errors,
      totalFiles: files.length,
      totalPapers: allSummary.length,
      totalQuestions: allSummary.reduce((s, r) => s + r.added, 0)
    });
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
    const replace = body.replace !== false;
    const saveToDisk = body.saveToDisk !== false;
    const summary = ingestRows(rows, replace, saveToDisk);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/sync-folder', (req, res) => {
  try {
    const { importTestFolder } = require('../lib/importPack');
    const results = importTestFolder(db);
    res.json({
      ok: true,
      imported: results.length,
      total_questions: results.reduce((s, r) => s + r.count, 0),
      papers: results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

