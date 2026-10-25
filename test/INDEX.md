# IBPS SO IT Mains — mock-test pack

Import any `.csv` into Aaroh. The matching `.json` is the same paper, for the JSON importer. Do not rerun a seed script if an Aaroh database already exists.

## What the real Mains paper is

Source: IBPS CRP SPL-XVI detailed notification, 30 June 2026, clause D and clause E.
https://www.ibps.in/wp-content/uploads/Detailed-Notification-CRP-SPL-XVI_Final_V1_30.06.2026.pdf

For IT Officer (Scale I), the Online Main examination is:

| Test | Questions | Marks | Time | Role |
| --- | ---: | ---: | ---: | --- |
| English Language | 30 | 30 | 25 min | Qualifying |
| Reasoning | 40 | 40 | 35 min | Qualifying |
| Quantitative Aptitude | 30 | 30 | 25 min | Qualifying |
| Professional Knowledge (objective) | 50 | 100 | 40 min | Merit |
| Descriptive English | 2 | 25 | 30 min | Qualifying for this post |

Merit listing uses Professional Knowledge. English, Reasoning, Quant, and Descriptive English are not in this pack.

Penalty, in the notification's words: one fourth of the marks assigned to that question. A Professional Knowledge question is worth 2 marks, so a wrong answer costs 0.50. A blank answer costs nothing. Some blogs flatten this to 0.25 for every question. That reading does not match a 2-mark question.

Every file uses `exam_family=IBPS_SO_IT`, `family_label=IBPS SO IT`, `marks_per_q=2`, `marks=2` on every row, `negative=0.50`, `max_hints=3`, `stage=mains`, and `section=Professional Knowledge`.

`marks_per_q` is the paper default. `marks` is the value for that one question. They match here because every Professional Knowledge item is worth 2.

Score on a paper = (2 × correct) − (0.50 × wrong). Blanks are ignored.

## Buttons the hall will show

`exam_family` is the exam button. `exam_type` is the paper style. A new value creates a Tests button. `family_label` and `type_label` are the names students see.

| Button students see | Field | Value |
| --- | --- | --- |
| IBPS SO IT | exam_family / family_label | `IBPS_SO_IT` / IBPS SO IT |
| Subject drill | exam_type / type_label | `subject` / Subject drill |
| Full mock | exam_type / type_label | `full` / Full mock |
| High-influence PK | exam_type / type_label | `high_influence` / High-influence PK |
| Easy | exam_type / type_label | `easy` / Easy |
| Medium | exam_type / type_label | `medium` / Medium |
| Difficult | exam_type / type_label | `difficult` / Difficult |
| Debugging error test | exam_type / type_label | `debugging` / Debugging error test |

No RBI or previous-year button is created. Those were examples of how a new value works, not papers in this pack.

The question `difficulty` column still uses `easy`, `moderate`, and `difficult`, because that is the sample vocabulary. The Medium button is `exam_type=medium`. Inside that paper every question is `difficulty=moderate`.

## Types of test

| You asked for | What you sit | exam_type | Difficulty column |
| --- | --- | --- | --- |
| Subject-wise test | One file per subject, 8 questions | subject | Mixed |
| Easy test | Easy PK Drill | easy | All easy |
| Medium test | Medium PK Drill | medium | All moderate |
| Difficult test | Difficult PK Drill | difficult | All difficult |
| Full mock | Full Professional Knowledge Mock 01, 20 questions, 16 minutes | full | Mixed |
| Full mock with high PK influence | High-Influence PK Mock 01 | high_influence | DBMS, Networks, and OS dominate |
| Debugging error test | Three Debugging Error Tests | debugging | Easy, moderate, and difficult papers |

The real merit section is 50 questions in 40 minutes, which is 48 seconds a question. These sittings are shorter so every question can stay original and checked. The full and high-influence papers use that same pace: 20 questions, 16 minutes.

A subject or level drill of 8 questions is 10 minutes. A debugging paper is 12 or 14 minutes, because reading code takes longer than a one-line fact.

## Debugging

`exam_type=debugging` creates the Debugging error test button. `type_label` is `Debugging error test`. The title, subject, and exam code also say debugging.

The style is the Sanfoundry style: what is printed, or what is the compile-time, runtime, or logic error. The questions are original. No Sanfoundry item was copied.

## How a question is written

The explanation is three sentences. Sentence 1 is the rule. Sentence 2 says why the key is right. Sentence 3 starts with `Remember:`. Hints do not name the option letter.

## Files

| Code | Button | Type | Questions | Minutes | Easy | Moderate | Difficult |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `SOIT-SUB-DBMS-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-OS-01` | Subject drill | `subject` | 8 | 10 | 3 | 4 | 1 |
| `SOIT-SUB-CN-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-DSA-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-PROG-01` | Subject drill | `subject` | 8 | 10 | 3 | 4 | 1 |
| `SOIT-SUB-SE-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-COA-01` | Subject drill | `subject` | 8 | 10 | 3 | 4 | 1 |
| `SOIT-SUB-WEB-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-CYBER-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-CLOUD-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-EMERGING-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-SUB-BANK-01` | Subject drill | `subject` | 8 | 10 | 2 | 5 | 1 |
| `SOIT-LVL-EASY-01` | Easy | `easy` | 8 | 10 | 8 | 0 | 0 |
| `SOIT-LVL-MOD-01` | Medium | `medium` | 8 | 10 | 0 | 8 | 0 |
| `SOIT-LVL-DIFF-01` | Difficult | `difficult` | 8 | 12 | 0 | 0 | 8 |
| `SOIT-FULL-PK-01` | Full mock | `full` | 20 | 16 | 2 | 17 | 1 |
| `SOIT-HI-PK-01` | High-influence PK | `high_influence` | 20 | 16 | 1 | 14 | 5 |
| `SOIT-DEBUG-EASY-01` | Debugging error test | `debugging` | 8 | 12 | 8 | 0 | 0 |
| `SOIT-DEBUG-MOD-01` | Debugging error test | `debugging` | 8 | 12 | 0 | 8 | 0 |
| `SOIT-DEBUG-DIFF-01` | Debugging error test | `debugging` | 8 | 14 | 0 | 0 | 8 |

Total questions: 184. No stem is repeated across papers.

CSV path pattern: `IBPS_SO_IT_Mains/<folder>/<exam_code>.csv`

Folders: `subject`, `level`, `full`, `high_influence`, `debugging`.

A zip of every CSV is at `IBPS_SO_IT_Mains_CSVs.zip` in the mock_tests folder.

## Suggested order

1. Easy PK Drill, then the subject drill of your weakest chapter.
2. Moderate PK Drill, then Debugging Error Test — Moderate.
3. High-Influence PK Mock, then the Full Professional Knowledge Mock.
4. Difficult PK Drill and Debugging Error Test — Difficult once the moderate papers are clean.

On a mock, attempt it timed before you open hints. A hint that names the letter has failed its job, so these hints never do that.
