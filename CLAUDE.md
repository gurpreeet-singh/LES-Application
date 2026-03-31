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

## Features Built (March 30-31, 2026)

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
- "One Platform, Every Class Level" section in all guides
- Routes: `/teacher/guide`, `/student/guide`, `/admin/guide`

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

---

## Known Issues & Technical Debt

1. **Temporary endpoints** in `routes/index.ts`: `/seed-demo`, `/update-questions` — should be removed after demo period.
2. **Supabase query performance** — Large courses (350+ questions × 30 students = 10,500+ attempts) require per-gate batching to avoid default 1000-row limit.
3. **Some gates have 0 lessons** — AI deconstruction Phase 2 occasionally fails to generate lessons for some gates (JSON truncation with Haiku). These gates show as "upcoming" in analytics.
4. **Pre-commit hooks** — `tsc` strict mode fails on pre-existing type errors (GateNode, import.meta.env). Vite build works fine.
5. **Student experience is minimal** — Only 2 pages (dashboard + quiz). Lesson content (slides, flashcards, mind map, chatbot) only accessible from teacher view. Expanding student access is the next priority based on teacher feedback (2026-03-31).

---

## Teacher Feedback (2026-03-31 Demo)

Key insight: Teachers want the platform to **adapt to learner abilities and potential**, not just optimize teaching pedagogy. Current platform is teacher-centric (content generation + analytics) but student experience is thin. Priority areas:
- Bloom-gated question difficulty (serve questions at student's level)
- Learning style inference from quiz behavior
- Student-facing misconception feedback
- Adaptive learning paths (personalized gate sequencing)
- Expose lesson content (slides, flashcards, chatbot) to students
