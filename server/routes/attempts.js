const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { parseHints, buildHints, maxHintLevels, easyWhy, teach } = require('../lib/hints');

const router = express.Router();

function examSettings(exam) {
  return {
    max_hints: exam.max_hints,
    hints_enabled: !!exam.hints_enabled,
    calculator: !!exam.calculator,
    mark_for_review: !!exam.mark_for_review,
    skip_allowed: !!exam.skip_allowed,
    show_palette: !!exam.show_palette,
    bilingual: !!exam.bilingual,
    extra_time_sec: exam.extra_time_sec || 0,
    allow_pause: !!exam.allow_pause,
    show_timer: !!exam.show_timer,
    allow_section_switch: !!exam.allow_section_switch,
    show_explanations_after: !!exam.show_explanations_after,
    shuffle_questions: !!exam.shuffle_questions,
    shuffle_options: !!exam.shuffle_options
  };
}

function stripCorrect(q, shuffleOptions, exam, answers) {
  let options = JSON.parse(q.options_json);
  if (shuffleOptions) {
    options = [...options].sort(() => Math.random() - 0.5);
  }
  const allHints = parseHints(q).length ? parseHints(q) : buildHints(q);
  const max = maxHintLevels(exam, allHints);
  const unlocked = Math.min(max, Number(answers?.[q.id]?.hintLevel || 0));
  return {
    id: q.id,
    section: q.section,
    subject: q.subject,
    topic: q.topic,
    difficulty: q.difficulty,
    q_en: q.q_en,
    q_hi: q.q_hi,
    options,
    marks: q.marks,
    negative: q.negative,
    order_index: q.order_index,
    hint_count: max,
    unlocked_hints: allHints.slice(0, unlocked)
  };
}

function scoreAttempt(attempt, exam, questions) {
  const answers = JSON.parse(attempt.answers_json || '{}');
  let score = 0;
  let max = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const review = questions.map((q) => {
    const a = answers[q.id] || {};
    const marks = q.marks ?? exam.marks_per_q ?? 1;
    const neg = q.negative ?? exam.negative_per_q ?? 0.25;
    max += marks;
    let verdict = 'skipped';
    let delta = 0;
    if (!a.option) {
      skipped += 1;
    } else if (a.option === q.correct) {
      verdict = 'correct';
      delta = marks;
      correct += 1;
    } else {
      verdict = 'wrong';
      delta = -neg;
      wrong += 1;
    }
    score += delta;
    const why = teach(q, a.option || null);
    return {
      id: q.id,
      section: q.section,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      q_en: q.q_en,
      options: JSON.parse(q.options_json),
      correct: q.correct,
      chosen: a.option || null,
      verdict,
      delta,
      marks,
      explanation: why.why,
      rule: why.rule,
      body: why.body,
      remember: why.remember,
      others: why.others,
      correct_label: why.correct_label,
      correct_text: why.correct_text,
      chosen_label: why.chosen_label,
      chosen_text: why.chosen_text,
      hints: parseHints(q).length ? parseHints(q) : buildHints(q),
      hintLevel: a.hintLevel || (a.hintUsed ? 1 : 0),
      hintUsed: !!a.hintUsed || !!a.hintLevel,
      timeSpent: a.timeSpent || 0
    };
  });
  const accuracy = correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0;
  return { score: +score.toFixed(2), max: +max.toFixed(2), correct, wrong, skipped, accuracy: +accuracy.toFixed(1), review };
}

router.post('/start', auth(), (req, res) => {
  const { examId, resumeId } = req.body || {};
  if (resumeId) {
    const existing = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?').get(resumeId, req.user.id);
    if (!existing || existing.status !== 'in_progress') return res.status(404).json({ error: 'No attempt to resume' });
    return payloadForAttempt(existing, res);
  }
  const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND is_published = 1').get(examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  if (exam.max_attempts > 0) {
    const n = db.prepare("SELECT COUNT(*) AS c FROM attempts WHERE user_id = ? AND exam_id = ? AND status = 'submitted'").get(req.user.id, exam.id).c;
    if (n >= exam.max_attempts) return res.status(403).json({ error: 'Attempt limit reached for this paper' });
  }
  const open = db.prepare("SELECT * FROM attempts WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'").get(req.user.id, exam.id);
  if (open && !req.body?.forceNew) return payloadForAttempt(open, res);
  if (open && req.body?.forceNew) {
    db.prepare("UPDATE attempts SET status = 'abandoned' WHERE id = ?").run(open.id);
  }

  const settings = examSettings(exam);
  const first = db.prepare('SELECT id, section FROM questions WHERE exam_id = ? ORDER BY order_index, id LIMIT 1').get(exam.id);
  const info = db.prepare(`
    INSERT INTO attempts (user_id, exam_id, status, duration_sec, extra_time_sec, current_qid, current_section, settings_json, answers_json)
    VALUES (?, ?, 'in_progress', ?, ?, ?, ?, ?, '{}')
  `).run(req.user.id, exam.id, exam.duration_sec, exam.extra_time_sec || 0, first?.id || null, first?.section || null, JSON.stringify(settings));
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(info.lastInsertRowid);
  return payloadForAttempt(attempt, res);
});

function payloadForAttempt(attempt, res, extra = {}) {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
  let questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id').all(exam.id);
  const live = examSettings(exam);
  live.extra_time_sec = (exam.extra_time_sec || 0) + (attempt.extra_time_sec || 0);
  if (live.shuffle_questions) {
    const grouped = {};
    questions.forEach((q) => {
      (grouped[q.section || 'Paper'] ||= []).push(q);
    });
    questions = Object.values(grouped).flatMap((arr) => arr.sort(() => Math.random() - 0.5));
  }
  const sections = db.prepare('SELECT name, duration_sec, order_index FROM sections WHERE exam_id = ? ORDER BY order_index').all(exam.id);
  const started = new Date(attempt.started_at.replace(' ', 'T') + 'Z').getTime();
  const elapsed = Math.floor((Date.now() - started) / 1000);
  const remaining = Math.max(0, (attempt.duration_sec || exam.duration_sec) + live.extra_time_sec - elapsed);
  res.json({
    attempt: {
      id: attempt.id,
      exam_id: exam.id,
      status: attempt.status,
      started_at: attempt.started_at,
      answers: JSON.parse(attempt.answers_json || '{}'),
      current_qid: attempt.current_qid,
      current_section: attempt.current_section,
      hints_used: attempt.hints_used || 0,
      total_lifelines: Number.isFinite(Number(exam.max_hints)) ? Number(exam.max_hints) : 3,
      remaining_lifelines: Math.max(0, (Number.isFinite(Number(exam.max_hints)) ? Number(exam.max_hints) : 3) - (attempt.hints_used || 0)),
      remaining,
      paused: !!attempt.paused
    },
    exam: {
      id: exam.id,
      code: exam.code,
      title: exam.title,
      type: exam.type,
      subject: exam.subject,
      exam_family: exam.exam_family,
      duration_sec: exam.duration_sec,
      marks_per_q: exam.marks_per_q,
      negative_per_q: exam.negative_per_q
    },
    settings: live,
    sections,
    questions: questions.map((q) => stripCorrect(q, live.shuffle_options, exam, JSON.parse(attempt.answers_json || '{}'))),
    ...extra
  });
}

router.post('/:id/save', auth(), (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!attempt || attempt.status !== 'in_progress') return res.status(404).json({ error: 'Attempt not active' });
  const { answers, current_qid, current_section, hints_used } = req.body || {};
  db.prepare(`
    UPDATE attempts SET answers_json = ?, current_qid = ?, current_section = ?, hints_used = COALESCE(?, hints_used)
    WHERE id = ?
  `).run(JSON.stringify(answers || {}), current_qid || attempt.current_qid, current_section || attempt.current_section, hints_used ?? null, attempt.id);
  res.json({ ok: true });
});

router.post('/:id/hint', auth(), (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!attempt || attempt.status !== 'in_progress') return res.status(404).json({ error: 'Attempt not active' });
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
  const { questionId, peek } = req.body || {};
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND exam_id = ?').get(questionId, exam.id);
  if (!q) return res.status(404).json({ error: 'Question not found' });
  if (!exam.hints_enabled) return res.status(403).json({ error: 'Hints are turned off for this paper' });

  const allHints = parseHints(q).length ? parseHints(q) : buildHints(q);
  const answers = JSON.parse(attempt.answers_json || '{}');
  const alreadyUnlocked = Number(answers[questionId]?.hintLevel || 0) > 0;
  const totalLifelines = Number.isFinite(Number(exam.max_hints)) ? Number(exam.max_hints) : 3;
  const currentHintsUsed = attempt.hints_used || 0;
  const remainingLifelines = Math.max(0, totalLifelines - currentHintsUsed);

  if (peek) {
    const unlockedHints = alreadyUnlocked ? allHints.slice(0, 1) : [];
    return res.json({
      hints: unlockedHints,
      unlocked: unlockedHints.length,
      max: 1,
      hints_used: currentHintsUsed,
      total_lifelines: totalLifelines,
      remaining_lifelines: remainingLifelines
    });
  }

  // If already unlocked on this question, return without spending a lifeline
  if (alreadyUnlocked) {
    return res.json({
      hints: allHints.slice(0, 1),
      unlocked: 1,
      max: 1,
      hint: allHints[0],
      hints_used: currentHintsUsed,
      total_lifelines: totalLifelines,
      remaining_lifelines: remainingLifelines,
      already: true
    });
  }

  // If student is trying to unlock on a new question but lifelines are exhausted:
  if (remainingLifelines <= 0) {
    return res.status(403).json({
      error: `You have used all ${totalLifelines} hint lifelines for this test. No lifelines remaining!`
    });
  }

  const nextUsed = currentHintsUsed + 1;
  answers[questionId] = { ...(answers[questionId] || {}), hintLevel: 1, hintUsed: true };
  db.prepare('UPDATE attempts SET hints_used = hints_used + 1, answers_json = ? WHERE id = ?').run(JSON.stringify(answers), attempt.id);

  res.json({
    hints: allHints.slice(0, 1),
    unlocked: 1,
    max: 1,
    hint: allHints[0],
    hints_used: nextUsed,
    total_lifelines: totalLifelines,
    remaining_lifelines: Math.max(0, totalLifelines - nextUsed)
  });
});

router.post('/:id/submit', auth(), (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status === 'submitted') {
    return res.json({ attemptId: attempt.id, already: true });
  }
  if (req.body?.answers) {
    db.prepare('UPDATE attempts SET answers_json = ?, current_qid = COALESCE(?, current_qid) WHERE id = ?')
      .run(JSON.stringify(req.body.answers), req.body.current_qid || null, attempt.id);
  }
  const fresh = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attempt.id);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(fresh.exam_id);
  const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id').all(exam.id);
  const result = scoreAttempt(fresh, exam, questions);
  db.prepare(`
    UPDATE attempts SET status = 'submitted', submitted_at = datetime('now'),
      score = ?, max_score = ?, correct_count = ?, wrong_count = ?, skipped_count = ?, accuracy = ?
    WHERE id = ?
  `).run(result.score, result.max, result.correct, result.wrong, result.skipped, result.accuracy, fresh.id);
  db.prepare("UPDATE users SET last_active = datetime('now'), streak = streak + 1 WHERE id = ?").run(req.user.id);
  res.json({ attemptId: fresh.id, result: { score: result.score, max: result.max, correct: result.correct, wrong: result.wrong, skipped: result.skipped, accuracy: result.accuracy } });
});

router.get('/:id/result', auth(), (req, res) => {
  const attempt = req.user.role === 'admin'
    ? db.prepare(`
        SELECT a.*, u.name AS user_name, u.email AS user_email
        FROM attempts a JOIN users u ON u.id = a.user_id
        WHERE a.id = ?
      `).get(req.params.id)
    : db.prepare(`
        SELECT a.*, u.name AS user_name, u.email AS user_email
        FROM attempts a JOIN users u ON u.id = a.user_id
        WHERE a.id = ? AND a.user_id = ?
      `).get(req.params.id, req.user.id);

  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status !== 'submitted' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Submit the paper to see results' });
  }
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(attempt.exam_id);
  const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index, id').all(exam.id);
  const result = scoreAttempt(attempt, exam, questions);
  const better = db.prepare("SELECT COUNT(*) AS c FROM attempts WHERE exam_id = ? AND status = 'submitted' AND score > ?").get(exam.id, result.score).c;
  const total = db.prepare("SELECT COUNT(*) AS c FROM attempts WHERE exam_id = ? AND status = 'submitted'").get(exam.id).c;
  const rank = better + 1;
  const percentile = total > 1 ? +(((total - rank) / (total - 1)) * 100).toFixed(1) : 100;
  const bySubject = {};
  result.review.forEach((r) => {
    const key = r.subject || r.section || 'Paper';
    bySubject[key] ||= { subject: key, correct: 0, wrong: 0, skipped: 0, score: 0, max: 0, time: 0 };
    bySubject[key][r.verdict] += 1;
    bySubject[key].score += r.delta;
    const q = questions.find((x) => x.id === r.id);
    bySubject[key].max += q?.marks ?? exam.marks_per_q ?? 1;
    bySubject[key].time += r.timeSpent || 0;
  });
  res.json({
    attempt: {
      id: attempt.id,
      user_id: attempt.user_id,
      user_name: attempt.user_name,
      user_email: attempt.user_email,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
      hints_used: attempt.hints_used
    },
    exam: { id: exam.id, title: exam.title, type: exam.type, subject: exam.subject, exam_family: exam.exam_family, code: exam.code },
    result: { ...result, rank, percentile, totalAttempts: total },
    bySubject: Object.values(bySubject)
  });
});

router.get('/', auth(), (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.exam_id, a.status, a.score, a.max_score, a.accuracy, a.started_at, a.submitted_at, a.correct_count, a.wrong_count,
           e.title, e.type, e.subject, e.exam_family, e.code
    FROM attempts a JOIN exams e ON e.id = a.exam_id
    WHERE a.user_id = ?
    ORDER BY a.started_at DESC
    LIMIT 40
  `).all(req.user.id);
  res.json({ attempts: rows });
});

router.get('/insights', auth(), (req, res) => {
  const attempts = db.prepare(`
    SELECT a.*, e.title, e.type, e.subject AS exam_subject, e.code
    FROM attempts a JOIN exams e ON e.id = a.exam_id
    WHERE a.user_id = ? AND a.status = 'submitted'
    ORDER BY a.submitted_at DESC
    LIMIT 50
  `).all(req.user.id);

  const bySubject = {};
  const byTopic = {};
  function bucket(map, key) {
    map[key] ||= { key, correct: 0, wrong: 0, skipped: 0 };
    return map[key];
  }

  for (const a of attempts) {
    const questions = db.prepare('SELECT id, subject, section, topic, correct FROM questions WHERE exam_id = ?').all(a.exam_id);
    let answers = {};
    try { answers = JSON.parse(a.answers_json || '{}'); } catch { answers = {}; }
    for (const q of questions) {
      const chosen = answers[q.id]?.option;
      const sub = q.subject || q.section || a.exam_subject || 'Paper';
      const topic = q.topic || sub;
      const s = bucket(bySubject, sub);
      const t = bucket(byTopic, topic);
      if (!chosen) { s.skipped += 1; t.skipped += 1; }
      else if (chosen === q.correct) { s.correct += 1; t.correct += 1; }
      else { s.wrong += 1; t.wrong += 1; }
    }
  }

  function enrich(map) {
    return Object.values(map).map((x) => {
      const attempted = x.correct + x.wrong;
      const acc = attempted ? (x.correct / attempted) * 100 : 0;
      return { ...x, attempted, total: attempted + x.skipped, accuracy: +acc.toFixed(1) };
    }).filter((x) => x.total > 0);
  }

  const subjects = enrich(bySubject).sort((a, b) => b.accuracy - a.accuracy);
  const topics = enrich(byTopic).sort((a, b) => a.accuracy - b.accuracy);
  const enough = subjects.filter((s) => s.attempted >= 2);
  const pool = enough.length ? enough : subjects;
  const strengths = [...pool].sort((a, b) => b.accuracy - a.accuracy).filter((s) => s.accuracy >= 65).slice(0, 4);
  const weaknesses = [...pool].sort((a, b) => a.accuracy - b.accuracy).filter((s) => s.accuracy < 75).slice(0, 4);

  const practiceFor = (name) => {
    const row = db.prepare(`
      SELECT id, title, type FROM exams
      WHERE is_published = 1 AND coming_soon = 0 AND subject = ?
      ORDER BY type LIMIT 1
    `).get(name);
    return row || null;
  };

  const weakOut = weaknesses.map((w) => ({ ...w, practice: practiceFor(w.key) }));
  const strongOut = strengths.map((s) => ({ ...s, practice: practiceFor(s.key) }));

  const trend = attempts.slice(0, 12).reverse().map((a) => ({
    id: a.id,
    title: a.title,
    accuracy: a.accuracy || 0,
    score: a.score,
    at: a.submitted_at
  }));

  const avg = attempts.length
    ? attempts.reduce((s, a) => s + (a.accuracy || 0), 0) / attempts.length
    : 0;

  res.json({
    papers: attempts.length,
    avg_accuracy: +avg.toFixed(1),
    last_score: attempts[0]?.score ?? null,
    strengths: strongOut,
    weaknesses: weakOut,
    subjects,
    topics: topics.slice(0, 12),
    trend
  });
});

module.exports = router;
