---
name: rentlease-documentation-maintainer
description: Use whenever RENTLEASE implementation changes actual feature behavior, architecture, integration status, routing or a documented assumption, or when correcting living project documentation.
---

# RENTLEASE documentation maintainer

Keep living documentation accurate in the same pass as implementation. Reports are historical evidence, not replacement project context.

## Maintain the right document

- MUST update relevant `docs/features/*.md` sections when actual behavior/status changes; preserve `AUTHENTICATION_PROFILES.md`, `USER_VERIFICATION.md` and future equivalents. Describe purpose/boundary, current behavior and ownership, integration/backend contract, source/service/ViewModel references, limitations, implemented/deferred work, unresolved decisions and required runtime tests. Record verification date, commit if available and evidence status; do not label uncommitted work as verified in its baseline commit.
- Keep `docs/FEATURES.md` a concise index/status/pointer document. Update it only for actual status changes, without duplicating detailed feature docs.
- Update `docs/ROUTES.md` only for changed routing or directly contradictory stale statements. Inspect executable routing rather than reproducing assumptions from old reports.
- Review `docs/ARCHITECTURE.md`, `docs/FRONTEND_CONTEXT.md`, `docs/BACKEND_CONTEXT.md`, `docs/AUTH_SUPABASE_INTEGRATION.md` and `docs/architecture/` if present only for facts affected by the change. Do not rewrite accurate unrelated sections.

## Evidence and consistency

Workflow: implementation → validate code → update affected living docs → record unresolved/runtime-unverified items → finish. Update an existing section instead of appending contradictory duplicates. Document implemented code, never planned behavior as delivered. Use IMPLEMENTED, AUTOMATED-TESTED, RUNTIME-UNVERIFIED, RUNTIME-VERIFIED, DEFERRED and UNRESOLVED with [rentlease-test-runtime-verification](../rentlease-test-runtime-verification/SKILL.md)'s definitions. Label preview/legacy behavior explicitly when relevant.

MUST NOT claim runtime success, security validation, Admin integration, finalized policy or feature completion without matching evidence. User runtime results and agent observations must remain distinguishable.

When docs conflict with current source, generated `src/shared/services/supabase/database.types.ts` or current backend schema, investigate. Use executable source for existing frontend behavior, generated/current schema for structure and confirmed backend documentation for security/business rules. Historical reports cannot override these. Correct stale documentation; do not change working code merely to match a stale report. If current schema and generated types disagree, record drift rather than inventing a contract; use [rentlease-supabase-contract-guard](../rentlease-supabase-contract-guard/SKILL.md).

Keep living docs concise: behavior, architecture, backend boundaries and limitations, not execution logs. Optional or requested phase/audit/investigation/handoff files MUST follow [rentlease-implementation-artifact-organizer](../rentlease-implementation-artifact-organizer/SKILL.md) under `docs/implementation-reports/<category>/`. Artifact-only cleanup must preserve living docs; disclose stale references rather than editing protected docs outside that cleanup's scope.

Report docs created/updated, stale statements corrected, accurate docs deliberately unchanged and remaining evidence gaps. Never delete/move living context into historical reports.
