const fs = require('fs');
const path = require('path');
const { slugType } = require('./styles');

const CSV_HEADERS = [
  'exam_code', 'exam_title', 'exam_type', 'exam_family', 'stage', 'subject', 'section',
  'duration_min', 'marks_per_q', 'negative', 'max_hints', 'question',
  'option_a', 'option_b', 'option_c', 'option_d', 'option_e',
  'correct', 'explanation', 'hint', 'hint_2', 'hint_3',
  'topic', 'difficulty', 'family_label', 'type_label', 'marks'
];

function getTestDir() {
  const dir = process.env.TEST_DIR || path.join(__dirname, '../../test');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSubFolderForType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('debug')) return 'debugging';
  if (t.includes('full') || t.includes('mock')) return 'full';
  if (t.includes('influence') || t.includes('high')) return 'high_influence';
  if (t.includes('subject') || t.includes('drill')) return 'subject';
  return slugType(type) || 'subject';
}

function escapeCsvCell(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function examToCsvString(exam, questions) {
  const rows = (questions || []).map((q) => {
    let opts = [];
    if (typeof q.options_json === 'string') {
      try { opts = JSON.parse(q.options_json); } catch { opts = []; }
    } else if (Array.isArray(q.options_json)) {
      opts = q.options_json;
    }

    const optMap = {};
    opts.forEach((o, i) => {
      const id = o.id || 'abcde'[i];
      optMap[`option_${id}`] = o.en || o.text || o;
    });

    let hints = [];
    if (q.hints_json) {
      try {
        const parsed = JSON.parse(q.hints_json);
        if (Array.isArray(parsed)) hints = parsed.map((h) => (typeof h === 'string' ? h : h.body || h.hint || ''));
      } catch { hints = []; }
    }
    const h1 = hints[0] || q.hint || '';
    const h2 = hints[1] || '';
    const h3 = hints[2] || '';

    const cells = [
      exam.code,
      exam.title,
      exam.type || 'subject',
      exam.exam_family || 'IBPS_SO_IT',
      exam.stage || 'prelims',
      q.subject || exam.subject || '',
      q.section || exam.subject || 'Paper',
      Math.round((exam.duration_sec || 600) / 60),
      exam.marks_per_q ?? q.marks ?? 1,
      exam.negative_per_q ?? q.negative ?? 0.25,
      exam.max_hints ?? 3,
      q.q_en || q.question || '',
      optMap.option_a || '',
      optMap.option_b || '',
      optMap.option_c || '',
      optMap.option_d || '',
      optMap.option_e || '',
      q.correct || 'a',
      q.explanation || '',
      h1,
      h2,
      h3,
      q.topic || '',
      q.difficulty || 'moderate',
      (exam.exam_family || '').replace(/_/g, ' '),
      (exam.type || '').replace(/_/g, ' '),
      q.marks ?? exam.marks_per_q ?? 1
    ];

    return cells.map(escapeCsvCell).join(',');
  });

  return '\uFEFF' + CSV_HEADERS.join(',') + '\n' + rows.join('\n') + '\n';
}

function saveExamToDisk(examId, db) {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) return null;
    const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id').all(examId);

    const testDir = getTestDir();
    const sub = getSubFolderForType(exam.type);
    const targetFolder = path.join(testDir, sub);
    if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

    const safeCode = (exam.code || 'PAPER').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(targetFolder, `${safeCode}.csv`);
    const csvContent = examToCsvString(exam, questions);

    fs.writeFileSync(filePath, csvContent, 'utf8');
    const rel = path.relative(path.join(__dirname, '../..'), filePath);
    console.log(`[PaperSync] Saved exam ${exam.code} to ${rel}`);

    // Asynchronously sync to Backblaze B2
    try {
      const b2 = require('./b2');
      b2.uploadPaperCsv(sub, `${safeCode}.csv`, csvContent).catch((err) => {
        console.warn(`[Backblaze B2] PaperSync upload warning for ${safeCode}:`, err.message);
      });
    } catch { /* ignore */ }

    return { filePath, rel, count: questions.length };
  } catch (err) {
    console.error(`[PaperSync] Failed to save exam ${examId} to disk:`, err);
    return null;
  }
}


function syncAllExamsToDisk(db) {
  const exams = db.prepare('SELECT id FROM exams').all();
  let count = 0;
  for (const e of exams) {
    const res = saveExamToDisk(e.id, db);
    if (res) count++;
  }
  return count;
}

module.exports = {
  getTestDir,
  CSV_HEADERS,
  examToCsvString,
  saveExamToDisk,
  syncAllExamsToDisk
};
