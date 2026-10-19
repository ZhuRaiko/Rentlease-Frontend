---
name: rentlease-feature-implementation
description: Use for nearly every RENTLEASE feature or cohort implementation, including extending an existing flow or connecting backend data.
---

# RENTLEASE feature implementation

Implement one coherent, reviewable flow in this Android-first React Native + Expo + TypeScript frontend. Keep the solution appropriate for a university thesis application.

## Inspect and scope before editing

- MUST read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/FRONTEND_CONTEXT.md`, `docs/FIGMA_WORKFLOW.md` and relevant living feature docs.
- Inspect the target `src/features/<feature>/` Views, ViewModels, services, models, tests, navigation wiring in `App.tsx`, shared components/theme and related implementations. Search before declaring an implementation missing or creating another abstraction.
- If backend data is involved, inspect `src/shared/services/supabase/database.types.ts` and confirmed backend context. Identify what exists, what this pass implements, explicit deferrals, unresolved policy and facts that must not be invented. Continue independent supported work when a contract is missing; surface the specific dependent blocker.

## Coordinate the suite

Read the relevant sibling `SKILL.md` at the point it applies:

| Concern | Skill |
| --- | --- |
| Frontend code, state, services or navigation | [rentlease-frontend-mvvm-guard](../rentlease-frontend-mvvm-guard/SKILL.md) |
| Supabase/Auth/Storage/RPC/Realtime/Edge Function integration | [rentlease-supabase-contract-guard](../rentlease-supabase-contract-guard/SKILL.md) |
| Sensitive data, ownership or privileged actions | [rentlease-security-review](../rentlease-security-review/SKILL.md) |
| Focused tests and completion evidence | [rentlease-test-runtime-verification](../rentlease-test-runtime-verification/SKILL.md) |
| Actual behavior or status changes | [rentlease-documentation-maintainer](../rentlease-documentation-maintainer/SKILL.md) |
| Creating or reorganizing historical reports | [rentlease-implementation-artifact-organizer](../rentlease-implementation-artifact-organizer/SKILL.md) |

## Implement, validate, document

MUST preserve View → ViewModel → service/data access → approved backend boundaries. Reuse existing code before adding services, models, utilities, components or state abstractions. Prefer the smallest complete flow, explicit ownership and truthful loading/error/status handling. MUST NOT silently invent product policy, fake backend success, add speculative infrastructure or mix unrelated cohorts.

This repository consumes Supabase PostgreSQL/PostGIS, Auth, Storage, Realtime and confirmed Edge Functions; there is no Node/Express backend. A separate FastAPI/XGBoost service is an external boundary, not frontend server code. MUST NOT modify schema, RLS, backend functions/infrastructure, ML training or deployment. Do not introduce unapproved technologies/dependencies; Redux, Zustand, MobX and Axios require explicit authorization and a justified architectural need.

Add focused behavior/orchestration/edge/regression tests where meaningful; preserve existing coverage. Follow the verification skill for applicable `npm run typecheck`, `npm test`, `npx expo install --check`, `git diff --check` and `git status`. Update relevant living docs in the same pass after validating code; record runtime-unverified and unresolved items before finishing.

Report files created/modified, behavior, exact backend calls connected, tests added, command results, deferred work and a concise manual Android test sequence. Distinguish IMPLEMENTED, AUTOMATED-TESTED, RUNTIME-UNVERIFIED, RUNTIME-VERIFIED and DEFERRED as defined by the verification skill. Do not claim user Android verification from unit tests or agent-only observations. MUST NOT commit or push automatically.
