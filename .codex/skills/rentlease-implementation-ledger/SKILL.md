---
name: rentlease-implementation-ledger
description: Maintain a durable RENTLEASE backend interaction ledger for live Supabase inspections, SQL, RPC or Storage tests and mutations, rollback tests, and externally performed backend changes on which frontend work depends.
---

# RENTLEASE implementation ledger

## Trigger and authorization boundary

MUST read this skill before live Supabase work or integrating an externally performed backend change. It applies to live read-only inspection, SQL execution, RPC tests, privileges, schema, RLS, functions/triggers, Storage configuration/policies, test-data creation/modification and rollback-based backend tests.

This is a recording obligation, not authorization. This frontend repository must not independently redesign or administer Supabase. If a mutation lacks explicit authorization, stop that mutation, document the required change and continue independent frontend work where possible. Attribute externally performed work to its actual operator, never Codex. Do not execute historical operations merely to backfill evidence.

## Durable location

Every task touching live Supabase MUST update the feature's one continuously maintained ledger under `docs/implementation-reports/database/<FEATURE_NAME>_BACKEND_LEDGER.md`; create it only if absent. Current Property & Listing work uses `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`. Append dated phase/action sections; never create a fresh ledger per phase. Apply the [artifact organizer](../rentlease-implementation-artifact-organizer/SKILL.md). Ledgers are retained audit evidence; preserve earlier entries and identify dated corrections/superseding evidence.

## One continuously maintained record set per feature

MUST maintain one living feature document, one continuously updated implementation history/roadmap and one continuously updated backend ledger per feature. Reuse existing feature-scoped files; create a missing file once, not one file per phase. New phases become dated sections inside those files. Do not create separate Phase 3/4/5 implementation reports or backend-ledger files.

For every future Property & Listing phase update:

- `docs/features/PROPERTY_LISTING_MANAGEMENT.md`
- `docs/implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md`
- `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`

Keep backend actions in the ledger; if no new interaction occurred, record that honestly rather than implying a live check. Separate reports are appropriate only for genuinely separate audits/investigations explicitly requiring their own artifact. Preserve existing historical reports; do not rename or discard them without a separate request.


Record read-only calls too. Related reads may be grouped only when actor, environment, scope and result stay traceable. Record each mutation/live test distinctly. Distinguish execution and recording dates. Mark unavailable original dates, transcripts, arguments or receipts explicitly; never invent SQL/payloads/tests.

## Required action entry

Every entry MUST contain:

| Field | Required content |
| --- | --- |
| Date | Execution date/time if known; recording date and uncertainty for backfills |
| Feature/phase | Feature-scoped phase and stable entry ID |
| Actor/tool | Codex/tool or external operator/tool; distinguish user-reported evidence |
| Environment/project | Local/staging/live and project name/reference without secrets |
| Classification | One or more classifications below |
| Target | Exact table/function/policy/grant/bucket/object scope |
| Action | Exact SQL, RPC name/arguments or Storage action for mutations/live tests; query/tool and scope for reads |
| Purpose | Why needed and applicable authorization |
| Result | Observed/reported outcome, errors and evidence provenance |
| Durable effect | Persistent schema/privilege/data/Storage effect, or none |
| Rollback/cleanup | Committed/rolled back/cleaned/incomplete/unknown and remaining rows/objects |
| Security/RLS | Role/owner and denied-case evidence where relevant, or not tested |
| Source-controlled backend file | Existing migration/source path, or absent/not supplied/not found; do not create one to imply provenance |
| Android/client runtime | Actual device/client verification and revision, or RUNTIME-UNVERIFIED/not performed |

Classifications: `READ_ONLY_INSPECTION`, `RPC_TEST`, `TEST_DATA_MUTATION`, `PRIVILEGE_CHANGE`, `SCHEMA_CHANGE`, `RLS_CHANGE`, `FUNCTION_CHANGE`, `STORAGE_CHANGE`, `ROLLBACK_TEST`, `EXTERNAL_BACKEND_CHANGE`. Combine where appropriate. An RPC test can leave durable data; a rollback test can leave none. A permanent grant is not a rolled-back data test.

## Permanent effects and safe evidence

Record every permanent live mutation, including `GRANT`, `ALTER`, `CREATE`, `DROP`, `UPDATE`, `DELETE` and `INSERT`, exact authorized statement/action, attribution and durable effect. If none occurred, the phase section in the existing implementation history MUST state: `No permanent live backend mutation was performed in this phase.` Scope that statement honestly; external permanent changes belonging to the phase must still be recorded even when Codex made none.

Never store access tokens, passwords, JWTs, secret keys, service-role credentials or other secrets. Prefer Owner Test User / Unrelated Test User labels over user UUIDs; include UUIDs only when technically necessary to reproduce an authorized test or identify outstanding cleanup. Redact secrets from transcripts and label redactions. Mark missing non-secret arguments unavailable instead of guessing them. SQL identity simulation/rollback tests do not establish Android/client runtime success.

## Completion gate

Update both ledger and [living feature documentation](../rentlease-documentation-maintainer/SKILL.md), linking the living feature document, continuously updated implementation history and backend ledger. Distinguish structural contract, security/business assertions, observed evidence and external reports. Include outstanding cleanup and evidence gaps. A backend-integrated phase is incomplete with a stale ledger or feature document. Final reports must list skills actually read, evidence paths, permanent SQL/effects or the no-mutation statement, and truthful runtime status. Do not commit or push automatically.
