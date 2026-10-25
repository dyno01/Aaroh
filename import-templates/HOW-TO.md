# How to write an Aaroh paper (CSV or JSON)

One **row** (CSV) or one **object** (JSON) = one question.  
Repeat the exam fields on every row of the same paper. After import, students see it immediately.

---

## CSV — save as `.csv` (UTF-8)

**Header row (copy this exactly):**

```
exam_code,exam_title,exam_type,exam_family,stage,subject,section,duration_min,marks_per_q,negative,max_hints,question,option_a,option_b,option_c,option_d,correct,explanation,hint,hint_2,hint_3,topic,difficulty
```

Then one line per question. If a cell has a comma, wrap it in double quotes.

| Column | Required | What to write |
| --- | --- | --- |
| `exam_code` | yes | Unique id. Example: `SOIT-SUB-DBMS-02` |
| `exam_title` | yes | Name students see |
| `exam_type` | yes | Paper style slug. Built-in: `subject` `full` `high_influence`. **Any new value becomes a Tests button.** Optional `type_label` is the name students see (e.g. Previous year). |
| `exam_family` | yes | Exam slug. Built-in: `IBPS_SO_IT` `SEBI_GRADE_A` `NABARD_GRADE_A`. **A new family (e.g. `RBI_GRADE_B`) adds an exam button.** Optional `family_label` for the display name. |
| `stage` | no | `prelims` or `mains` |
| `subject` | no | DBMS, Networks, OS, English… |
| `section` | no | Section tab in the CBT |
| `duration_min` | no | Whole paper length in minutes (default 10) |
| `marks_per_q` | no | Default marks for every question (1 prelims, 2 mains PK) |
| `marks` | no | Override marks for **this row only** |
| `negative` | no | Marks cut per wrong. IBPS = `0.25` |
| `max_hints` | no | Hint levels per question: `1`, `2` or `3` |
| `question` | yes | The stem |
| `option_a` … `option_d` | yes | Four choices |
| `correct` | yes | `a` `b` `c` or `d` (or `1`–`4`) |
| `explanation` | yes* | 2–3 sentences (see below). Do **not** paste a full chapter. |
| `hint` | no | Hint 1 — gentle nudge, never the key |
| `hint_2` | no | Hint 2 — stronger |
| `hint_3` | no | Hint 3 — last nudge, still not the answer |
| `topic` | no | Normalization, TCP/IP… (used on Path / this-paper stats) |
| `difficulty` | no | `easy` `moderate` `hard` |

\*After the test, Aaroh splits `explanation` automatically:

1. **First sentence** → “The rule”
2. **Middle sentence(s)** → “Why the key is right”
3. **Last sentence** → “Remember”

Wrong options are listed as distractors from the four choices. You do **not** need extra CSV columns or a notes dump.

**Example explanation**

> 3NF forbids a non-prime attribute that depends on another non-prime. 2NF only removes partial dependence on part of a key. Lock this: transitive extra attributes → 3NF, not BCNF.

Open `aaroh-questions.csv` in Excel / Google Sheets, duplicate the sample rows, fill your bank, File → Download CSV.

---

## JSON — save as `.json`

```json
{
  "exam": {
    "code": "SOIT-SUB-DBMS-02",
    "title": "DBMS — Subject Drill 02",
    "type": "subject",
    "exam_family": "IBPS_SO_IT",
    "stage": "mains",
    "subject": "DBMS",
    "duration_min": 12,
    "marks_per_q": 1,
    "negative": 0.25,
    "max_hints": 3
  },
  "questions": [
    {
      "q_en": "Your question here?",
      "option_a": "…",
      "option_b": "…",
      "option_c": "…",
      "option_d": "…",
      "correct": "b",
      "topic": "Normalization",
      "hint": "Gentle nudge",
      "hint_2": "Stronger nudge",
      "hint_3": "Last nudge, not the key",
      "explanation": "First sentence is the rule. Middle is why the key is right. Last sentence is the remember line."
    }
  ]
}
```

---

## Rules that matter

1. **Same `exam_code`** on every row of one paper. A new code = a new paper.
2. **`correct`** must match an option letter.
3. Hints must **not** say “the answer is C”.
4. Import from Coach desk → **Import** → drop the file → Preview → **Commit**.
5. SEBI / NABARD: set `exam_family` to `SEBI_GRADE_A` or `NABARD_GRADE_A`. Same columns.

Files in this folder:

- `aaroh-questions.csv` — ready to open and extend  
- `aaroh-questions.json` — same paper in JSON  
