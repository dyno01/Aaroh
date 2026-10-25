# Aaroh

Mock-test hall for **IBPS SO IT**. SEBI Grade A and NABARD Grade A unlock the moment you import a bank with that `exam_family`.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin / coach | `admin@aaroh.in` | `Aaroh@123` |
| Student (Nikita Rathod) | `demo@aaroh.in` | `Aaroh@123` |

Add papers from Coach desk → **Import** (CSV or JSON). There is no built-in demo paper.

## Run

```bash
cd server && npm install && node index.js
cd client && npm install && npm run build
```

If `server/aaroh.db` already exists, **do not** run `seed.js` again — it would duplicate papers.

- App + API: `http://localhost:4000` (and `5173` if you start both)

## What students get

- Subject drills, full mocks, high-influence (DBMS / Networks / OS / mix)
- IBPS-style CBT: palette, mark for review, autosave, −0.25, keys `1–4 / N / P / H / M`
- 1–3 hints per question while writing
- After submit: rule, why the key is right, why the others fail, Remember
- **This paper’s stats** on a review = that sitting only. Dock **Stats** = every paper.

## What the coach gets

- Create / edit papers; set hint cap 1–3
- Import CSV or JSON (preview then commit)
- Live permission changes while a student is writing (no restart)
- Per-student boosts from Live (`+1 min`, `+1 hint`)

## Import — same files as before

**No new columns.** Use the templates in `import-templates/`:

- `aaroh-questions.csv`
- `aaroh-questions.json`
- `HOW-TO.md` — what to fill, how to write explanations

Header (copy exactly):

```
exam_code,exam_title,exam_type,exam_family,stage,subject,section,duration_min,marks_per_q,negative,max_hints,question,option_a,option_b,option_c,option_d,correct,explanation,hint,hint_2,hint_3,topic,difficulty
```

`exam_family` ∈ `IBPS_SO_IT` · `SEBI_GRADE_A` · `NABARD_GRADE_A`  
`exam_type` ∈ `subject` · `full` · `high_influence`

Write **explanation** as 2–3 sentences. The result screen splits them:

1. First sentence → **The rule**
2. Middle → **Why the key is right**
3. Last sentence → **Remember**

Hints must not name the answer letter. Coach desk → Import → drop file → Preview → Commit.
