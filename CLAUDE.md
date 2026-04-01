# LEAP Platform — Project Instructions

## About This Project

**LEAP** (Learning Execution and Acceleration Platform) is an AI-powered education platform serving K-12 schools and universities. Deployed at https://leap-ikigai.netlify.app.

### Tech Stack
- **Frontend:** React 18, Vite, TailwindCSS → Netlify
- **Backend:** Node.js, Express, TypeScript → Railway
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **LLM:** OpenRouter (Claude Sonnet for deep tasks, Haiku for structured tasks, Gemini Flash for vision)
- **Monorepo:** Turborepo + npm workspaces (`apps/web`, `apps/api`, `packages/shared`)

### Two Institutions
- **LMGC** (La Martiniere Girls' College) — K-12 school with principal, teachers, students
- **HUC** (Horizon University College) — University with cross-course dependencies

### Key Directories
```
apps/web/src/pages/admin/     — Principal dashboard
apps/web/src/pages/teacher/   — Teacher pages (courses, lessons, analytics, guide)
apps/web/src/pages/student/   — Student pages (dashboard, quiz)
apps/web/src/pages/auth/      — Login/signup
apps/web/src/pages/shared/    — Landing page
apps/web/src/components/      — Shared components (BloomRadar, BloomBarSVG, VelocitySVG, ClassTrajectory, etc.)
apps/api/src/routes/          — API endpoints
apps/api/src/services/        — Business logic + LLM services
packages/shared/src/          — Shared types + prompts + constants
supabase/migrations/          — DB schema
```

---

## Live Demo Courses (as of 2026-03-31)

4 active courses under teacher `anita@lmgc.edu`:

| Course | Class | Lessons | Questions | Students | Analytics |
|---|---|---|---|---|---|
| Class 5 Mathematics (Demo) | 5 | 30 | 300 | 8 | Full |
| Class 3 English Language | 3 | 17 | 170 | 30 | Full |
| Class 8 Mathematics | 8 | 21 | 210 | 30 | Full |
| Class 11 Economics | 11 | 35 | 350 | 30 | Full |

All courses have: seeded student data, question attempts, gate progress, learning profiles, AI suggestions, dependency risks.

---

## Class-Level Pedagogy System

The AI pipeline automatically adapts based on `class_level` set on the course:

| Tier | Classes | Bloom Ceiling | Session Duration | Question Style |
|---|---|---|---|---|
| **Primary** | 1-5 | Apply | 30-35 min | Story-based, 3-option MCQ, fill-in-blank, "Riya says..." |
| **Middle** | 6-8 | Analyze | 40-45 min | "Find the error", "Compare methods", worked problems |
| **Senior** | 9-12 | Create | 45-50 min | Case studies, debate, data analysis, Indian context |

**Implementation:** `getClassLevelDirective()` in `packages/shared/src/constants/system-prompt.ts` generates tier-specific prompts. Injected into Phase 1 (structure), Phase 2 (lessons), and quiz generation.

---

## Features Built (March 30 - April 2, 2026)

### Lesson Detail Page (`apps/web/src/pages/teacher/LessonDetailPage.tsx`)
- **Interactive Quiz Player** — Take quiz mode with one question at a time, immediate feedback, score tracking
- **Mind Map** — Visual lesson concept tree (objective → key ideas → examples → bloom levels)
- **Flashcards** — Derived from questions + lesson content, card flip animation, "Got it" / "Review again"
- **Lesson Chatbot** — Floating chat widget grounded in lesson content, uses Haiku via `apps/api/src/routes/chat.routes.ts`

### Syllabus & Objectives Tab (`apps/web/src/pages/teacher/CourseDetailPage.tsx`)
- Structured view of gates → lessons with objectives, key ideas, Bloom badges
- Bloom level distribution summary
- Collapsible original syllabus at bottom

### Analytics Redesign (`apps/web/src/pages/teacher/ClassAnalyticsPage.tsx`)
- **Overview:** Real stats from `question_attempts` (not estimates). Scrollable heatmap.
- **Sessions:** Per-lesson scores via round-robin question distribution. Real student scores per session.
- **Students:** Trajectory chart → Gate Mastery list + Bloom bars + Velocity → Student table (scrollable) + Detail panel (right side, click any student)
- **AI Guide:** Reads from `ai_suggestions` table with priority mapping (remediation=high, pace_change=medium, peer_teaching=low)

### Quiz Prompt Redesign (`packages/shared/src/constants/quiz-prompt.ts`)
- Action verb clarity (banned "apply the concept" templates)
- Misconception-based distractors
- Student personas ("Riya says...", "A student claims...")
- Observable output requirements
- Class-level question format adaptation

### Platform Guide (`apps/web/src/pages/teacher/PlatformGuidePage.tsx`)
- 4 persona-specific guides: Teacher (School), Teacher (College), Student, Admin
- "One Platform, Every Class Level" + "DIKW Learning Progression" sections
- Routes: `/teacher/guide`, `/student/guide`, `/admin/guide`

### DIKW Framework Integration (April 1, 2026)
- DIKW constants: `DIKWLevel`, `DIKW_MAPPING`, `DIKW_COLORS`, `getDIKWLevel()`, `getDIKWLevelByPosition()`
- DIKW badges on lessons, Socratic scripts, quiz headers, course overview, sessions, student detail
- DIKW pyramid on student dashboard and teacher analytics
- DIKW-aware Socratic script styles: Data=teacher-led, Knowledge=discovery, Wisdom=debate
- DIKW progression bar on course overview and syllabus tab
- Coaching prompts per DIKW level (Thinking Coach card in Socratic tab)

### Progressive Session Generation (April 1, 2026)
- `POST /courses/:id/generate-next-session` — iterative one-session-at-a-time generation
- Each session adapts to: previous session outcomes, class avg, misconceptions, teacher feedback, class diagnostic profile
- `POST /courses/:id/generate-all-remaining` — batch fallback
- Upload page: Progressive/Batch mode toggle (Progressive default)
- Course detail: Progressive generation card with progress bar + feedback input
- Uses direct Railway URL (not Netlify proxy) to avoid 30s timeout

### 10 Research-Backed Features (April 1-2, 2026)
- **F1: Student Lesson Access** — Students can view slides, flashcards, mind map, chatbot per lesson
- **F2: Think-Pair-Share** — [TPS] prompts in Knowledge/Wisdom Socratic scripts
- **F3: Worked Example Fading** — 3-4 examples early → 1 example late (cognitive load theory)
- **F4: Pre-class AI Prep** — "Prepare for Class" page with readiness quiz (flipped classroom)
- **F5: Bloom-Gated Quiz** — Questions ordered Remember → Create (ZPD scaffolding)
- **F6: Spaced Repetition Flashcards** — Review tracking with 1→3→7→14→30 day intervals
- **F7: Process-Focused Feedback** — "You used wrong rule at step 2" not just "Wrong"
- **F8: Metacognitive Prediction** — "How will you score?" slider before quiz
- **F9: Interleaved Review** — 2 review questions from past sessions after Session 3
- **F10: Mastery Indicators** — Not Started → Attempted → Familiar → Proficient → Mastered

### Learner Profiling System (April 2, 2026)
- **Diagnostic Assessment** — 20-question "Getting to Know Your Learning Style" at enrollment
  - 4 sections: Prior Knowledge, Cognitive Readiness (Bloom ladder), Learning Strategy, Processing Preference
  - Scoring: prior_knowledge_score, bloom_ceiling, strategy_profile, 5 learning dimensions
  - Student sees encouraging summary; teacher sees full profile with strategy label
- **Students Tab** — Dedicated tab in CourseDetailPage with full per-student profiles
  - Two-panel: roster (sortable, filterable by strategy) + student deep dive (right panel)
  - Shows: strategy badge, Bloom ceiling, prior knowledge, learning style bars, diagnostic status
  - Filter by: All, Competent, Deep, Surface, Struggling, Not Assessed
- **Class Profile in Progressive Generation** — Aggregated diagnostic data feeds into session generation
  - Dominant strategy, avg prior knowledge, dominant learning dimension, struggling count
  - AI adapts: surface class → more examples; visual class → more diagrams; low knowledge → basics first
- **Continuous Inference** — Strategy profile updates from ongoing quiz patterns

---

## Mission Control Integration

This project uses [Mission Control](.mission-control/) for structured development.

### For Bug Fixes
Use `.mission-control/playbooks/fix-whats-broken.md`:
1. Reproduce → Root cause → Fix → Verify → Deploy

### For New Features
Use `.mission-control/playbooks/build-an-app.md`:
1. Brainstorm → Plan → Execute → TDD → Review → Ship

### For Product Decisions
Route through `.mission-control/ROUTER.md` → CPO/CTO leaders

---

## Non-Negotiable Rules

1. **Don't break demos** — 4 live courses with 30 students each. Test before deploying.
2. **Explore before executing** — Read existing code before modifying.
3. **Tiered LLM models** — Use SMART (Sonnet) only for Phase 1 deconstruction. Everything else uses FAST (Haiku) or CHEAP (Gemini Flash).
4. **Supabase row limit** — Default is 1000 rows. Use `.limit(10000)` or per-gate batching for `question_attempts` queries.
5. **Evidence before claims** — Run the test, read the output, verify it works.
6. **Max 3 cycles** — If a fix fails 3 times, rethink the approach.
7. **Class-level awareness** — Always pass `course.class_level` to processSyllabus and quiz generation.

---

## Deployment

```bash
# Frontend (Netlify)
cd apps/web
VITE_API_URL=/api/v1 VITE_DIRECT_API_URL=https://les-platform-api-production.up.railway.app/api/v1 npx vite build
npx netlify deploy --prod --no-build --dir="$(pwd)/dist"

# Backend (Railway)
cd /path/to/leap-platform
railway up

# Both in parallel for speed
```

### Demo Accounts (one-click from landing page)
| Role | Email | Password |
|---|---|---|
| LMGC Principal | principal@lmgc.edu | admin1234 |
| LMGC Teacher | anita@lmgc.edu | demo123 |
| LMGC Student | student@lmgc.edu | student123 |
| HUC Prof. Abhay | abhay@hu.ac.ae | huc12345 |
| HUC Prof. Shashank | shashank@hu.ac.ae | huc12345 |
| HUC Student | student@hu.ac.ae | student123 |

---

## LLM Tiers (in `apps/api/src/services/llm/provider.ts`)

| Tier | Model | Used For |
|---|---|---|
| SMART | `anthropic/claude-sonnet-4` | Phase 1 syllabus deconstruction |
| FAST | `anthropic/claude-haiku-4-5` | Phase 2 lessons, quizzes, grading, suggestions, chat, cross-course detection |
| CHEAP | `google/gemini-flash-1.5` | Vision extraction (answer sheet reading) |

---

## Key Files

| Purpose | File |
|---|---|
| **System prompts + class-level directives** | `packages/shared/src/constants/system-prompt.ts` |
| **Quiz prompts (Bloom-aligned)** | `packages/shared/src/constants/quiz-prompt.ts` |
| **Grading prompts** | `packages/shared/src/constants/grading-prompt.ts` |
| **Suggestion prompts** | `packages/shared/src/constants/suggestion-prompt.ts` |
| **Extraction prompts** | `packages/shared/src/constants/extraction-prompt.ts` |
| **LLM provider + tiers** | `apps/api/src/services/llm/provider.ts` |
| **Deconstruction service (3-phase)** | `apps/api/src/services/deconstruction.service.ts` |
| **Multi-course student seeder** | `apps/api/src/services/multi-course-seeder.service.ts` |
| **Lesson chatbot API** | `apps/api/src/routes/chat.routes.ts` |
| **Analytics (sessions, heatmap, trajectory, lesson, student)** | `apps/api/src/routes/analytics.routes.ts` |
| **Adaptive suggestions** | `apps/api/src/routes/suggestion.routes.ts` |
| **Course detail + Syllabus tab** | `apps/web/src/pages/teacher/CourseDetailPage.tsx` |
| **Lesson detail + Quiz + Media + Chatbot** | `apps/web/src/pages/teacher/LessonDetailPage.tsx` |
| **Analytics page (4 tabs)** | `apps/web/src/pages/teacher/ClassAnalyticsPage.tsx` |
| **Class trajectory chart** | `apps/web/src/components/teacher/ClassTrajectory.tsx` |
| **Bloom radar (SVG)** | `apps/web/src/components/shared/BloomRadar.tsx` |
| **Bloom bars (HTML)** | `apps/web/src/components/shared/BloomBarSVG.tsx` |
| **Velocity chart (SVG)** | `apps/web/src/components/shared/VelocitySVG.tsx` |
| **Platform guide (all personas)** | `apps/web/src/pages/teacher/PlatformGuidePage.tsx` |
| **Route index (temp endpoints)** | `apps/api/src/routes/index.ts` |
| **Progressive session generation** | `apps/api/src/services/progressive-generation.service.ts` |
| **Progressive session prompt** | `packages/shared/src/constants/progressive-session-prompt.ts` |
| **Diagnostic questions + scoring** | `packages/shared/src/constants/diagnostic-questions.ts` |
| **Diagnostic API** | `apps/api/src/routes/diagnostic.routes.ts` |
| **DIKW badge component** | `apps/web/src/components/shared/DIKWBadge.tsx` |
| **DIKW pyramid component** | `apps/web/src/components/shared/DIKWPyramid.tsx` |
| **Student lesson page** | `apps/web/src/pages/student/LessonPage.tsx` |
| **Student course lessons page** | `apps/web/src/pages/student/CourseLessonsPage.tsx` |
| **Student prep page** | `apps/web/src/pages/student/PrepPage.tsx` |
| **Student diagnostic page** | `apps/web/src/pages/student/DiagnosticPage.tsx` |
| **All system prompts (consolidated)** | `LEAP_System_Prompts.md` |
| **Pedagogy research findings** | `LEAP_Combined_Pedagogy_Research.md` |

---

## Database Migrations (Supabase)

| Migration | Purpose |
|---|---|
| 001-012 | Original schema (users, courses, gates, lessons, questions, progress, suggestions, etc.) |
| 013 | Progressive generation: `generation_mode`, `current_session_number` on courses; `teacher_feedback`, `generation_context` on lessons; `structure_ready` status |
| 014 | Adaptive features: `prep_score`, `prep_completed_at` on student_gate_progress; `flashcard_reviews` table; `predicted_score` on question_attempts |
| 015 | Learner profiling: `strategy_profile`, `prior_knowledge_score`, `bloom_ceiling`, `engagement_score`, `diagnostic_results`, `diagnostic_completed_at` on learning_profiles |

---

## Known Issues & Technical Debt

1. **Temporary endpoints** in `routes/index.ts`: `/seed-demo`, `/update-questions` — remove after demo period.
2. **Supabase 1000-row limit** — Use `.limit(10000)` or per-gate batching for `question_attempts` queries.
3. **Some gates have 0 lessons** — AI Phase 2 occasionally fails (JSON truncation). Gates show as "upcoming".
4. **Pre-commit hooks** — `tsc` strict mode fails on pre-existing type errors. Vite build works fine.
5. **LLM calls must use direct Railway URL** — Netlify proxy times out at 30s. Quiz gen, chatbot, and progressive gen all use direct URL.
6. **Continuous strategy inference** — Not yet implemented. Strategy profile currently comes only from diagnostic assessment, not updated from ongoing quiz behavior.

---

## Teacher Feedback (2026-03-31 Demo)

Key insight: Teachers want the platform to **adapt to learner abilities and potential**, not just optimize teaching pedagogy.

**Addressed (April 1-2):**
- ✅ Bloom-gated question difficulty (F5)
- ✅ Learning style profiling via diagnostic assessment
- ✅ Student-facing lesson content (F1: slides, flashcards, mind map, chatbot)
- ✅ Adaptive session generation (progressive mode)
- ✅ Class diagnostic profile feeds into lesson generation

**Remaining:**
- Adaptive learning paths (personalized gate sequencing per student)
- Real-time strategy inference from quiz behavior (not just diagnostic)
- Student-facing misconception feedback dashboard
