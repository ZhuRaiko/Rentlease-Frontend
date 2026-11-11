# Reporting and moderation backend ledger

## November 11, 2026 - read-only compatibility inspection and local preparation

Project: cxfsbwbwmwmgtqfonqth. Authorized task: inspect reporting contracts and prepare local implementation; deployment not authorized.

Metadata-only SQL inspected public.reports columns/defaults/types, constraints/FKs, table grants, RLS policies, triggers/set_updated_at definition, existing report RPC inventory and is_admin signature/delegation; also listing/conversation column metadata and report reason/status enums. Aggregate report count was zero. No report contents, profile rows, message bodies, private coordinates or secrets were retrieved. Exact tool SQL transcript is not retained in this ledger; this entry records the inspected scope and results rather than inventing a replay transcript.

Observed: reports source targets profiles/listings/messages with at-least-one-target CHECK, existing reporter/Admin policies and only updated_at trigger. Table grants were postgres-only; no executable client report RPC was found. is_admin delegates to actual app-role membership. Prepared migration preserves source schema, adds private context/events/receipts and authenticated-only guarded RPCs, plus restrictive raw-table policy and immutable evidence guards. Generated types describe the prepared contract, not deployed availability.

Local network-isolated synthetic PostgreSQL checks previously passed 29 cases. Final updated runner includes a 30th check for retry after a later decision, but final execution is blocked because Docker Desktop Linux engine is stopped. No final container was created. Rollback guidance is data-retaining entry-point withdrawal only; no hosted rollback was executed.

No permanent live backend mutation was performed in this phase. No hosted report RPC or write-based smoke test was executed. No outstanding production cleanup. Fresh metadata/zero-legacy/grant checks and restricted recovery backup plus separate migration authorization are required before deployment. Actual end-user/Admin caller-JWT and Android acceptance remain unverified.

[Living feature](../../features/REPORTING_MODERATION.md) ? [Implementation](../phases/REPORTING_MODERATION_IMPLEMENTATION.md)


## November 11, 2026 - final validation and source checkpoint

Docker Desktop was running when checked with local engine access. Executed python supabase/tests/run_reporting_moderation.py in a disposable network-disabled PostgreSQL container with synthetic fixtures, no mounted production data or published ports. All 32 checks passed, including two independent Admins racing the same revision (exactly one succeeds, loser writes no receipt/event), exact retry after later resolution, confidentiality, privilege denial, source/history immutability and data-retaining RPC withdrawal. Container removal confirmed. This supersedes the earlier Docker availability blocker. No application or migration corrections were necessary in this pass; only concurrency coverage and evidence documentation were added. Reused prior 65 focused frontend and TypeScript results; no repeated frontend run. Hosted and native acceptance remain unverified. No permanent live backend mutation was performed in this phase.
