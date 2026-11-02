# Role system revamp backend ledger

## ROLE-001 — November 2, 2026: contract export and local migration preparation

- Actor: Codex; Supabase MCP `execute_sql` for live read-only catalog export;
  Docker/psql/Python for synthetic local tests. Authorized by Task 1; no live writes.
- Live project: `cxfsbwbwmwmgtqfonqth`. Classification: READ_ONLY_INSPECTION.
- Read scope: `pg_proc`/`pg_namespace` function definitions for the audited property,
  listing, GPS, verification, membership and ownership helpers; `pg_policies` for
  public/storage policies; `pg_attribute`/`pg_class`/`pg_attrdef` for relevant table
  column contracts; `pg_type`/`pg_enum` for enum labels. Output subset is retained in
  `supabase/test-support/unified_account_baseline.json`, without production records.
- Purpose: prepare exact authorization-only replacements from the completed audit;
  do not repeat the audit or rely on stale historical schema migrations.
- Result: source/policy preconditions and exact post-rewrite fingerprints generated
  in `supabase/migrations/20261102100003_unified_account_authorization.sql`.
- Durable live effect: none. No permanent live backend mutation was performed in this phase.
- Local classification: SCHEMA_CHANGE, FUNCTION_CHANGE, RLS_CHANGE, PRIVILEGE_CHANGE,
  TEST_DATA_MUTATION, ROLLBACK_TEST. Targets/payloads are the forward/inverse SQL,
  `run_property_identity.py` and `run_unified_account.py`; synthetic local data only.
- Local environment: owned disposable `rentlease-identity-test-role-revamp` container,
  Supabase PostgreSQL 17 image, no ports or volumes; `identity_milestone4` database.
- Security evidence: role-free/legacy users, owner/non-owner, Admin escalation,
  private evidence and exact-property publication tests. Storage rows model RLS;
  no Storage HTTP uploads, real documents or production test users were used.
- Android/client runtime: not performed; RUNTIME-UNVERIFIED. Live deployment pending.
- Final local result: `run_property_identity.py` 50/50 before cutover;
  `run_unified_account.py` 82/82 after cutover, zero failures. Original role-free
  GPS denial reproduced before migration. Inverse/reapplication and late-drift
  transaction rollback passed. No production queries were used as mutation tests.
- Forward migration SHA-256:
  `f12ee97f1c3d18883b9de74341fdb99be282d4704845cfe29808d8af59f69213`.
- Cleanup: disposable container stopped with `--rm`; synthetic database and the
  separately cloned drift-test database discarded. No live cleanup required.
- Skills actually read in this conversation: using-superpowers, brainstorming,
  test-driven-development, systematic-debugging, verification-before-completion,
  supabase:supabase; repository feature-implementation, frontend-mvvm-guard,
  supabase-contract-guard, security-review, test-runtime-verification,
  documentation-maintainer, implementation-ledger, implementation-artifact-organizer
  and ui-ux-design. User authorization overrides the skills' default backend boundary.

Links: [feature](../../features/ROLE_SYSTEM_REVAMP.md),
[implementation history](../phases/ROLE_SYSTEM_REVAMP_IMPLEMENTATION.md).

## ROLE-002 — November 2, 2026: authorized backend deployment

- Actor: Codex via Supabase get_project/list_migrations/execute_sql/apply_migration;
  local linked CLI/Docker pg_dump. Project `cxfsbwbwmwmgtqfonqth`, RentLease,
  ACTIVE_HEALTHY, PostgreSQL 17.6.1.155. Authorization: explicit user request to
  back up and deploy only the Task 1 migration. No earlier SQL replay/history repair.
- READ_ONLY_INSPECTION: linked project-ref and connected project match; 19 prior
  history entries and no role-revamp entry; approved local SHA-256 matches;
  all 13 normalized old function fingerprints and six exact policy predicates match.
  Baseline preservation SELECTs hash rows without logging private values across
  marketplace, verification, role, identity tables, protected policies and functions.
- Backup: new `C:/RentLease-Backups/role-revamp-predeploy-20261102-182126`.
  Commands: `supabase db dump --linked --file <dir>/schema.sql`;
  `supabase db dump --linked --data-only --use-copy --file <dir>/data.sql`;
  `supabase db dump --linked --role-only --file <dir>/roles.sql`.
  All exit 0; files nonempty with expected schema/data/role SQL markers.
  Schema: 257579 bytes, SHA-256 `a9c886b2f84f1698300c21458bfc8ec0fc07f6d3d0bcbd9402dcaa1dab812bab`.
  Data: 111330 bytes, SHA-256 `6eae05fec8687f6b1926febf5495b4dff24c229fde3b09ea899f3e70528c0ec7`.
  Roles: 358 bytes, SHA-256 `4350a72b5ec109888e740c17f3eb4da2fcd95ab73af26499538ed0bf615db543`.
  No restore test or Storage-file backup. Data dump warns about circular FKs among
  verification_submissions/corrections and messages; restore may require trigger or
  constraint handling. Existing acknowledged manual-dump/managed-schema limits remain.
- Mutation classification: SCHEMA_CHANGE / FUNCTION_CHANGE / RLS_CHANGE /
  PRIVILEGE_CHANGE. Exact action: apply_migration(name=`unified_account_authorization`,
  project_id=`cxfsbwbwmwmgtqfonqth`, query=the entire reviewed source file).
  Result `{success:true}`; actual history `20261102102331`, one stored SQL entry.
  Remote stored SQL SHA-256 exactly matches approved/local bytes:
  `f12ee97f1c3d18883b9de74341fdb99be282d4704845cfe29808d8af59f69213`.
- Source reconciliation: preparation file `20261102100003_unified_account_authorization.sql`
  renamed to `supabase/migrations/20261102102331_unified_account_authorization.sql`;
  content/hash unchanged. Test/generator use the suffix glob and need no code changes.
- Permanent effects: 13 reviewed authorization-only function rewrites; six policy
  WITH CHECK changes; nullable presentation-only preference/check/comment, legacy
  preference backfill and column-level authenticated UPDATE grant. Legacy role rows,
  `set_user_roles`, Admin helpers/ACLs, private evidence policies and identity
  transitions remain unchanged. This phase DID perform the authorized live mutation.
- Postchecks: all 13 expected new source hashes match; all six policy membership
  gates removed; 20 before/after fingerprints match (12 marketplace/verification/role
  tables, profiles excluding expected preference/updated_at, four private identity
  tables, protected policies, 69 unchanged functions and 13 function privilege sets).
  Preference invalid/mismatch counts both zero; preference UPDATE allowed while
  account status/Tier 1 UPDATE and direct role INSERT remain denied; private bucket
  remains private; anonymous GPS/creation EXECUTE remains denied.
- RPC_TEST / READ_ONLY_INSPECTION: executed the exact transaction retained in
  `supabase/tests/verify_unified_account_deployment.sql` with existing actors and
  SET LOCAL authenticated/JWT identity. Owner status matches exact-property binding;
  unrelated owner-status access raises 42501; ordinary actor is not Admin;
  `set_user_roles(array['admin'])` raises 22023 before any write; legacy landlord-only
  active Tier 1 GPS read succeeds. Transaction was READ ONLY and committed no writes.
- Role-free live Tier 1 actor count is zero. No production users/roles were created
  or changed for tests; role-free behavior is local-test plus deployed-source evidence.
  Publication/proof writes were not exercised live. No live cleanup is needed.
- Recovery: inverse SQL prepared/tested locally, not executed live; coordinate client
  rollback before restoring normal-role gates. Existing Android RPC signatures and
  legacy roles remain compatible; no mandatory client cutover for this additive change.
- Android/client runtime: not tested; frontend integration and generated-type update
  deferred to the next authorized task. No full suites, commit, push, merge or build.

## ROLE-003 — November 2, 2026: frontend Tasks 2+3

- Actor/tool: Codex, Supabase `generate_typescript_types` read-only against
  `cxfsbwbwmwmgtqfonqth`; local TypeScript/Node tests. Classification:
  READ_ONLY_INSPECTION. Authorization: implement the unified frontend against the
  deployed contract; no migration or live data change authorized or performed.
- Result: generated `profiles.experience_preference` Row/Insert/Update entries
  integrated into the canonical types; unrelated generated definitions preserved.
  Account service reads and writes this safe field through the existing own-profile
  path. No `set_user_roles` call remains in normal onboarding or navigation.
- Contract: active Tier 1 for property/Tier 3 entry; existing explicit property
  ownership filters and versioned proof RPCs preserved. Backend authorization remains
  deployed version `20261102102331`. No schema, RLS, Admin, evidence or identity
  correction change. Preview contexts are presentation-only and not permissions.
- Local evidence: 287 targeted frontend tests passed with zero failures/skips;
  separate review fixes verified. These use synthetic/model/hook/client fixtures,
  not production property creation or document operations. No backend suite rerun.
- Durable live effects/cleanup: none; no live test records or objects to clean up.
  No permanent live backend mutation was performed in this phase.
- Runtime: Android and live role-free write acceptance remain unverified; see the
  implementation history's short Android checklist. All changes remain uncommitted.
- Skills applied/read: previously loaded RentLease feature/MVVM/UI/security/contract/
  verification/documentation/ledger/artifact skills and Supabase skill; targeted
  regression-first validation and requesting-code-review skill (scoped reviewer,
  both concrete findings fixed and rechecked). No deployment authorization inferred.
