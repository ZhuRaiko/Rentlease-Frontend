# Reporting and moderation implementation history

## November 11, 2026 - local implementation

Reused public.reports, existing report enums, authenticated identity helpers, real listing/conversation contexts and existing Admin/ratings navigation. Added shared models, service, journal, workflow and guarded UI; connected listing and conversation report actions, reporter status pages and independent Admin queue/decisions. Removed fictional report counts and normal preview submission paths. Existing T7 review moderation and unrelated feature business logic are preserved.

Prepared one isolated migration and data-retaining rollback guidance. Focused review identified a lost-response retry bug after another Admin advanced the case. Corrected both RPC and client to distinguish immutable operation acknowledgement from current case status, retaining current Admin/conflict checks. Its regression failed before the fix and passed afterward.

Validation: 65 focused reporting/manual-search/review tests passed, zero failed/skipped. Final npm.cmd run typecheck, Python runner syntax and git diff --check passed. Earlier isolated PostgreSQL revision passed 29 checks; final updated SQL runner cannot start because Docker Desktop Linux engine is unavailable. No container was created in the final attempt. Final SQL validation remains required. No broad suite, native testing, deployment, staging, commit or push. Local configuration remains untouched.

No permanent live backend mutation was performed in this phase. Runtime and hosted positive/negative caller acceptance remain unverified. See the [living feature](../../features/REPORTING_MODERATION.md) and [backend ledger](../database/REPORTING_MODERATION_BACKEND_LEDGER.md).


## November 11, 2026 - final validation and source checkpoint

Docker Desktop was running when checked with local engine access. Executed python supabase/tests/run_reporting_moderation.py in a disposable network-disabled PostgreSQL container with synthetic fixtures, no mounted production data or published ports. All 32 checks passed, including two independent Admins racing the same revision (exactly one succeeds, loser writes no receipt/event), exact retry after later resolution, confidentiality, privilege denial, source/history immutability and data-retaining RPC withdrawal. Container removal confirmed. This supersedes the earlier Docker availability blocker. No application or migration corrections were necessary in this pass; only concurrency coverage and evidence documentation were added. Reused prior 65 focused frontend and TypeScript results; no repeated frontend run. Hosted and native acceptance remain unverified. No permanent live backend mutation was performed in this phase.
