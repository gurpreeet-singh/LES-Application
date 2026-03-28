# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install all workspace dependencies
npm install

# Run everything (API + Web) in dev mode via Turborepo
npm run dev

# Run individual apps
cd apps/api && npm run dev      # Express API on :3001 (tsx watch)
cd apps/web && npm run dev      # Vite dev server on :5180 (proxies /api → :3001)

# Build
npm run build                   # Turbo builds shared → api → web
npm run build:web               # Production web build only (used by Railway)

# Clean all dist/ outputs
npm run clean
```

There are no tests, linting configs, or formatters configured in this project.

## Environment

Copy `.env.example` to `.env` in the project root. Required variables:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- At least one LLM key: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- Frontend vars prefixed `VITE_` are baked into the web build

## Architecture

**Monorepo** (Turborepo + npm workspaces) with three packages:

| Package | Tech | Entry |
|---------|------|-------|
| `@leap/shared` | TypeScript + Zod | `packages/shared/src/index.ts` |
| `@leap/api` | Express + TypeScript | `apps/api/src/index.ts` |
| `@leap/web` | React 18 + Vite + Tailwind | `apps/web/src/App.tsx` |

**Dependency flow:** `@leap/shared` must build first (Turbo handles this). Both `@leap/api` and `@leap/web` import types, constants, and validators from it.

### Shared Package (`packages/shared/src/`)

Single source of truth for the domain model. Two key directories:

- **`types/`** — TypeScript interfaces for all domain entities: User, Course, Gate, SubConcept, Lesson, SocraticScript, Question, StudentGateProgress, QuestionAttempt, LearningProfile, AISuggestion, BloomLevel, HeatmapData, DeconstructionOutput
- **`constants/`** — Bloom taxonomy thresholds/weights/colors, and all LLM prompt templates (system-prompt, quiz-prompt, grading-prompt, extraction-prompt, suggestion-prompt)
- **`validators/schemas.ts`** — Zod schemas validating the 10-step `DeconstructionOutput` from LLM responses

### API (`apps/api/src/`)

Express server on port 3001. All routes mount under `/api/v1`.

**Structure:**
- `config/` — env vars (`env.ts`), Supabase clients (`supabase.ts`), CORS setup
- `middleware/` — auth (JWT via Supabase), role-based access, rate limiting (general + LLM-specific), async handler, request validation
- `routes/` — 13 route files registered in `routes/index.ts`
- `services/` — business logic (deconstruction, quiz generation, grading, adaptive suggestions, session planning, slide/narration generation, demo seeders)
- `services/llm/` — `provider.ts` (multi-provider abstraction for Anthropic/OpenAI/OpenRouter) and `parser.ts` (JSON extraction from LLM responses)
- `utils/dag.ts` — DAG utilities for prerequisite ordering

**Route hierarchy:**
```
/auth                              — signup, login, refresh, logout, profile
/courses                           — CRUD, syllabus upload/process, finalize, enroll
  /:courseId/kg                    — knowledge graph (gates + prerequisites)
  /:courseId/lessons               — lesson CRUD, status updates
  /:courseId/questions             — question CRUD, AI generation per lesson
  /:courseId/analytics             — heatmap, bloom distribution, dependency risks, sessions
  /:courseId/suggestions           — AI adaptive suggestions
  /:courseId/students              — enrollment management
  /:courseId/lessons/:id/media     — slide/presentation generation
/students/:studentId/progress      — progress tracking, quiz attempts, answer sheet grading
/programs                          — multi-course program grouping
/admin                             — school-wide overview
```

### Web (`apps/web/src/`)

React SPA with three role-based interfaces. Routing defined in `App.tsx`.

- **Auth:** `context/AuthContext.tsx` — Supabase session management, JWT auto-refresh, role detection
- **API client:** `api/client.ts` — Axios wrapper injecting Bearer tokens, base URL `/api/v1`
- **State:** TanStack React Query for server state (30s stale time, single retry)
- **Pages:** `pages/` directory organized by role (teacher/, student/, admin/) plus shared auth pages
- **Components:** Reusable viz components (BloomRadar, KGCircleNodes, GateDependencyGraph, VelocitySVG, Heatmap)

Vite proxies `/api` to `localhost:3001` in dev mode.

## Database (Supabase/PostgreSQL)

Schema defined in `supabase/migrations/` (12 migration files, `001` through `012`).

**Core tables:** `profiles`, `courses`, `gates`, `gate_prerequisites`, `sub_concepts`, `gate_bloom_targets`, `lessons`, `socratic_scripts`, `questions`, `enrollments`, `student_gate_progress`, `question_attempts`, `ai_suggestions`, `learning_profiles`, `session_plan`, `principal_actions`

**Key enums:** `user_role`, `course_status`, `gate_status`, `lesson_status`, `question_type`, `bloom_level`, `suggestion_type`, `suggestion_status`, `principal_action_type`

Row-level security (RLS) policies in `009_rls_policies.sql` — teachers see own courses, students see enrolled courses only, admins manage school-wide actions. Performance indexes in `011_performance_indexes.sql`.

## Core Domain Concepts

- **Gates** are prerequisite-gated concept clusters (not linear chapters). They form a DAG via `gate_prerequisites`.
- **Bloom's Taxonomy** is first-class: every gate, lesson, question, and progress metric maps to 6 cognitive levels (remember → create) with configurable mastery thresholds.
- **Course Deconstruction** is the centerpiece: teacher uploads syllabus → LLM produces a 10-step `DeconstructionOutput` (concepts, knowledge graph, gates, Bloom mapping, learning order, lessons, Socratic scripts, diagnostic questions, visual spine, outcomes) → Zod-validated → stored across multiple tables.
- **Socratic Scripts** follow 4 stages per lesson: Hook → Discovery → Concept Build → Application.
- **Course status flow:** draft → processing → review → active → archived.

## Deployment

- **Vercel** (`vercel.json`): builds and serves the web SPA with fallback routing
- **Railway** (`railway.toml`): builds both apps, serves API which also serves the static web build; health check on `/health`
