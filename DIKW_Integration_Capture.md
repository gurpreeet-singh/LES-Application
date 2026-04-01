# DIKW × Bloom's Integration into LEAP Platform

**Type:** Opportunity
**Priority:** High
**Effort:** Medium
**Date Captured:** 2026-04-01

## TL;DR
Integrate DIKW (Data → Information → Knowledge → Understanding → Wisdom) framework into LEAP's system prompts and platform to shift from information delivery to wisdom creation — as defined in the DIKW_Blooms_LMGC deck presented to teachers.

## Current State
- System prompts generate content at all Bloom levels equally — no DIKW progression
- Same Socratic script structure for every lesson regardless of depth
- Quiz distribution is fixed — doesn't shift toward higher-order thinking as course progresses
- Primary classes (1-5) have hard Bloom ceiling at Apply — blocks higher-order thinking entirely
- No pre-class AI prep flow — teacher must deliver Data/Information in class
- No teacher coaching prompts beyond content-specific Socratic scripts
- No Wisdom-level assessments (ethical dilemmas, open judgment)
- No DIKW visibility in analytics or student self-awareness

## Desired State
- Every lesson tagged with DIKW level — course shows clear climb from Data to Wisdom
- Socratic scripts vary by DIKW level (short for Data, debate-heavy for Wisdom)
- Quiz distribution shifts progressively (early = Remember/Understand, late = Evaluate/Create)
- Primary classes scaffold toward higher Bloom using age-appropriate framing, not block them
- Platform supports AI-handles-basics, teacher-handles-thinking model
- Teachers get "thinking coach" prompts alongside content scripts
- Wisdom assessments: ethical dilemmas, multi-stakeholder analysis, open judgment
- DIKW visible in dashboards and student profiles

## Leaders to Involve
- **CPO** — Product strategy: what features enable the DIKW shift
- **CTO** — Architecture: prompt changes, data model, new features
- **CDO** — Design: DIKW visualization in dashboards, student experience

## Notes & Risks
- P0 items are prompt-only changes — low risk, high impact
- P1 items need prompt + minor UI changes
- P2 items are new features requiring planning
- Must not break existing demo courses — all changes should enhance, not replace
