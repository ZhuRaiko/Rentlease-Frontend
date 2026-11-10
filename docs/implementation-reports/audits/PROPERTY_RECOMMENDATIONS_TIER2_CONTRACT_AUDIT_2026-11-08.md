# Recommendation owner Tier 2 contract audit

November 8, 2026. Read-only investigation of project cxfsbwbwmwmgtqfonqth after recommendation checkpoint `6d716d13c2c93537b331e29a2e91d87ddd0b4f8d`, pushed and remote SHA verified. No new contract was implemented or deployed.

## Existing contracts

- `tierTwoVerificationService.ts` reads the caller's submissions, including private review fields and document references. It is not a public owner-status service. The account service reads the caller's own profile.
- `verification_submissions` SELECT is submission-owner or Admin only. Verification documents remain owner/Admin scoped. Profiles are self-readable. RLS is enabled on profiles, submissions, documents, listings and properties.
- `get_public_identities(uuid[])` returns authorized consented nickname/avatar fields only. The sanitized `public_profiles` view exposes no Tier 2 status. No public `is_tier2_verified` contract was found.
- The private reservation projection includes applicant Tier 2 information in its existing participant workflow. This is the reservation applicant, not a general listing-owner discovery signal; do not repurpose that workflow or widen its authorization.
- Recommendation production candidates correctly retain unknown verification and receive no Tier 2 bonus. A new narrow read contract is genuinely needed for the requested boost.

## Authoritative status and revocation

`refresh_profile_verification_timestamps()` runs after submission insert/update/delete. It sets `profiles.tier2_verified_at` to the maximum reviewed_at among that user's currently approved `tier_2_identity` submissions. It does not use the latest submission regardless of status. The partial unique index normally permits at most one pending/under-review/approved Tier 2 submission per user. Authenticated callers cannot directly update the protected profile timestamp.

The Admin-only review RPC permits pending -> under_review -> approved/rejected, and checks document existence before Tier 2 approval. Finalized submissions cannot be revoked through that normal review RPC. An authorized backend status change to revoked is reflected by the refresh trigger; removing the last approved row clears the cached timestamp. Do not invent a public revocation operation or change this workflow.

There is no Tier 2 expiration column or automatic expiry rule. The status enum includes revoked, but not expired. Do not infer expiration from document contents, elapsed time, or a suspension end date. Active eligibility follows the existing `is_tier1_verified` helper: nonnull Tier 1 timestamp and account_status=active. Historical approval must not depend on the reviewer still being an Admin today. Tier 3 property approval is separate and never supplies this boost.

## Proposed contract (design only)

`public.get_recommendation_owner_verification(p_listing_ids uuid[])` returns only `listing_id`, `listing_owner_id`, and nullable `owner_tier2_verified`.

1. Require authenticated active Tier 1 caller, without Tenant/Landlord membership. Reject null/empty batches, null elements and more than 50 supplied IDs before deduplication. No arbitrary user-ID argument.
2. Resolve owners server-side from listings joined to physical properties. Require matching owner IDs, active property, active published listing, reached availability date using Asia/Manila, and existing caller visibility authorization. The current listing RLS is broader than discovery eligibility; explicitly enforce all public discovery conditions. No owner/Admin/tenancy exception for private drafts or archived listings.
3. Omit nonexistent, inaccessible and ineligible listing IDs identically. Do not expose why a listing was omitted. Return the owner ID already present in the authorized listing solely to bind the signal to the exact owner and reject ownership-change races during client merging.
4. Return true only for the actual owner's active Tier 1 account with an approved Tier 2 row, null property_id, nonnull trusted review metadata and a matching refreshed profile timestamp. Verify against the current approved-row aggregation, not latest-submission order. A missing reviewer or inconsistent cache/provenance is unknown, not verified. No approval returns false when the cache is also empty; inconsistency returns null. Inactive owners receive no boost. No pending/rejected/revoked reason, submission ID, legal name, document, reviewer, or history leaves the function.
5. A narrow STABLE SECURITY DEFINER projection is necessary to inspect protected status. Use empty search_path, fully qualified references, fixed SQL, explicit caller/visibility gates before private reads, revoked PUBLIC/anon EXECUTE, and authenticated-only EXECUTE. SECURITY DEFINER does not automatically preserve caller RLS: tests must prove equivalent or stricter public visibility. Do not grant table SELECT or weaken existing policies. Guard reviewed helper/policy baselines during migration preparation.
6. Preserve the 80/10/10 weights. Map true to the existing authoritative owner signal; false/null/omitted/error earns no verification bonus and does not exclude otherwise eligible candidates. Batch at most two calls for the 100-candidate pool. Merge only requested IDs with identical candidate/listing/property ownership. Keep account-generation cancellation and avoid persistent verification caching. Results are a read snapshot; refresh must reflect subsequent revocation. No invented expiresAt value or automatic expiry policy.

## Next implementation scope

Separate authorization is required to prepare/implement this contract. Proposed new files:

- `supabase/migrations/<new_timestamp>_recommendation_owner_tier2_status.sql` (actual timestamp assigned when prepared).
- `supabase/test-support/recommendation_owner_tier2_status_rollback.sql`.
- `supabase/tests/recommendation_owner_tier2_status_contract.sql` and a focused local runner following existing disposable PostgreSQL conventions.

Update `src/shared/services/supabase/database.types.ts` from the confirmed signature, `src/features/property-recommendations/services/recommendationService.ts`, and `tests/contentRecommendations.test.ts`. Existing scoring model and weights need no redesign. Update the existing feature/history/ledger. No ML proxy changes.

Required tests: anonymous/inactive/non-Tier1 denial; legacy and role-free callers; bounded/malformed batches; inaccessible and nonexistent equivalence; active/published/availability/property eligibility; owner mismatch/reassignment; approved/revoked/pending/rejected and inconsistent cache; historical review provenance; Tier 3 separation; zero private output; unchanged RLS/grants; batch failures, account changes and stale responses. Deployment remains a separate authorized step.

## Evidence and limitations

Catalog-only SELECT inspection covered function definitions, policies, columns, constraints, indexes, triggers and privileges. No personal rows, documents or production test records were read/created; no status RPC was executed for a user. One malformed catalog SELECT was corrected; multi-statement output was consolidated into a single JSON query because only the final result is returned. This is contract evidence, not hosted end-to-end acceptance.

Checkpoint validation: 161 focused tests, TypeScript, whitespace and staged credential/artifact scan passed; 18 files committed. Physical Android preference editing, recommendation/details/Back, filtered sorts, refresh/empty/error states, account switching and GPS regressions remain pending. Audit documentation is intentionally outside the already-pushed implementation checkpoint.
