# Room tour backend design (PREPARED LOCAL / NOT APPLIED)

Status: IMPLEMENTED LOCALLY / AUTOMATED-TESTED in a disposable container. Nothing is applied to hosted. Nothing is pushed. Hosted Supabase was not contacted.
Visual design: [room-tour/README.md](room-tour/README.md). Migration: `supabase/migrations/20261119100000_property_panoramas.sql`.

## What it is

An owner adds up to two phone panoramas per property, **Front side** and **Back side**, each optional. Renters who can already see the property can read them.
A panorama is not a `property_photos` row: it never counts toward the 10-photo limit and never becomes the cover.

## Contract

| Piece | Definition |
| --- | --- |
| Bucket | `property-panoramas`, public, `file_size_limit` 15728640 (15 MiB), mime types exactly `image/jpeg`, `image/png`, `image/webp`. |
| Object path | `<ownerId>/<propertyId>/<uuid>.<jpg|jpeg|png|webp>` (lowercase hex uuids). |
| Table | `public.property_panoramas(id, property_id -> properties ON DELETE CASCADE, side 'front'|'back', storage_path, width, height, created_at, updated_at)`, `unique(property_id, side)`, `unique(storage_path)`. |
| Table access | RLS on. `revoke all` from public, anon, authenticated, service_role, then `grant select` to authenticated. Policy `property_panoramas_read_allowed` (authenticated) uses `public.can_view_property(property_id)`. |
| `set_property_panorama(p_property_id, p_side, p_storage_path, p_width, p_height) returns jsonb` | Calls `rentlease_property_edit.lock_owner` first (Tier 1, owned active property, advisory lock). Upserts on `(property_id, side)`. Returns `{side, storage_path, replaced_path}`. |
| `remove_property_panorama(p_property_id, p_side) returns jsonb` | Same lock. Idempotent. Returns `{side, removed_path}` (null when the side was empty). |
| Storage policies | INSERT, SELECT, DELETE for the owner of the folder (permissive); UPDATE denied for the bucket (restrictive). All `TO authenticated`. |

### Errors (SQLSTATE 22023 unless noted)

| Message | When |
| --- | --- |
| `Side must be front or back` | side is null or anything else |
| `Invalid panorama path` | path is not `<caller>/<property>/<uuid>.<ext>` for this caller and property |
| `Upload not found` | no object with that name in the bucket |
| `Panorama size is required` | width or height is null or not positive (**extra, not in the prompt**) |
| `Panorama must be at least 3:1 wide` | width / height < 3 |
| `Panorama is too wide` | width > 16384 |
| `Panorama file is already in use` | the path is registered to another property or side (**extra, not in the prompt**) |
| 42501 | not Tier 1, or not the owner of an active property (from `lock_owner`); also anon and service_role (no EXECUTE) |

Check order: lock (ownership) first, then side, path, upload exists, size, ratio, width, in use. A non-owner always gets 42501, never an input error.

## Security notes

- Both RPCs are `SECURITY DEFINER`, `search_path = pg_catalog`, fully qualified names, owner `postgres`. `REVOKE ALL` from public, anon, authenticated, service_role, then `GRANT EXECUTE` to authenticated only.
- The caller can only ever write a row that points at an object **inside its own folder** (`auth.uid()` is part of the required path) for a property it owns.
- Storage insert is allowed only when the name matches the full path pattern, the folder owner is the caller, `can_manage_property` is true, and the folder holds fewer than 6 objects (2 slots plus replacement headroom). The regex is inside a `CASE` so the uuid cast only runs on a matching name; a bad name returns a policy refusal, not a cast error.
- Update is denied for every panorama object by a restrictive policy (`bucket_id <> 'property-panoramas'`). Clients upload with `upsert: false`; replacing means uploading a new object and calling the RPC.
- The cap helper `rentlease_property_panorama.folder_has_room(text)` is `SECURITY DEFINER` because a policy that queries `storage.objects` directly would recurse. The schema is private except USAGE and EXECUTE for `authenticated` on that one helper (see deviation 1).
- The bucket is public: anyone with an object URL can fetch the image. This matches `property-media`. Row access (which URL a user is told) is enforced by RLS; the URL itself is unguessable (uuid) but not secret.

## The one patch to an existing function

`rentlease_unfinished_posts.inspect(uuid)` treats every foreign key into `properties` that is not on an allow-list as "protected history". Without a patch, an unfinished post with a panorama could never be deleted. The migration re-creates it with `CREATE OR REPLACE`, adding `'property_panoramas'` to the allow-list and nothing else. Language, security definer, `search_path` and grants are preserved; the post-conditions assert this.

| Body | md5 (CR stripped) |
| --- | --- |
| Before (guarded) | `05d843208715e6122ea53beec8165989` |
| After (pinned) | `fd1bc6691ce65b03ae723d94a2d8a7c9` |

Other pins the guard requires (CR-stripped md5 of `prosrc`): `can_manage_property(uuid,uuid)` `67764c2e0245324ba5c10b56c21eaced`; `can_view_property(uuid,uuid)` `a871fda6e96411b0bfa2c4c68f78c6ab`; `is_tier1_verified(uuid)` `f839df2bff48c4b5880a1794b6d101d5`; `rentlease_property_edit.lock_owner(uuid)` `d92dbc08d296168776d7fa49e96b321c`.
The RPC bodies are pinned in the migration post-conditions: `set_property_panorama` `445ee381083202d57bc2a5b7029b6e57`, `remove_property_panorama` `2d45667038d7220f17843f562dfd0aa4`.

Note on `is_tier1_verified`: the tenancy extension migration pins its raw md5 `ddd2c8ed...`, which is also correct, but its comment "no CRs" is wrong: the hosted body has 8 CR characters. The stripped pin `f839df2b...` is used here.

## Decisions and accepted gaps

- **Bucket created inside the migration.** No earlier migration in this repository creates a bucket (`property-media` and `avatars` already existed and were only asserted). This one inserts into `storage.buckets` with `on conflict do nothing`, then asserts the contract; an existing bucket with other settings stops the migration with `Unexpected property-panoramas bucket contract; stop for review`. Alternative if hosted refuses the insert: create the bucket by hand in the Dashboard with the same settings, then run the migration (the insert does nothing, the assertion still runs). **Unverified on hosted:** whether the migration context may insert into `storage.buckets` and create policies on `storage.objects`.
- **Orphan bytes (accepted v1 gap).** Deleting an unfinished post cascades the rows but leaves the files in the bucket (the edge function is not changed). Removing a panorama with `remove_property_panorama` also leaves the file; the client may delete its own unregistered files through the Storage API (DELETE policy). Free plan has 1 GB of storage and a 50 MB file cap; the 15 MiB limit and the 6-object folder cap bound the exposure.
- **Registered files can be deleted by the owner through the Storage API.** The DELETE policy does not look at the table, so an owner can delete the bytes of a registered panorama and leave a row that points at nothing. The viewer must treat a failed image load as "unavailable". Not a privilege problem (owner's own file) but a data-quality one.
- **A row exists only for a file that existed.** `set_property_panorama` checks `storage.objects`, but the check is at call time; the file can be deleted afterwards (above).

## Deviations from the prompt (all flagged in the report)

1. **Helper schema access.** The prompt asks for a private schema revoked from every client role, but a Storage policy runs as the calling role and must execute the cap helper. The schema grants `authenticated` USAGE and EXECUTE on that single function only; the post-conditions assert that nothing else in the schema is executable and that anon and service_role have nothing.
2. **Two extra error messages**: `Panorama size is required` and `Panorama file is already in use`.
3. **Fixture stubs.** `can_manage_property` and `can_view_property` are not in the repository, so the checks use semantic stubs (documented in `property_panoramas_fixture.sql`). The migration carries the live pins; the runner substitutes the fixture md5 only in a copy and asserts the checked-in file has the live values.
4. **`lock_owner` differs between hosted and local migration text.** Hosted requires only Tier 1 and an owned active property (no landlord-role check). The fixture uses the hosted body (md5 matches the pin).

## Backup and plan limits (Supabase Free)

- No PITR, no branching, 1 GB storage, 50 MB max file. No branch tools are used.
- `scripts/predeploy-backup/New-PredeployBackup.ps1` takes `-Feature -ExpectedProjectRef -Schemas -Functions -Tables -ForwardSql -RollbackSql -OutputRoot`; the default output is `C:\RentLease-Backups` (not `.claude/predeploy-backup-*`). It covers schema dumps, function bodies and table fingerprints for the names given. It cannot list `public.property_panoramas` in `-Tables` before the table exists, and capture of `storage` schema policies and bucket rows is **untested**. No script change is needed if the `storage.objects` policy dump and the bucket row are recorded by hand (see [the pre-apply policy record](../implementation-reports/database/STORAGE_OBJECTS_POLICIES_BEFORE_PANORAMAS.md)). The script was not changed and not run.
- Never delete from `storage.objects` with SQL (it orphans the real files). Emptying or removing the bucket is a manual Storage API or Dashboard step.

## Apply procedure (only after an explicit go-ahead)

1. Fresh predeploy backup; record the live `storage.objects` policy dump and `storage.buckets` rows in the policy record.
2. `supabase db query --linked -f supabase/migrations/20261119100000_property_panoramas.sql` (a single transaction; any failed guard or post-condition rolls everything back).
3. A single-version `supabase migration repair --status applied 20261119100000`. Never `db push` (hosted history has drifted). Never `migration repair --status reverted`.
4. Read-only post-checks: the four policies, grants, bucket contract, `inspect` md5 `fd1bc6691ce65b03ae723d94a2d8a7c9`.

## Rollback

- `supabase/test-support/property_panoramas_rollback.sql` (data-retaining): drops only the two RPCs; the table, policies, helper schema, bucket, rows and files stay.
- `supabase/test-support/property_panoramas_rollback_full.sql`: refuses unless the table is empty and the bucket has no objects; drops policies, helper schema, table and RPCs and restores `inspect` to the original body (`05d84320...`). It does not remove the bucket and never deletes from `storage.objects`.

## Test evidence

`python supabase/tests/run_property_panoramas.py` (Docker, PostgreSQL 17.6.1.155, no network): 109 checks (33 runner assertions, 76 SQL checks in `supabase/test-support/property_panoramas_checks.sql`). Covered: set, replace, remove and idempotent empty remove; 42501 for another owner, a non-Tier-1 owner, anon and service_role; every 22023 message; read policy by actor; storage insert, update, delete and the 7th-insert refusal; property delete cascade; `inspect` with panorama rows and with a tenancy; guard refusal on re-run, drift and a mismatched bucket; both rollbacks.
RUNTIME-UNVERIFIED on hosted and on a device.
