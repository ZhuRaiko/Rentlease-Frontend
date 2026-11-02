# Unified account authorization

November 2, 2026: backend authorization deployed to `cxfsbwbwmwmgtqfonqth` as
`20261102102331_unified_account_authorization`. Frontend Tasks 2+3 are implemented
and targeted-test verified in the uncommitted working tree; Android remains
RUNTIME-UNVERIFIED. Live backend read-only checks passed;
role-free writes remain locally tested rather than exercised on production.

- Target: active Tier 1 for marketplace operations; actual ownership and listing
  participation for private operations; exact-property evidence for publication.
- Keep Admin membership, legacy normal-role rows and `set_user_roles` unchanged.
- Optional `profiles.experience_preference` accepts `rent`, `list`, `both`, or null;
  it has no authorization effect. Existing normal memberships seed presentation only.
- Authorization-only changes to the shared owner gate, identity status batch read,
  and submitting-owner review condition preserve correction transitions, immutable
  revisions, evidence binding, historical approval and repair exclusions.
- No frontend changes, generated-type regeneration, new tenant features or deployments
  belong to Task 1. Keep the bottom Post entry during the subsequent frontend work.

Frontend Tasks 2+3 remove role selection and normal-role navigation/service gates.
All active eligible Tier 1 users can discover, open My Listings, and start the
existing composer through Post. Ownership remains server-enforced. The empty
portfolio directs users to the bottom Post entry; it creates no duplicate composer.
Tier 3 selection and proof stay scoped to an owned property. Profile summarizes
Tier 3 as checked per property, never an account-wide publication credential.

Optional Edit Profile choices persist `experience_preference` with the existing
profile save; list starts at Listings, while rent/both/unset start at Discover.
The preference never changes roles, permissions or existing preview actors. Save
is disabled for unchanged/reverted/invalid/busy drafts. Existing Back/account
cleanup and Admin precedence remain intact. Tenancy/Chat previews are unchanged.

Evidence and rollout limits: [implementation history](../implementation-reports/phases/ROLE_SYSTEM_REVAMP_IMPLEMENTATION.md)
and [backend ledger](../implementation-reports/database/ROLE_SYSTEM_REVAMP_BACKEND_LEDGER.md).
Local PostgreSQL/Storage metadata tests do not establish live HTTP or Android acceptance.
No existing live Tier 1 account lacked normal role memberships at deployment, so
role-free eligibility was confirmed through deployed fingerprints and local tests.
