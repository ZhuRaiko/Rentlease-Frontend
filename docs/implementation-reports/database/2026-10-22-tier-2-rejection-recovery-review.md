# Tier 2 rejection recovery: backend contract review

Date: 2026-10-22. Project: RentLease (`cxfsbwbwmwmgtqfonqth`). Status: READ-ONLY INSPECTED / RESUBMISSION DEFERRED. No migration, policy, RPC, Storage object, submission or review decision was changed. This is a recommendation for separate authorization, not an implemented backend contract.

## Decision

The database permits the primitive needed for a new application after rejection, but does not provide the desired duplicate-safe and interruption-safe recovery workflow. Do not enable frontend-only resubmission. Keep rejected rows and reasons intact. Current copy explains an app limitation, not an account restriction.

## Evidence and exact current structure

Inspected generated `database.types.ts`, the Tier 2 service/workflow, local migration `20261020134152_get_admin_verification_queue.sql`, live `pg_policies`, `pg_indexes`, `pg_constraint`, `pg_trigger`, `pg_proc`, column defaults, grants and bucket metadata. Catalog inspection was read-only and did not retrieve applicant rows or private file bytes. No live insert was used to prove acceptance; conclusions below are structural/policy evidence, not a runtime resubmission pass.

`verification_submissions.Insert` requires `user_id` and `tier`; generated optional fields include `id`, `property_id`, `status`, `submitted_note`, `reviewed_by`, `review_note`, `rejection_reason`, `submitted_at`, `reviewed_at`, `updated_at`. Live defaults: UUID id, pending status, now submitted_at/updated_at; property/review fields nullable. Authenticated INSERT privileges are column-scoped to `user_id,tier,property_id,submitted_note`; clients cannot insert their own review/status values. SELECT is granted; no ordinary UPDATE/DELETE grant was returned.

`verification_documents.Insert` requires `submission_id,document_type,storage_path`; generated optional `id,created_at,file_name,mime_type`. Live defaults: UUID id and now created_at. Authenticated INSERT privileges cover only `submission_id,document_type,storage_path,file_name,mime_type`. Both tables have RLS enabled. Generated Update shapes are structural, not permission to update.

Submission foreign keys: user_id -> profiles.id (CASCADE); reviewed_by -> profiles.id (SET NULL); property_id -> properties.id (SET NULL). Document submission_id -> verification_submissions.id (CASCADE). No parent/replacement application link, idempotency key or upload-readiness field exists.

## Current enforcement

- `verification_submissions_create_tier2_self` checks user_id = auth.uid(), is_tier1_verified(), tier = tier_2_identity, property_id IS NULL, status = pending, and reviewed_by/reviewed_at/review_note/rejection_reason all NULL. `is_tier1_verified()` requires a profile Tier 1 timestamp and active account. It does not check previous rejection, active duplicates or approved history.
- `verification_submissions_read_owner_admin`: own rows or is_admin(). `verification_submissions_admin_update`: is_admin() for USING/WITH CHECK. Ordinary column grants still exclude status/review writes.
- `verification_documents_create_owner`: parent belongs to auth.uid() and parent status is pending OR under_review. It does not freeze attachments once review starts, assert a Storage object belongs to that parent path, or enforce one attachment per application. Owner/Admin SELECT and Admin ALL policies also exist; table privileges remain a separate layer.
- Submission indexes: primary key(id), nonunique idx_verification_user_status(user_id,status,tier), nonunique idx_verification_admin_queue(status,submitted_at). Document index: primary key(id). No unique partial index prevents concurrent active Tier 2 applications, and no unique path/attachment constraint was found.
- `trg_validate_verification_submission` calls validate_verification_submission(): Tier 3 owner/landlord checks, otherwise property_id is nulled. No Tier 2 duplicate or resubmission restriction.
- `trg_refresh_profile_verification` derives profile timestamps from approved submissions' reviewed_at; updated_at has its existing trigger. No client should set verification timestamps or trust.
- `review_verification_submission` requires auth.uid() and is_admin(), locks the selected row, enforces pending -> under_review -> approved/rejected, requires a document for Tier 2 approval, and a nonblank rejection reason. Terminal rows cannot be reviewed again through this RPC. Rejected applications should remain terminal; a correction needs a new row.
- `get_admin_verification_queue` includes all pending/under_review rows, including an upload-incomplete pending row. It does not require finalized attachments.

## Storage and transaction gaps

Bucket `verification-documents` is private; live file_size_limit and allowed_mime_types are NULL. The current frontend preserves `<USER_ID>/<SUBMISSION_ID>/<UNIQUE_FILENAME>`, random unique names, ArrayBuffer upload and upsert:false.

`storage_verification_insert_owner` checks bucket and the first folder = auth.uid(), without checking the second folder's parent submission/status. `storage_verification_read_owner_admin` checks owner namespace or is_admin(). Despite its name, `storage_verification_delete_owner_pending` checks only owner namespace or is_admin(), not pending status. Thus its name is not evidence of terminal-document retention protection. This task adds no deletion or broader Storage permission.

Current frontend sequence: latest-row read -> insert pending row -> Storage upload -> metadata insert -> authoritative reload. It is not a cross-service transaction. Two clients can both observe no active row; an interrupted request can leave an incomplete pending row or uploaded object without confirmed metadata. Current latest-only read and any-existing-row guard intentionally block retries. They do not implement concurrency enforcement, repair or complete history presentation.

## Proposed separately authorized implementation

1. Preserve rejected rows, reasons, reviewer and timestamps. Create a new application, never reset/reuse a rejected row. If lineage is required, approve a nullable prior-submission FK; it is not needed merely to retain history and does not exist now.
2. Add a database unique partial index on `(user_id)` for `tier = 'tier_2_identity' AND status IN ('pending','under_review')`. Inspect and resolve existing duplicate active rows with an approved remediation plan before adding it; do not delete or auto-select records in this frontend task.
3. Introduce an authenticated begin/resume operation that derives identity, checks active Tier 1 and rejected-user eligibility, serializes concurrent creation and handles idempotency. Approve its exact RPC name/Args/return and any idempotency constraint before frontend integration. Do not grant direct client status/review writes. Any direct INSERT path must remain unable to bypass the active uniqueness constraint and readiness lifecycle.
4. Approve an explicit upload-readiness lifecycle field/contract separate from review status. A reserved pending row must not become reviewable until finalization verifies its expected private object and metadata. Update queue projection and review RPC checks together; approval's document-exists check alone is insufficient for a fully coordinated upload lifecycle.
5. Add idempotent finalize/repair operations with transaction-level identity/ownership/status checks, validated submission-specific Storage paths, exact document types and attachment uniqueness. Keep private access and 90-second on-demand Admin URLs. Restrict attachment changes and cleanup to approved incomplete states; freeze historical/reviewed proof appropriately. Harden the current owner-delete policy if terminal document retention is required.
6. Explicitly support resume of the SAME reserved incomplete application, re-query after uncertain responses, and use fresh non-overwriting object names. Define controlled cleanup/expiry for abandoned reservations/orphan objects. Database transactions cannot roll back completed Storage HTTP uploads; do not claim atomicity across both systems.
7. Only after backend approval/deployment, regenerate types and update the frontend to load active work separately from rejected history, show reasons, and invoke approved begin/resume/finalize APIs. Preserve existing approved records and Admin review semantics.

## Decisions needed before that backend implementation

Define eligibility when approved/cancelled/revoked history also exists; which proof/size/MIME limits apply; upload expiry and recovery authorization; whether finalized metadata is immutable during under_review; lineage/idempotency shape and retention/cleanup ownership. No new values or API signatures are treated as existing facts here.

## Required backend acceptance tests

Test simultaneous requests from two sessions -> one active row; new application after rejection with old reason/documents preserved; rejection by the server for wrong owner, restricted account and unauthorized status writes; uncertain begin/finalize and interrupted upload -> same recoverable reservation, no active duplicate; no review before finalization; protected historical documents; existing Tier 2 approval and Tier 3 flow unchanged. Use separately authorized test identities/records and migration review. This report authorizes no backend work.
