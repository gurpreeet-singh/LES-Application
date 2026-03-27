# Codebase-Only Tables: Mapping to Excel Schema

This document describes the tables that exist in the codebase migration files (001-012) but are **not present** in the Excel database schema (`LES_Database_Schema.xlsx`). It explains how each table links to the Excel schema and what role it plays in the product.

---

## 1. Gates (Knowledge Milestones)

**Table:** `gates`
**Migration:** `003_knowledge_graphs.sql`

Gates are curriculum milestones within a course. Students must demonstrate mastery at each gate before progressing.

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `gates.course_id` → `courses.id` | Each course contains multiple gates (ordered curriculum checkpoints) |
| Referenced by → `questions.gate_id` | Questions are tied to specific gates |
| Referenced by → `lessons.gate_id` | Lessons teach specific gates |
| Referenced by → `student_gate_progress.gate_id` | Mastery tracked per gate |
| Feeds into → `risk_scores` | Low mastery triggers at-risk scoring |
| Feeds into → `ai_recommendations` | Mastery gaps generate recommendations |
| Feeds into → `report_cards.skill_map` | Gate mastery contributes to skill mapping |

### Where It Fits
Your Excel schema has `courses → content_items → assessments → questions` as a flat structure. Gates add a **prerequisite-based progression layer** between courses and content, enabling adaptive learning paths.

---

## 2. Gate Prerequisites (Dependency Graph)

**Table:** `gate_prerequisites`
**Migration:** `003_knowledge_graphs.sql`

Self-referential table that defines which gates must be mastered before a student can attempt another gate.

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `gate_prerequisites.gate_id` → `gates.id` | The gate that has a prerequisite |
| `gate_prerequisites.prerequisite_gate_id` → `gates.id` | The gate that must be completed first |
| Controls → `student_gate_progress.is_unlocked` | Determines if a student can access a gate |

### Where It Fits
No equivalent in the Excel schema. This enables **conditional learning paths** — e.g., "Student must master Algebra basics before attempting Quadratic Equations."

---

## 3. Sub-Concepts (Granular Topics)

**Table:** `sub_concepts`
**Migration:** `003_knowledge_graphs.sql`

Breaks down each gate into smaller, teachable concepts.

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `sub_concepts.gate_id` → `gates.id` | Each gate contains multiple sub-concepts |
| Referenced by → `questions.sub_concept_id` | Questions can target specific sub-concepts |

### Where It Fits
The Excel schema's `content_items.topic_tags` provides topic-level tagging, but sub_concepts provides a **hierarchical structure** (course → gate → sub_concept → question) for more precise knowledge mapping.

---

## 4. Gate Bloom Targets (Mastery Thresholds)

**Table:** `gate_bloom_targets`
**Migration:** `003_knowledge_graphs.sql`

Defines the minimum Bloom's taxonomy mastery percentage required for each gate (e.g., remember: 90%, understand: 80%, apply: 75%).

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `gate_bloom_targets.gate_id` → `gates.id` | 1:1 — one target row per gate |
| Compared against → `student_gate_progress.bloom_scores` | Determines if student has achieved mastery |
| Influences → `questions.bloom_level` | Questions are tagged with their Bloom level |

### Where It Fits
The Excel schema's `questions` table has `bloom_level` for individual questions, but there's no table defining **target mastery thresholds** per cognitive level. This table sets the bar students must clear.

---

## 5. Socratic Scripts (Teaching Methodology)

**Table:** `socratic_scripts`
**Migration:** `004_lessons.sql`

Stage-by-stage guided questioning scripts for the Socratic teaching method, tied to lessons.

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `socratic_scripts.lesson_id` → `lessons.lesson_id` | Each lesson has multiple Socratic stages |
| `lessons.gate_id` → `gates.id` | Lessons teach specific gates |
| `lessons.course_id` → `courses.id` | Lessons belong to a course |

### Where It Fits
The Excel schema has `content_items` for learning materials but no concept of **structured teaching scripts**. Socratic scripts sit alongside content_items as the instructional delivery methodology layer.

---

## 6. Principal Actions (Intervention Tracking)

**Table:** `principal_actions`
**Migration:** `012_principal_dashboard.sql`

Tracks interventions taken by principals/admins in response to AI alerts (nudge teacher, schedule meeting, assign mentor, notify parent, refer counselor, etc.).

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `principal_actions.principal_id` → `users.id` | The admin/management user taking action |
| `principal_actions.target_teacher_id` → `users.id` | Faculty being supported |
| `principal_actions.target_student_id` → `users.id` | Student being supported |
| `principal_actions.target_course_id` → `courses.id` | Related course |
| Triggered by → `ai_recommendations` | AI alerts surface issues; principal acts |
| Triggered by → `risk_scores` | At-risk students trigger interventions |
| Logged in → `notifications` | Actions can generate notifications |

### Where It Fits
The Excel schema captures the **intelligence** (what's wrong via `ai_recommendations` and `risk_scores`) but not the **intervention** (what was done about it). This table is the action response layer.

---

## 7. Learning Profiles (Student Personalization)

**Table:** `learning_profiles`
**Migration:** `008_learning_profiles.sql`

Per-student, per-course learning style scores (logical, visual, reflective, kinesthetic, auditory) inferred from question attempts.

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `learning_profiles.student_id` → `users.id` | One profile per student per course |
| `learning_profiles.course_id` → `courses.id` | Learning style varies by subject |
| Populated from → `question_attempts` | Styles inferred as students answer questions |
| Feeds into → `ai_recommendations` | Personalized content recommendations |

### Where It Fits
Between `enrollments` and `ai_recommendations`. The Excel schema doesn't capture learning style preferences — this table enables adaptive content delivery.

---

## 8. Session Plan (Lesson-to-Session Mapping)

**Table:** `session_plan`
**Migration:** `010_timetable.sql`

Maps lessons to session numbers with portion tracking (full, first-half, second-half, partial).

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `session_plan.course_id` → `courses.id` | Plans belong to a course |
| `session_plan.lesson_id` → `lessons.id` | Maps which lesson is taught in which session |
| Links to → `timetable_slots` | Timetable defines when; session_plan defines what content |
| Links to → `sessions` | Sessions track actual delivery; session_plan is the blueprint |

### Where It Fits
Between `timetable_slots` and `sessions`. Timetable = when, Session Plan = what content, Sessions = actual delivery record.

---

## 9. Question Attempts (Per-Question Tracking)

**Table:** `question_attempts`
**Migration:** `006_student_progress.sql`

Individual question-level attempt tracking with AI feedback and misconception detection.

### Links to Excel Schema
| Relationship | Connection |
|---|---|
| `question_attempts.student_id` → `users.id` | The student who attempted |
| `question_attempts.question_id` → `questions.id` | The question attempted |
| `question_attempts.gate_id` → `gates.id` | The gate being assessed |
| Aggregated into → `student_gate_progress` | Mastery scores computed from attempts |
| Feeds into → `learning_profiles` | Learning style inferred from responses |
| Feeds into → `risk_scores` | Poor performance triggers risk scoring |

### Where It Fits
The Excel schema's `submissions` table tracks **assessment-level** attempts. `question_attempts` adds **question-level granularity** with Bloom's taxonomy tracking and misconception detection.

---

## Complete Data Flow

```
CONTENT CREATION:
  courses → gates → sub_concepts → questions
                  → lessons → socratic_scripts
                  → gate_bloom_targets
                  → session_plan → sessions

STUDENT JOURNEY:
  enrollments → question_attempts → student_gate_progress
                                  → learning_profiles
              → gate_prerequisites (unlock logic)
              → submissions (assessment-level)

INTELLIGENCE & ACTION:
  student_gate_progress ──► risk_scores
                        ──► ai_recommendations ──► principal_actions
                        ──► student_progress_snapshots
                        ──► report_cards
```
