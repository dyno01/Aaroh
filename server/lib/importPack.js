const fs = require('fs');
const path = require('path');
let defaultDb = null;
function getDb(override) {
  if (override) return override;
  if (!defaultDb) defaultDb = require('../db');
  return defaultDb;
}
const { packHints, buildHints } = require('./hints');
const { upsertStyle, prettySlug, slugFamily, slugType } = require('./styles');

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] || '').trim();
    });
    return obj;
  });
  return { headers, rows };
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

function upsertExam(meta, db) {
  const code = meta.code || meta.exam_code;
  if (!code) throw new Error('Each exam needs a code');
  const existing = db.prepare('SELECT id FROM exams WHERE code = ?').get(code);
  const fields = {
    code,
    title: meta.title || meta.exam_title || code,
    description: meta.description || '',
    exam_family: meta.exam_family || 'IBPS_SO_IT',
    stage: meta.stage || 'mains',
    type: meta.type || meta.exam_type || 'subject',
    subject: meta.subject || null,
    duration_sec: Number(meta.duration_sec || (Number(meta.duration_min || 10) * 60)),
    marks_per_q: Number(meta.marks_per_q ?? 2),
    negative_per_q: Number(meta.negative_per_q ?? meta.negative ?? 0.50),
    difficulty: meta.difficulty || 'moderate',
    max_hints: Number(meta.max_hints ?? 3),
    hints_enabled: meta.hints_enabled === '0' ? 0 : 1,
    calculator: meta.calculator === '1' || meta.calculator === true ? 1 : 0,
    instructions: meta.instructions || '',
    is_published: 1,
    coming_soon: 0
  };

  if (existing) {
    db.prepare(`
      UPDATE exams SET title=?, description=?, exam_family=?, stage=?, type=?, subject=?, duration_sec=?,
        marks_per_q=?, negative_per_q=?, difficulty=?, max_hints=?, hints_enabled=?, calculator=?, instructions=?,
        is_published=1, updated_at=datetime('now') WHERE id=?
    `).run(fields.title, fields.description, fields.exam_family, fields.stage, fields.type, fields.subject,
      fields.duration_sec, fields.marks_per_q, fields.negative_per_q, fields.difficulty, fields.max_hints,
      fields.hints_enabled, fields.calculator, fields.instructions, existing.id);
    return existing.id;
  }

  const info = db.prepare(`
    INSERT INTO exams (code, title, description, exam_family, stage, type, subject, duration_sec, marks_per_q,
      negative_per_q, difficulty, max_hints, hints_enabled, calculator, instructions, is_published, coming_soon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(fields.code, fields.title, fields.description, fields.exam_family, fields.stage, fields.type, fields.subject,
    fields.duration_sec, fields.marks_per_q, fields.negative_per_q, fields.difficulty, fields.max_hints,
    fields.hints_enabled, fields.calculator, fields.instructions);
  return info.lastInsertRowid;
}

function insertQuestion(examId, row, index, examMeta, db) {
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
  const hintsList = [row.hint || row.hint_1, row.hint_2, row.hint_3].filter(Boolean);
  const hintsJson = packHints(hintsList.length ? hintsList : buildHints({
    hint: row.hint, explanation: row.explanation, topic: row.topic
  }));

  db.prepare(`
    INSERT INTO questions (exam_id, section, subject, topic, difficulty, q_en, q_hi, options_json, correct, explanation, hint, hints_json, marks, negative, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    examId,
    row.section || examMeta.subject || 'Professional Knowledge',
    row.subject || examMeta.subject || '',
    row.topic || '',
    row.difficulty || 'moderate',
    q,
    row.q_hi || '',
    JSON.stringify(options),
    correct,
    row.explanation || '',
    row.hint || row.hint_1 || '',
    hintsJson,
    Number(row.marks ?? examMeta.marks_per_q ?? 2),
    Number(row.negative ?? examMeta.negative_per_q ?? 0.50),
    index
  );
  return true;
}

function ingestCsvFile(filePath, dbOverride) {
  const db = getDb(dbOverride);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const { rows } = parseCsv(content);
  if (!rows.length) return null;

  const first = rows[0];
  const code = first.exam_code || first.code;
  const title = first.exam_title || first.title || code;
  const fam = slugFamily(first.family_label || first.exam_family || 'IBPS_SO_IT');
  const typ = slugType(first.type_label || first.exam_type || first.type || 'subject');

  upsertStyle(db, 'family', fam, first.family_label || prettySlug(fam), { live: true });
  upsertStyle(db, 'type', typ, first.type_label || prettySlug(typ), { live: true });

  const meta = {
    ...first,
    code,
    title,
    exam_family: fam,
    type: typ
  };

  const examId = upsertExam(meta, db);

  // Clear existing questions for clean overwrite
  db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);

  let count = 0;
  const tx = db.transaction(() => {
    rows.forEach((r, i) => {
      if (insertQuestion(examId, r, i, meta, db)) count++;
    });
  });
  tx();

  return { code, title, count };
}

function findCsvFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      findCsvFiles(full, fileList);
    } else if (item.endsWith('.csv')) {
      fileList.push(full);
    }
  }
  return fileList;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDirRecursive(s, d);
    } else if (!fs.existsSync(d)) {
      fs.copyFileSync(s, d);
    }
  }
}

function importTestFolder(dbOverride) {
  const db = getDb(dbOverride);
  const defaultRepoDir = path.join(__dirname, '../../test');
  const testDir = process.env.TEST_DIR || defaultRepoDir;

  // If using a custom persistent disk (e.g. /data/test), seed repo files into it once
  if (testDir !== defaultRepoDir && fs.existsSync(defaultRepoDir)) {
    try {
      copyDirRecursive(defaultRepoDir, testDir);
    } catch (err) {
      console.warn('Could not seed default tests to custom TEST_DIR:', err.message);
    }
  }

  const files = findCsvFiles(testDir);
  console.log(`Found ${files.length} test CSV files in ${testDir}`);
  const results = [];
  for (const f of files) {
    try {
      const res = ingestCsvFile(f, db);
      if (res) results.push(res);
    } catch (e) {
      console.error(`Failed to import ${f}:`, e.message);
    }
  }
  console.log(`Successfully imported ${results.length} exam papers with total questions:`,
    results.reduce((s, r) => s + r.count, 0));
  return results;
}


module.exports = { importTestFolder, ingestCsvFile, findCsvFiles };
