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
apps/web/src/pages/teacher/   — Teacher pages
apps/web/src/pages/student/   — Student pages
apps/web/src/pages/auth/      — Login/signup
apps/web/src/pages/shared/    — Landing page
apps/api/src/routes/          — API endpoints
apps/api/src/services/        — Business logic + LLM services
packages/shared/src/          — Shared types + prompts
supabase/migrations/          — DB schema
```

---

## Mission Control Integration

This project uses [Mission Control](.mission-control/) for structured development.

### For Bug Fixes (POC Week)
Use `.mission-control/playbooks/fix-whats-broken.md`:
1. Reproduce → Root cause → Fix → Verify → Deploy

### For New Features
Use `.mission-control/playbooks/build-an-app.md`:
1. Brainstorm → Plan → Execute → TDD → Review → Ship

### For Product Decisions
Route through `.mission-control/ROUTER.md` → CPO/CTO leaders

### Available Commands
- `.mission-control/commands/commit/` — Conventional commits
- `.mission-control/commands/create-pr/` — PR workflow
- `.mission-control/commands/pr-review/` — 6-perspective review
- `.mission-control/commands/fix-github-issue/` — Issue resolution

---

## Non-Negotiable Rules

1. **Don't break demos** — LMGC and HUC demos run daily. Test before deploying.
2. **Explore before executing** — Read existing code before modifying.
3. **No AI credits for demos** — Demo data is pre-seeded. Only new course creation uses LLM.
4. **Tiered LLM models** — Use SMART (Sonnet) only for Phase 1 deconstruction. Everything else uses FAST (Haiku) or CHEAP (Gemini Flash).
5. **Evidence before claims** — Run the test, read the output, verify it works.
6. **Max 3 cycles** — If a fix fails 3 times, rethink the approach.

---

## Deployment

```bash
# Frontend (Netlify)
npm run build:web
cd apps/web && netlify deploy --prod --no-build --dir=dist

# Backend (Railway)
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
| FAST | `anthropic/claude-haiku-4-5-20251001` | Lessons, quizzes, grading, suggestions, cross-course detection |
| CHEAP | `google/gemini-flash-1.5` | Vision extraction |

---

## Key Files

| Purpose | File |
|---|---|
| System prompts | `packages/shared/src/constants/system-prompt.ts` |
| Quiz prompts | `packages/shared/src/constants/quiz-prompt.ts` |
| Grading prompts | `packages/shared/src/constants/grading-prompt.ts` |
| Suggestion prompts | `packages/shared/src/constants/suggestion-prompt.ts` |
| Extraction prompts | `packages/shared/src/constants/extraction-prompt.ts` |
| LLM provider + tiers | `apps/api/src/services/llm/provider.ts` |
| Deconstruction service | `apps/api/src/services/deconstruction.service.ts` |
| HUC demo seeder | `apps/api/src/services/huc-demo-seeder.service.ts` |
| School demo seeder | `apps/api/src/services/demo-seeder.service.ts` |
| Slide generation | `apps/api/src/services/slide-generation.service.ts` |
| Admin routes | `apps/api/src/routes/admin.routes.ts` |
| Program routes | `apps/api/src/routes/program.routes.ts` |
