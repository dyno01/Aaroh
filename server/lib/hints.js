function parseHints(q) {
  if (!q) return [];
  if (q.hints_json) {
    try {
      const a = JSON.parse(q.hints_json);
      if (Array.isArray(a)) {
        return a.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3);
      }
    } catch { /* ignore */ }
  }
  const extras = [q.hint, q.hint_2, q.hint_3, q.hint2, q.hint3]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return extras.slice(0, 3);
}

function buildHints(q) {
  const topic = String(q.topic || 'this concept').trim() || 'this concept';
  const have = parseHints(q);
  const h1 = have[0] || `Start from the core definition of ${topic} — ignore rare special cases.`;
  const h2 = have[1] || `Cross out options that mix ${topic} with a neighbouring idea (similar name, different rule).`;
  let h3 = have[2] || `The option that survives should match the standard textbook rule for ${topic} exactly.`;
  if (!have[2] && q.explanation) {
    const cut = String(q.explanation)
      .replace(/\b(option\s*)?[ABCD]\b/g, '')
      .replace(/\bthe answer is\b/ig, '')
      .split(/(?<=\.)\s+/)[0]
      .trim();
    if (cut.length > 28 && cut.length < 220) h3 = cut.endsWith('.') ? cut : `${cut}.`;
  }
  return [h1, h2, h3];
}

function maxHintLevels(exam, hints) {
  const n = Array.isArray(hints) ? hints.length : 0;
  if (!n) return 0;
  if (exam && (exam.hints_enabled === 0 || exam.hints_enabled === false)) return 0;
  let cap = Number(exam?.max_hints);
  if (!Number.isFinite(cap) || cap <= 0) cap = 3;
  if (cap > 3) cap = 3;
  return Math.min(3, n, cap);
}

function packHints(list) {
  const clean = (list || []).map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3);
  return JSON.stringify(clean);
}

function easyWhy(q, chosen) {
  let options = [];
  try { options = JSON.parse(q.options_json || '[]'); } catch { options = []; }
  const correctOpt = options.find((o) => o.id === q.correct) || {};
  const chosenOpt = options.find((o) => o.id === chosen) || {};
  const why = String(q.explanation || '').trim()
    || `The correct choice is ${(q.correct || '').toUpperCase()} — ${correctOpt.en || 'the standard answer'} — because that is the textbook rule for ${q.topic || 'this topic'}.`;
  return {
    correct_label: String(q.correct || '').toUpperCase(),
    correct_text: correctOpt.en || '',
    chosen_label: chosen ? String(chosen).toUpperCase() : null,
    chosen_text: chosenOpt.en || null,
    why
  };
}

function teach(q, chosen) {
  const base = easyWhy(q, chosen);
  let options = [];
  try { options = JSON.parse(q.options_json || '[]'); } catch { options = []; }
  const topic = String(q.topic || q.subject || 'this topic');
  const raw = String(q.explanation || base.why || '').trim();
  const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const rule = (sentences[0] && sentences[0].length < 240)
    ? sentences[0]
    : `Hold the textbook rule for ${topic} before you look at the options.`;
  const body = sentences.length > 2 ? sentences.slice(1, -1).join(' ') : '';
  const remember = sentences.length > 1
    ? sentences[sentences.length - 1]
    : `Lock this: ${base.correct_label} — ${base.correct_text}.`;
  const others = options.filter((o) => o.id !== q.correct).map((o) => {
    const picked = chosen && o.id === chosen;
    return {
      id: o.id,
      label: String(o.id).toUpperCase(),
      text: o.en || '',
      note: picked
        ? `You picked this. Close, but it is not the ${topic} rule the stem is testing.`
        : `A nearby idea — not the ${topic} rule above.`
    };
  });
  return { ...base, topic, rule, body, remember, others };
}

module.exports = { parseHints, buildHints, maxHintLevels, packHints, easyWhy, teach };
