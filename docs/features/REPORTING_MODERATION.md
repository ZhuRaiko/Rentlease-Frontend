# Reporting and Admin moderation

## Status - November 11, 2026

IMPLEMENTED LOCALLY / focused frontend AUTOMATED-TESTED / RUNTIME-UNVERIFIED on `feature/reporting-moderation`. Backend migration is PREPARED, NOT DEPLOYED. No production report was created or moderated.

## Behavior and integration

Real Rental Details offers Report this listing. An actual messaging conversation offers Report participant; the server derives the counterpart rather than trusting a user ID. Reasons and optional explanation require explicit submission. Ratings & Reports opens My submitted reports with persistent statuses, paging and safe resolution summaries. Reports are confidential: the target cannot read them merely because they are reported.

Admin Dashboard and queue use real counts and listing/user/status filters. Independent active Tier 1 Admins can inspect context, begin review, dismiss, or resolve a substantiated report. A private decision note is required; an optional separately labeled public-safe summary is visible to the reporter. No report action changes publication, accounts, verification or tenancy. Reporter, target, captured parties, current property owner and actual property tenancy participants cannot moderate their own related cases. Existing review moderation remains separate.

## Architecture and recovery

Shared `Reporting.ts` models, `reportingService.ts`, `reportingWorkflow.ts`, `useReporting.ts` and `Reporting.tsx` own the reusable flow. Views call workflows, not Supabase. Actual account checks surround transport; account/source keys, aborts, generation guards and bounded timeouts prevent stale publication. Saving blocks duplicate submissions and Back. Uncertain outcomes retain the exact operation for explicit retry; definitive rejections reload authoritative state. Moderation receipts acknowledge the original operation separately from the current case, allowing reconciliation after another Admin advances it.

The account/source-scoped AsyncStorage journal temporarily contains report text or private Admin notes. It is app-private storage, not an encrypted vault; no encryption guarantee, credentials or automatic offline retry is added. Keep app data until uncertain actions reconcile. Pagination is 20 rows with maximum offset 10,000; Admin history is the latest 20 immutable events.

## Prepared backend

`supabase/migrations/20261110171913_reporting_moderation.sql` reuses `public.reports`. Private `rentlease_reporting` tables retain immutable context, decision events and exact-operation receipts. One open report per reporter/kind/target is enforced. Four authenticated-only SECURITY DEFINER RPCs use `pg_catalog` search paths: `get_rental_report`, `get_rental_reports`, `submit_rental_report`, `moderate_rental_report`. Active Tier 1 identity, listing availability, conversation participants, Admin independence, revision and state transitions are enforced server-side. No direct client table writes or private identity/document/location projection is added. Restrictive raw-table RLS is additive. Existing report sources and audit evidence cannot be rewritten or deleted.

The migration stops on nonempty legacy reports, missing RLS or unexpected client grants. Before release, separately authorize fresh preflight/recovery backup and only this migration; compare actual signatures, grants and guards. Do not blanket-push historical migrations. `supabase/test-support/reporting_moderation_rollback.sql` withdraws only RPC access and retains evidence; hosted rollback/restore is untested.

## Validation and remaining scope

65 focused reporting/search/review cases pass; TypeScript and whitespace results are recorded in the history. Final isolated SQL validation passed 32 checks, including competing independent Admin decisions, later-decision receipt reconciliation, authorization, confidentiality, immutable evidence and data-retaining withdrawal. The network-isolated disposable container was removed. Hosted caller-JWT authorization and native acceptance remain unverified. No attachments, individual-message reports, appeals, reopening, escalation, notifications or automatic enforcement are implemented. Other legacy Admin enforcement/audit screens remain preview.

Manual Android acceptance after backend rollout: report an eligible listing and an actual conversation counterpart; reopen My reports; verify duplicate/foreign/ineligible denial; use an unrelated Admin to begin review and resolve/dismiss; verify targets and involved Admins cannot inspect/moderate; interrupt a submission/decision and retry the same operation; switch accounts and navigate Back without stale data. Confirm resolution leaves the listing/account unchanged and T7 review moderation still works.

[Implementation history](../implementation-reports/phases/REPORTING_MODERATION_IMPLEMENTATION.md) ? [Backend ledger](../implementation-reports/database/REPORTING_MODERATION_BACKEND_LEDGER.md)
