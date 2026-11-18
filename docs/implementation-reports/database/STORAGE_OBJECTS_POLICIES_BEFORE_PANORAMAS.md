# storage.objects policies before the room tour migration (rollback reference)

Status: **live dump TAKEN** on 2026-11-19, read-only, immediately before the apply (after the predeploy backup `C:\RentLease-Backups\property-panoramas-predeploy-20261118-170430`, which is not committed or uploaded). This file records what the repository says exists, the read-only queries, and the live results below.

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

## Live dump (taken 2026-11-19, before the apply)

Project `cxfsbwbwmwmgtqfonqth`, read-only queries above. Result checks: no policy name contains `panorama`; no `property-panoramas` bucket; `inspect` md5 is the expected `05d843208715e6122ea53beec8165989`.

### storage.objects policies (26 rows)

```json
[
 {
  "cmd": "DELETE",
  "permissive": "RESTRICTIVE",
  "policyname": "avatars_delete_unlinked_only",
  "qual": "((bucket_id <> 'avatars'::text) OR can_delete_own_public_avatar(name))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "INSERT",
  "permissive": "RESTRICTIVE",
  "policyname": "avatars_insert_public_scope",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id <> 'avatars'::text) OR ((name ~ (('^'::text || (auth.uid())::text) || '/public/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)$'::text)) AND (EXISTS ( SELECT 1\n   FROM profiles\n  WHERE ((profiles.id = auth.uid()) AND (profiles.account_status = 'active'::account_status))))))"
 },
 {
  "cmd": "UPDATE",
  "permissive": "RESTRICTIVE",
  "policyname": "avatars_no_overwrite",
  "qual": "(bucket_id <> 'avatars'::text)",
  "roles": "{authenticated}",
  "with_check": "(bucket_id <> 'avatars'::text)"
 },
 {
  "cmd": "SELECT",
  "permissive": "PERMISSIVE",
  "policyname": "avatars_read_own_public_objects",
  "qual": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "DELETE",
  "permissive": "RESTRICTIVE",
  "policyname": "identity_proof_delete",
  "qual": "((bucket_id <> 'verification-documents'::text) OR property_identity_document_mutable(name))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "INSERT",
  "permissive": "RESTRICTIVE",
  "policyname": "identity_proof_insert",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id <> 'verification-documents'::text) OR property_identity_document_mutable(name))"
 },
 {
  "cmd": "UPDATE",
  "permissive": "RESTRICTIVE",
  "policyname": "identity_proof_update",
  "qual": "(bucket_id <> 'verification-documents'::text)",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "DELETE",
  "permissive": "RESTRICTIVE",
  "policyname": "property_media_cleanup_delete",
  "qual": "property_media_storage_guard(bucket_id, name, 'delete'::text)",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "UPDATE",
  "permissive": "RESTRICTIVE",
  "policyname": "property_media_immutable_update",
  "qual": "(bucket_id <> 'property-media'::text)",
  "roles": "{authenticated}",
  "with_check": "(bucket_id <> 'property-media'::text)"
 },
 {
  "cmd": "INSERT",
  "permissive": "RESTRICTIVE",
  "policyname": "property_media_intent_insert",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "property_media_storage_guard(bucket_id, name, 'insert'::text)"
 },
 {
  "cmd": "DELETE",
  "permissive": "PERMISSIVE",
  "policyname": "storage_avatars_delete_own",
  "qual": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "INSERT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_avatars_insert_own",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
 },
 {
  "cmd": "UPDATE",
  "permissive": "PERMISSIVE",
  "policyname": "storage_avatars_update_own",
  "qual": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))",
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
 },
 {
  "cmd": "INSERT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_chat_insert_participant",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'chat-media'::text) AND can_access_conversation(((storage.foldername(name))[1])::uuid) AND ((storage.foldername(name))[2] = (auth.uid())::text))"
 },
 {
  "cmd": "SELECT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_chat_read_participant",
  "qual": "((bucket_id = 'chat-media'::text) AND can_access_conversation(((storage.foldername(name))[1])::uuid))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "INSERT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_maintenance_insert_party",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'maintenance-media'::text) AND can_access_tenancy(((storage.foldername(name))[1])::uuid) AND ((storage.foldername(name))[3] = (auth.uid())::text))"
 },
 {
  "cmd": "SELECT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_maintenance_read_party",
  "qual": "((bucket_id = 'maintenance-media'::text) AND can_access_tenancy(((storage.foldername(name))[1])::uuid))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "DELETE",
  "permissive": "PERMISSIVE",
  "policyname": "storage_property_media_delete_owner",
  "qual": "((bucket_id = 'property-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND can_manage_property(((storage.foldername(name))[2])::uuid))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "INSERT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_property_media_insert_owner",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'property-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND can_manage_property(((storage.foldername(name))[2])::uuid))"
 },
 {
  "cmd": "SELECT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_property_media_select_owner",
  "qual": "((bucket_id = 'property-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND can_manage_property(((storage.foldername(name))[2])::uuid))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "UPDATE",
  "permissive": "PERMISSIVE",
  "policyname": "storage_property_media_update_owner",
  "qual": "((bucket_id = 'property-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND can_manage_property(((storage.foldername(name))[2])::uuid))",
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'property-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND can_manage_property(((storage.foldername(name))[2])::uuid))"
 },
 {
  "cmd": "INSERT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_report_evidence_insert_reporter",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'report-evidence'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
 },
 {
  "cmd": "SELECT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_report_evidence_read_reporter_admin",
  "qual": "((bucket_id = 'report-evidence'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR is_admin()))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "DELETE",
  "permissive": "PERMISSIVE",
  "policyname": "storage_verification_delete_owner_pending",
  "qual": "((bucket_id = 'verification-documents'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR is_admin()))",
  "roles": "{authenticated}",
  "with_check": null
 },
 {
  "cmd": "INSERT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_verification_insert_owner",
  "qual": null,
  "roles": "{authenticated}",
  "with_check": "((bucket_id = 'verification-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"
 },
 {
  "cmd": "SELECT",
  "permissive": "PERMISSIVE",
  "policyname": "storage_verification_read_owner_admin",
  "qual": "((bucket_id = 'verification-documents'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR is_admin()))",
  "roles": "{authenticated}",
  "with_check": null
 }
]
```

### storage.buckets (6 rows)

```json
[
 {
  "allowed_mime_types": [
   "image/jpeg",
   "image/png"
  ],
  "file_size_limit": 3145728,
  "id": "avatars",
  "name": "avatars",
  "public": true
 },
 {
  "allowed_mime_types": null,
  "file_size_limit": null,
  "id": "chat-media",
  "name": "chat-media",
  "public": false
 },
 {
  "allowed_mime_types": null,
  "file_size_limit": null,
  "id": "maintenance-media",
  "name": "maintenance-media",
  "public": false
 },
 {
  "allowed_mime_types": [
   "image/jpeg",
   "image/png",
   "image/webp"
  ],
  "file_size_limit": 10485760,
  "id": "property-media",
  "name": "property-media",
  "public": true
 },
 {
  "allowed_mime_types": null,
  "file_size_limit": null,
  "id": "report-evidence",
  "name": "report-evidence",
  "public": false
 },
 {
  "allowed_mime_types": null,
  "file_size_limit": null,
  "id": "verification-documents",
  "name": "verification-documents",
  "public": false
 }
]
```

### rentlease_unfinished_posts.inspect(uuid), md5 with CRs stripped

```json
[{"inspect_md5": "05d843208715e6122ea53beec8165989"}]
```

To roll back the four new policies, `property_panoramas_rollback_full.sql` drops them by name; no existing policy above needs restoring.
