# storage.objects policies before the room tour migration (rollback reference)

Status: **the live dump has NOT been taken.** This file records what the repository says exists, and the exact read-only queries to run against hosted as part of the predeploy step, immediately before the apply, after an explicit go-ahead. Hosted Supabase was not contacted while preparing the migration, so no live definition is recorded here.

## What the repository says (migrations that create policies on storage.objects)

| Policy | Created in |
| --- | --- |
| `property_media_intent_insert`, `property_media_immutable_update`, `property_media_cleanup_delete` | `20261101180736_property_media_versioned_management.sql` |
| `identity_proof_insert`, `identity_proof_delete`, `identity_proof_update` | `20261102081459_property_identity_revision_verification.sql` |
| `avatars_read_own_public_objects`, `avatars_insert_public_scope`, `avatars_no_overwrite`, `avatars_delete_unlinked_only` | `20261107134047_public_identity_nicknames_avatars.sql` |

Policies that exist on hosted but are not created by any migration here (for example Dashboard-made ones) are only visible in the live dump below. The room tour migration adds four: `storage_property_panoramas_insert_owner`, `storage_property_panoramas_select_owner`, `storage_property_panoramas_delete_owner` (permissive) and `property_panoramas_immutable_update` (restrictive). It changes no existing policy.

## Queries to run live (read-only) before the apply, and save the output below

```sql
select policyname, cmd, permissive, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;

select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;

select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = 'rentlease_unfinished_posts.inspect(uuid)'::regprocedure;
```

Expected for the third query: `05d843208715e6122ea53beec8165989`. Expected for the policies: none whose name contains `panorama`; expected for buckets: no `property-panoramas` row.

## Live dump

NOT TAKEN. To rollback the four new policies, `property_panoramas_rollback_full.sql` drops them by name; no existing policy needs restoring.
