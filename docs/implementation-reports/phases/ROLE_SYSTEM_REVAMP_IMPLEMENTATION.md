# Role system revamp implementation

## Task 1 — November 2, 2026

Prepared `supabase/migrations/20261102102331_unified_account_authorization.sql`
(filename reconciled after deployment from preparation version `20261102100003`) and
the coordinated inverse under `supabase/test-support/unified_account_rollback.sql`.
Both are transactional; forward/inverse function-body fingerprints abort on drift.
The inverse restores membership gates and revokes preference updates while retaining
the nullable preference column and values. Reapplication preserves chosen preferences.

The baseline contract snapshot contains inspected definitions, policies and column
metadata only, not production records. The disposable fixture uses real role/profile
lookup functions rather than the older test-role shortcuts. It remains a partial
schema, with modeled Auth claims and Storage rows/path handling, not Supabase HTTP.

No permanent live backend mutation was performed in this phase.
Validation: 50 existing PostgreSQL identity checks passed before the authorization
cutover; 82 focused authorization checks passed after it, including private evidence,
cross-property approval denial, immutable helper/policy fingerprints, rollback,
reapplication and atomic abort on late source drift. Zero failed in the final runs.
The original role-free GPS denial was reproduced before migration. Python compile
and `git diff --check` passed. No frontend suite or Android test was run.
Deployment requires separate authorization and the established backup/cutover workflow.
Old clients retain their frontend membership gates. Roll back clients before restoring
backend membership gates; role-free owners otherwise lose access. Regenerate client
types when the backend contract is deployed; no frontend contract was falsely marked live.

See [living feature](../../features/ROLE_SYSTEM_REVAMP.md), [ledger](../database/ROLE_SYSTEM_REVAMP_BACKEND_LEDGER.md)
and `supabase/test-support/README.md` for scoped tests and invocation.

## Backend deployment — November 2, 2026

Separately authorized deployment succeeded at remote version `20261102102331`.
Remote stored SQL and reconciled local file both match the approved SHA-256
`f12ee97f1c3d18883b9de74341fdb99be282d4704845cfe29808d8af59f69213`.
Only this migration was applied; previous history entries were preserved.

Fresh schema/data/roles dumps are at
`C:/RentLease-Backups/role-revamp-predeploy-20261102-182126`.
Read-only postchecks: 13 expected function fingerprints, six policy role-gate
removals, 20 record/security preservation fingerprints, preference backfill and
column privileges, owner read/non-owner denial, Admin self-assignment rejection,
and a legacy landlord-only GPS read all passed. Executable smoke SQL is
`supabase/tests/verify_unified_account_deployment.sql`.

No production role-free Tier 1 actor exists; that case retains local test and
deployed-source evidence. No live test records, property mutations or document
uploads were performed. Frontend gates/types and Android acceptance remain pending.
The dumps are not restore-tested and contain no Storage file bytes; circular-FK
restore handling and CLI managed-schema exclusions remain explicit limitations.

## Frontend Tasks 2+3 — November 2, 2026

Unified root routing, onboarding, feature toolbar callbacks, property creation and
Tier 3 eligibility now depend on account eligibility rather than normal memberships.
The existing bottom Post/composer and owned portfolio remain the only creation/
management paths. Profile includes optional presentation preference and normalized
Save gating. Generated live `profiles` type changes only were integrated; Admin
memberships still load through the authoritative account snapshot.

Validation: 287 targeted tests passed, zero failures/skips/cancellations, across
unified-account, routing, marketplace wiring, Profile return, signup, auth corrections,
Tier 3 workflow/service, property creation, portfolio, Back, verification presentation,
GPS workflow/hook and account synchronization suites. Independent scoped review
found and confirmed fixes for legacy preview actor continuity and text encoding.
No PostgreSQL suite, full frontend suite, live write, migration or build was run.
No permanent live backend mutation was performed in this phase.

Android remains RUNTIME-UNVERIFIED: finish Tier 1 on a role-free account, skip the
optional matching introduction, check Discover/Listings empty state/Post, create
and reopen an owned property, and verify its own Tier 3 entry. Check legacy Tenant
posting, legacy Landlord GPS, unverified/Admin precedence, each saved display
preference on restart, Profile/Back/unsaved guards and account switching. Existing
Tenancy/Chat previews must remain labeled and behave as previews.
