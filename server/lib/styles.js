function prettySlug(slug) {
  const known = {
    subject: 'Subject-wise',
    full: 'Full mock',
    high_influence: 'High influence',
    IBPS_SO_IT: 'IBPS SO IT',
    SEBI_GRADE_A: 'SEBI Grade A',
    NABARD_GRADE_A: 'NABARD Grade A',
    prelims: 'Prelims',
    mains: 'Mains'
  };
  if (known[slug]) return known[slug];
  return String(slug || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || slug;
}

function slugFamily(s) {
  return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'CUSTOM';
}

function slugType(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'custom';
}

function ensureStyles(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_styles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      slug TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      coming_soon INTEGER DEFAULT 0,
      UNIQUE(kind, slug)
    );
  `);
  const n = db.prepare('SELECT COUNT(*) AS c FROM paper_styles').get().c;
  if (n === 0) {
    const ins = db.prepare('INSERT INTO paper_styles (kind, slug, label, sort_order, coming_soon) VALUES (?, ?, ?, ?, ?)');
    [
      ['family', 'IBPS_SO_IT', 'IBPS SO IT', 1, 0],
      ['family', 'SEBI_GRADE_A', 'SEBI Grade A', 2, 1],
      ['family', 'NABARD_GRADE_A', 'NABARD Grade A', 3, 1],
      ['type', 'subject', 'Subject-wise', 1, 0],
      ['type', 'full', 'Full mock', 2, 0],
      ['type', 'high_influence', 'High influence', 3, 0]
    ].forEach((r) => ins.run(...r));
  }
}

function upsertStyle(db, kind, slug, label, opts = {}) {
  if (!slug) return null;
  const existing = db.prepare('SELECT id FROM paper_styles WHERE kind = ? AND slug = ?').get(kind, slug);
  const name = (label && String(label).trim()) || prettySlug(slug);
  if (existing) {
    if (label) db.prepare('UPDATE paper_styles SET label = ? WHERE id = ?').run(name, existing.id);
    if (opts.live) db.prepare('UPDATE paper_styles SET coming_soon = 0 WHERE id = ?').run(existing.id);
    return existing.id;
  }
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM paper_styles WHERE kind = ?').get(kind).n;
  const info = db.prepare(
    'INSERT INTO paper_styles (kind, slug, label, sort_order, coming_soon) VALUES (?, ?, ?, ?, ?)'
  ).run(kind, slug, name, max + 1, opts.coming_soon ? 1 : 0);
  return info.lastInsertRowid;
}

function syncFromExams(db) {
  ensureStyles(db);
  db.prepare('SELECT DISTINCT exam_family AS s FROM exams WHERE exam_family IS NOT NULL').all()
    .forEach((r) => upsertStyle(db, 'family', r.s, prettySlug(r.s), { live: true }));
  db.prepare('SELECT DISTINCT type AS s FROM exams WHERE type IS NOT NULL').all()
    .forEach((r) => upsertStyle(db, 'type', r.s, prettySlug(r.s), { live: true }));

  // Prune any type styles that have 0 exams and are not coming soon
  const activeTypes = db.prepare('SELECT DISTINCT type FROM exams').all().map((r) => r.type);
  if (activeTypes.length > 0) {
    const ph = activeTypes.map(() => '?').join(',');
    db.prepare(`DELETE FROM paper_styles WHERE kind = 'type' AND coming_soon = 0 AND slug NOT IN (${ph})`).run(...activeTypes);
  }
}

function listStyles(db, kind) {
  return db.prepare(
    'SELECT id, slug, label, coming_soon, sort_order FROM paper_styles WHERE kind = ? ORDER BY sort_order ASC, id ASC'
  ).all(kind);
}

function catalog(db) {
  syncFromExams(db);
  const typeCounts = Object.fromEntries(
    db.prepare("SELECT type, COUNT(*) AS c FROM exams WHERE is_published = 1 AND coming_soon = 0 GROUP BY type").all().map((r) => [r.type, r.c])
  );
  const familyCounts = Object.fromEntries(
    db.prepare("SELECT exam_family, COUNT(*) AS c FROM exams WHERE is_published = 1 AND coming_soon = 0 GROUP BY exam_family").all().map((r) => [r.exam_family, r.c])
  );
  const totalExams = db.prepare("SELECT COUNT(*) AS c FROM exams WHERE is_published = 1 AND coming_soon = 0").get().c;

  return {
    total: totalExams,
    families: listStyles(db, 'family').map((r) => ({
      id: r.slug,
      label: r.label,
      coming_soon: !!r.coming_soon,
      count: familyCounts[r.slug] || 0
    })),
    types: listStyles(db, 'type').map((r) => ({
      id: r.slug,
      label: r.label,
      coming_soon: !!r.coming_soon,
      count: typeCounts[r.slug] || 0
    }))
  };
}

module.exports = { prettySlug, slugFamily, slugType, ensureStyles, upsertStyle, syncFromExams, listStyles, catalog };
