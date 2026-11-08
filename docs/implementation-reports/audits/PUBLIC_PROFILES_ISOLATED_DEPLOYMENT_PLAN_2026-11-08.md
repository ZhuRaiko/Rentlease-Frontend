# Isolated public_profiles hardening deployment plan

## Current status - deployed; historical procedure below

Deployed once as **20261108071009_public_profiles_security_invoker**. Current source: `supabase/migrations/20261108071009_public_profiles_security_invoker.sql`. Do not execute this historical plan again. The original filename below identifies the reviewed commit, not another pending migration.

Reviewed LF SHA-256: `18f1ac665c9499df8e13a60feccdb272bde50154c5f8947be50c16696473874b`. Submitted CRLF SHA-256: `bb23a32ad4b318cbc09ca0520ecfc9352d16f7c587d2251186cb7f12ea66526f`. Exact content matches after newline normalization; the submission byte discrepancy remains explicitly recorded, not silently repaired. Protected deployment receipt and migration source parity were rechecked during Git reconciliation.

Postdeployment evidence: 27 history rows with prior 26 unchanged; only security_invoker=true changed; 89 hosted SQL checks passed across seven existing accounts; public_profiles advisor warning cleared. Tier 2 and ML remain untouched. End-user JWT/HTTP, avatar-image delivery and physical Android acceptance remain pending. No migration replay or rollback.

## Historical predeployment plan

November 8, 2026. **PLANNING / READ-ONLY VERIFIED. NOT AUTHORIZED TO DEPLOY.** Project `cxfsbwbwmwmgtqfonqth`, branch `fix/gps-nearby-results`, reviewed commit `7a9deebeb278a0dc081a1a6efa73ef050c9563f9`. Commands below are for a later separately authorized operation; none of the backup/deployment/rollback commands were executed in this planning task.

## Verified baseline and pending files

Read-only catalog query found 26 migration history rows, latest `20261107134047_public_identity_nicknames_avatars`. Public Identity, UC-08/Realtime and UC-09A/B are deployed. Neither `public_profiles_security_invoker` nor `recommendation_owner_tier2_status` is recorded; the recommendation RPC is absent. The linked CLI project reference matches the target. Migration and rollback working contents match the reviewed Git blobs after CRLF-to-LF normalization.

- Target LF SQL SHA-256: `18f1ac665c9499df8e13a60feccdb272bde50154c5f8947be50c16696473874b`.
- Rollback LF SHA-256: `41e18407ed620dd907458957ed77e964382fe94cd0e073e3955a64b07414f2df`.
- Current public_profiles owner: postgres; reloptions NULL; sanitized consented projection and can_read_public_identity gate match the migration guard. Profiles RLS enabled; SELECT own only. Anonymous view SELECT false; authenticated view/profiles SELECT true.
- Relevant postgres-owned SECURITY DEFINER source MD5s (CR removed): can_read_public_identity(uuid) `ce7a49ff8184972232e5d000cb2135cc`; get_public_identities(uuid[]) `ef1a0176b11b9fe926b121fe4a79d8b3`; get_messaging_inbox(integer,integer,uuid) `7afb4944cc4bde8d31337c618259f75f`. Fresh preflight must also compare full definitions/config/ACLs, not rely on body hashes alone.

Working-tree pending migrations are exactly:

1. `20261108041628_recommendation_owner_tier2_status.sql` - NOT part of this deployment; privacy review unresolved.
2. `20261108063943_public_profiles_security_invoker.sql` - sole proposed target.

UC-09 migrations are already recorded remotely as 20261106125046 and 20261106130211. Their local filename reconciliations are uncommitted; the reviewed Git checkout still has old 20261106114837/20261106121806 filenames instead. A checkout-based blanket push can therefore also encounter missing-history/duplicate UC-09 hazards. Preserve these edits; do not repair history, mark Tier 2 applied, rename unrelated files or deploy UC-09 again to make a push proceed.

## Preflight and restricted backup (later authorization required)

1. Recheck Git branch/source parity, target project health and current full history. Stop if target is already applied, source differs, ownership/options/projection/ACL/RLS/helper/RPC baseline changed, or other deployment activity is ongoing. Coordinate a short schema-deployment freeze. Do not weaken the SQL guard to make it pass.
2. Create a new restricted directory outside Git. Example PowerShell:

```powershell
$backupRoot = Join-Path 'C:\RentLease-Backups' ('public-profiles-invoker-predeploy-' + (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop
$backupOwner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $backupRoot /inheritance:r /grant:r "$($backupOwner):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F'
if ($LASTEXITCODE -ne 0) { throw 'Backup ACL failure' }
icacls $backupRoot
if ((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'cxfsbwbwmwmgtqfonqth') { throw 'Wrong linked project' }
supabase.cmd db dump --linked --schema public --file (Join-Path $backupRoot 'public-schema.sql')
if ($LASTEXITCODE -ne 0) { throw 'Schema backup failed' }
supabase.cmd db dump --linked --role-only --file (Join-Path $backupRoot 'roles.sql')
if ($LASTEXITCODE -ne 0) { throw 'Roles backup failed' }
```

CLI 2.109.1 help was checked. Backup authentication must use the established secure local CLI session/prompt; never print credentials, embed a DB password in these commands or save a connection URL in Git. Restrict access before writing any artifact. Confirm files exist/nonempty and CLI exits succeed; a command invocation alone is not backup verification.

3. Save metadata-only preflight artifacts in that directory: exact pg_get_viewdef, owner/reloptions, view/profiles relation and column ACLs, profile policies/RLS, full identity/helper/inbox definitions and owners/config/ACLs, view dependencies, Realtime publication configuration, and **complete** migration history rows including statements. Also save reviewed migration/rollback bytes and project/commit/tool versions. Use read-only catalog queries through the established connector, saving results locally without printing private contents. Capture pg_get_functiondef and explicit ACL catalogs even if the CLI dump omits owner/grant restoration statements.
4. Export the exact reviewed Git blob using binary-safe Python `subprocess.check_output(['git','show','7a9deebeb278a0dc081a1a6efa73ef050c9563f9:supabase/migrations/20261108063943_public_profiles_security_invoker.sql'])`; write those bytes as `reviewed-migration.sql` under backupRoot. Assert its SHA-256 equals the value above. Do the same for the rollback. Do not use PowerShell Out-File encoding conversion for deployment SQL.
5. Generate/recheck SHA-256 manifest for every artifact (excluding the manifest itself), and re-read backup ACLs. Recheck live baseline immediately after backup; stop on changes. Record backup path and verified manifest in the later deployment receipt.

**Recovery scope:** this is a schema/catalog/roles recovery set, not a production data backup. No application rows need to change for this ALTER VIEW; avoid unnecessary private profile/message dumps. The reviewed rollback restores the old option against the existing view. Catalog/schema files support manually reviewed reconstruction of the affected view/function/grant state if needed; public-schema SQL depends on matching Auth/Storage/extensions and is not a standalone disaster-recovery image. Roles dumps may contain sensitive role metadata and are not to be replayed wholesale. There are no Storage blob bytes, Auth sessions, production row snapshots, PITR guarantee or full-database recovery claim. Local rollback/reapplication was tested; restoring these future production dump artifacts has not been tested. If the team requires full disaster recovery, verify an independent managed backup/PITR or separately authorized complete backup first.

## Apply exactly one payload (later authorization only)

Use the connected Supabase `apply_migration` tool, whose current schema accepts project_id, name and one SQL query. This is the established mechanism used for earlier controlled deployments. It does not scan the repository migration directory.

```javascript
// payload is UTF-8 decoded from the checksum-verified reviewed-migration.sql bytes.
// No SQL replacement, concatenation, additional migration or history repair.
await tools.mcp__codex_apps__supabase_apply_migration({
  project_id: 'cxfsbwbwmwmgtqfonqth',
  name: 'public_profiles_security_invoker',
  query: payload
});
```

The exact payload contains BEGIN, baseline guard, ALTER VIEW public.public_profiles SET(security_invoker=true), COMMIT. Submit once. Do not run db push (including --include-all), migration up/repair, a SQL-editor apply without history recording, or a manual schema_migrations INSERT/UPDATE. Do not include Tier 2 SQL. If a response times out or is ambiguous, inspect history and view options read-only before doing anything; never blindly retry.

After success, record the actual tool-assigned remote version; do not assume 20261108063943 was retained. Verify exactly one additional history row named public_profiles_security_invoker and checksum-equivalent recorded statement payload. Require all 26 prior complete rows to match the preflight snapshots, and Tier 2 history/RPC still absent. Stop on a content/history discrepancy. If a version is reassigned, reconcile only this local filename to the returned version without changing SQL bytes. Leave Tier 2 and UC-09 files/history untouched. A later commit/push needs separate authorization. The still-pending older Tier 2 timestamp must never be falsely marked applied to silence future CLI ordering warnings.

## Hosted acceptance checklist

Run fresh read-only, repeatable-read checks against existing authorized accounts/relationships, with no signup, message, upload, viewing or reservation creation. Keep private names, IDs, bodies and tokens out of reports; aggregate PASS/FAIL only.

- View owner/projection/columns/grants unchanged; only security_invoker=true added. Profiles RLS/policies/grants, all helper/inbox/identity RPC definitions/config/ACLs, publication configuration and prior history unchanged.
- anon SELECT denied; ordinary authenticated direct view read returns at most its own active, sanitized row; foreign rows absent even for an otherwise authorized counterpart. Suspended/restricted identity behavior retains existing gates.
- get_public_identities returns the same existing consented nickname/avatar fields for permitted public-listing owners or real conversation counterparts; unrelated users omitted; anonymous RPC execution denied. No legal-name fallback, review fields or private metadata in output.
- get_messaging_inbox still returns only real participant conversations with the same existing sanitized participant projection. The postgres-owned RPC invokes the invoker view under its executing role; its own participant gate must remain intact. Nonparticipants remain excluded.
- Existing public avatar URL paths and sanctioned public image delivery remain unchanged (no upload required). Unconfirmed names/photos stay withheld. A public avatar URL is still public; this view option cannot revoke an already-known URL or clean orphan files.
- Refresh Security Advisor after its scan/cache completes: the public_profiles security-definer-view warning should disappear. Preserve unrelated findings; a cleared warning is not a complete security certification.
- Confirm read-only existing-record fingerprints/counts unchanged where captured without exposing record contents. Android two-account Profile/details/Chat identity and Back/photo fallback checks remain separately pending.

The existing read-only verify_public_identity_deployment.sql now handles either view mode, but also assumes legacy names/photos are unset for its original deployment scenario. Do not blindly run it after users have consented public identities; use the targeted checks above against actual consent state. Do not treat the legacy verifier as a general production acceptance script.

## Isolated rollback and stop conditions

If postflight compatibility fails, stop release and assess; do not widen RLS or profile SELECT to fix it. The reviewed rollback is `supabase/test-support/public_profiles_security_invoker_rollback.sql`, containing only BEGIN / ALTER VIEW public.public_profiles RESET(security_invoker) / COMMIT. It was tested with rollback/reapplication locally. It restores the prior owner-rights warning and broader gated direct-view behavior, not safer invoker behavior. It does not restore private data, fix unrelated defects, remove the view or alter RPCs/grants.

Rollback is NOT authorized by this plan. If later approved, apply its exact checksum-reviewed payload as a separate named compensating migration (for example public_profiles_security_invoker_revert) using apply_migration; record that new actual version. Retain the original security-fix history row and all unrelated history; never mark it reverted manually. Recheck the unchanged projection/policies/ACLs and protected RPCs afterward. Do not run both forward/revert blindly or claim the Security Advisor issue is resolved after reverting.

Stop before apply for missing approval, project/source/baseline mismatch, unsuccessful/private-accessible backup, missing required recovery assurance, unexpected pending files, concurrent schema changes, or target already deployed. Stop after an ambiguous tool result/history mismatch or unexpected RPC/privacy/RLS/advisor result; preserve evidence and seek a bounded correction/rollback authorization. Tier 2 privacy approval is independent: it is not a blocker to this security-only mitigation, but Tier 2 must remain undeployed.

## Evidence status

This task performed catalog/history SELECTs and local source/hash/CLI-help checks only. No fresh backup, restore, production DDL/write, migration-history manipulation, hosted account RPC test, deployment, commit, push or build occurred. Prior local evidence: 118 PostgreSQL and 167 frontend checks passed, including scoped rollback and cross-user protected identity/inbox behavior. Physical Android and postdeployment hosted/advisor acceptance remain pending. No implementation code or reviewed SQL was changed.
