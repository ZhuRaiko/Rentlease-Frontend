# Feature 6: Maintenance, audit and gap list

Status: AUDIT + PROPOSAL, nothing applied. Date: 2026-11-16.

## Decisions (2026-11-16, they supersede the matching text below)
1. **Seen = the landlord's explicit acknowledge** (`acknowledged`); no write on open.
2. **Add Internet and Pests; keep Structural valid but hidden** (the UI shows six categories).
3. **Urgency mapping:** Urgent = `urgent`, Soon = `normal`, Can wait = `low`; `high` stays unused.
4. **Photos are cut from v1** (no table, no attach RPC, no bucket change). Section 3 item 6 is deferred.
5. **Not fixed = `reopen` with a required note.** Fixed = `resolved` plus the tenant's confirmation; no automatic confirmation.
6. **The landlord may go straight to `in_progress`** from a new request (`submitted -> in_progress`; it counts as seen).
7. **Inbox = active rentals plus ended rentals that still have an open request.**
8. **The thread stays in the history table** (`maintenance_updates`); no new table.
9. **Any patch is based on the HOSTED `prosrc`**, not on the repo migration (the repo's maintenance migrations do not match the hosted schema). Wireframe: `docs/design/rentlease_f6_maintenance_v8.html`.

Evidence: hosted project `cxfsbwbwmwmgtqfonqth`, read-only catalog queries (columns, constraints, enums, triggers and their function source, policies, privileges, storage buckets and policies, function ACLs and fingerprints, row counts only; no row content), the repo migrations, and the app (`tenancy/models/TenancyCare.ts`, `services/tenancyCareService.ts`, `views/TenancyCarePanel.tsx`).

---

## 1. What exists today

### 1.1 Tables and enums (live)
| Object | Finding |
| --- | --- |
| `public.maintenance_requests` | `id`, `tenancy_id` (FK tenancies, **CASCADE**), `requested_by` (FK profiles), `title`, `description`, **`category text`** (check: `plumbing, electrical, appliance, structural, other`), **`priority maintenance_priority`** default `normal`, `status maintenance_status` default `submitted`, `landlord_response text`, `rejected_reason text`, `scheduled_for timestamptz`, `resolved_at`, **`tenant_confirmed_resolved_at timestamptz`**, `last_updated_by`, `care_revision uuid` (added by the T4 migration), `created_at`, `updated_at` |
| `maintenance_status` | `submitted, acknowledged, needs_information, scheduled, in_progress, resolved, reopened, rejected, cancelled` (9) |
| `maintenance_priority` | `low, normal, high, urgent` (4) |
| `public.maintenance_updates` | `id`, `maintenance_request_id` (CASCADE), `actor_id`, `from_status`, `to_status` (not null), `note`, `created_at` |
| Photos | **No photo column or table.** A private Storage bucket **`maintenance-media`** exists (0 objects) with policies: insert when `can_access_tenancy(foldername[1])` and `foldername[3] = auth.uid()`; read for tenancy participants. No delete or update policy. **The bucket has no file-size limit and no MIME allowlist.** The app never references the bucket. |
| RLS / grants | RLS on both tables; policies exist (read/insert/update for parties) but **no role has any table privilege**, so they are unreachable. All access is through definer RPCs. |
| Triggers | `requests`: `care_request_revision` (rotate revision), `trg_log_maintenance_status_change` (AFTER UPDATE OF status: inserts a `maintenance_updates` row from the old and new status with **note = `landlord_response` or `rejected_reason`**), `trg_maintenance_requests_updated_at`, `trg_set_maintenance_update_actor` (BEFORE UPDATE: actor must be a participant), `trg_validate_maintenance_request` (BEFORE INSERT: tenancy must be `active` and the requester a party). `updates`: `inapp_maintenance` (AFTER INSERT, `rentlease_notifications.generate()`: notifies the **other** party with `maintenance_update` "Maintenance update", kind `tenancy`). |
| Data | **0 requests, 0 updates, 0 photos, 0 `maintenance_update` notifications.** `rentlease_tenancy_care.receipts` has 2 rows (reminder tests). |

### 1.2 RPCs (live; `security definer`, `search_path=pg_catalog`, anon NO execute, authenticated execute)
| Function | md5 prefix | Behavior |
| --- | --- | --- |
| `get_tenancy_care(uuid,integer)` | `624c3bf0ce0f` | Participant, active Tier 1. Returns the rent schedule, stored rent obligations, reminders and **`requests`: 20 per page** (`id, title, description, category, priority, status, response (landlord_response), revision, createdAt, updatedAt`). No photos, no last update, no tenant-confirmation field. |
| `get_tenancy_maintenance_history(uuid,integer)` | `78ac0cab8cd9` | Participant: the request's `maintenance_updates` (actor, from/to status, note, time), 20 per page. This is the closest thing to a thread. |
| `write_tenancy_care(uuid,uuid,text,jsonb)` | `883656994c24` | Receipts, locks, revision checks. Actions: `check_reminder`, **`create`** (tenant only; `title` 3-100, `description` 10-2000, `category` required in the 5; **priority forced to `normal`**; inserts the request and a "Request submitted" update; requires an active tenancy) and **`respond`** (landlord only; `requestId`, `revision`, `status`, `note` 1-2000; allowed transitions: `submitted/reopened/needs_information -> acknowledged`, `acknowledged/scheduled -> in_progress`, `acknowledged/in_progress/scheduled -> resolved`, or the same status with a new note; final states `resolved/rejected/cancelled` accept nothing). **No reply, confirm, reopen or cancel action exists.** |

### 1.3 How the app uses it
`TenancyCarePanel` ("Rent and maintenance"): the tenant sees a create form (title, description, five category buttons; no urgency, no photos) and the request list ("No requests on this page" when empty); each request has "View request history"; the landlord sees note field and transition buttons (Acknowledge request, Start work, Mark resolved, Send response). Tenancy details has a Maintenance card opening the same panel. Manage (Feature 2) counts open requests and lists **urgent** ones in Needs you; since the RPC forces `normal`, **no request can ever be urgent today**. The parser (`parseCare`) **rejects the whole read** if any request has a category outside the app's five.

---

## 2. Wireframe vs reality

| Wireframe item | Status | Notes |
| --- | --- | --- |
| Category: Plumbing, Electrical, Appliance, Internet, Pests, Other | **Partly.** | Column and check exist; the check has `structural` and lacks `internet`, `pests`. Needs a constraint change (no rows, so safe). The app parser must learn the new values first or together. |
| Urgency: Urgent / Soon / Can wait | **Column exists, no way to set it.** | `priority` enum has `urgent`, `normal`, `low` (and an unused `high`). Map Urgent=urgent, Soon=normal, Can wait=low. `create` must accept it. |
| Description | Exists | `description` 10-2000. |
| Photos (optional, up to 3) | **Missing** metadata and rules; bucket exists. | Bucket and insert/read policies are there; no table linking a photo to a request, no limit of 3, no size/MIME limits, no delete policy. |
| Four-step tracker: Reported, Seen, In progress, Fixed | **Derivable, no migration.** | Reported=`submitted`, Seen=`acknowledged` (also `needs_information`), In progress=`in_progress` or `scheduled`, Fixed=`resolved`. `reopened` returns to Seen. The step times come from `maintenance_updates`. |
| "Seen by <landlord>" with a time | Needs a definition. | `acknowledged` is an explicit landlord action today. A read receipt would need a write on open (not proposed). |
| Tenant confirms fixed | **Column exists, nothing writes it.** | `tenant_confirmed_resolved_at` is unused. Needs a tenant action `confirm`, and `reopen` (status `reopened` exists, unused) for "not fixed". |
| Landlord: Reply, Mark in progress | Partly. | Mark in progress is only allowed from `acknowledged/scheduled`; from `submitted` the landlord must acknowledge first. A tenant `reply` does not exist. |
| Per-request thread, both parties, notifies both | **Mostly exists.** | `maintenance_updates` is a per-request log with notes and the notification trigger already notifies the other party. Missing: note-only updates by either party (today notes come only from landlord `respond` and from the status-change trigger). |
| Landlord inbox (counts, urgent first, across properties) | **Missing.** | Reads are per tenancy (`get_tenancy_care`, 20 per page). No cross-tenancy read, no counts, no last note per request. |
| Tenant cancel | Not in the wireframe | `cancelled` status exists, unused. |
| Active-only replies; read-only history after end | Matches | `write_tenancy_care` and the insert trigger require an active tenancy. |

## 3. What is missing, and the migration it needs (only these)

All write paths stay in the existing private schema `rentlease_tenancy_care` (receipts, `relationship()` helper, revision trigger) with the same locks and drift-guard method as the rent ledger.

1. **Category constraint:** replace `maintenance_requests_category_check` with `plumbing, electrical, appliance, structural, other, internet, pests` (`structural` stays valid, the UI shows six).
2. **Extend `write_tenancy_care`** (anchor patch, md5 pin `883656994c24...`, full md5 recorded at write time; no new function and no new signature):
   - `create` accepts `priority` in `low|normal|urgent` (default `normal`) and stores it.
   - new actions, payload `{requestId, revision, note?}`:
     - `reply` (either party; note 1-2000; request not in a final state; inserts a `maintenance_updates` row with the same status, which the existing trigger turns into a notification);
     - `confirm` (tenant only; status must be `resolved`; sets `tenant_confirmed_resolved_at`; inserts an update "Confirmed fixed");
     - `reopen` (tenant only; from `resolved`; status `reopened`; clears the confirmation; note required);
     - `cancel` (tenant only; from `submitted` or `acknowledged`; status `cancelled`);
   - `respond` additionally allows `submitted -> in_progress` (the landlord's "Mark in progress" on a new request; it counts as seen).
3. **Patch `log_maintenance_status_change()`** (anchor, pin `c9f62c2a1a54...`): use `nullif(current_setting('rentlease.care_note', true), '')` before `landlord_response`/`rejected_reason`, and have the RPC set it for tenant-driven changes. Today a tenant `reopen` would log the landlord's stale response as the tenant's note.
4. **Landlord inbox read** (new):
```
public.get_maintenance_inbox(p_status text default null, p_property_id uuid default null, p_offset integer default 0) returns jsonb
-- p_status in (null,'open','in_progress','resolved'); the caller must be the landlord of the rows (rows for other roles are never returned)
-- { counts:{open, inProgress, resolved, urgentOpen},
--   rows:[{ id, tenancyId, propertyId, title, category, priority, status, tenantConfirmedAt, createdAt, updatedAt, revision,
--           lastNote:{role:'tenant'|'landlord', note, at}|null, photoCount }], hasMore }
```
   Urgent open first, then newest. 20 per page. Tenant names come from the existing public-identity read in the frontend, not from this RPC.
5. **Request detail read** (new, so the list read is not widened):
```
public.get_maintenance_request(p_request_id uuid, p_offset integer default 0) returns jsonb
-- { request:{...as above, description, landlordResponse, scheduledFor, resolvedAt}, thread:[{id, role, fromStatus, status, note, at}] (oldest first, 20/page), photos:[{path}] }
```
6. **Photos (cuttable):** private table `rentlease_tenancy_care.photos(id, request_id, tenancy_id, storage_path, uploaded_by, created_at)` with a unique path and a limit of 3 per request; RPC
```
public.attach_maintenance_photos(p_request_id uuid, p_operation_id uuid, p_paths text[]) returns jsonb
```
   verifying each path is `<tenancy_id>/<request_id>/<uploader_id>/<file>` (the layout the existing bucket policy already enforces), that the Storage object exists, that the caller is a party, and the count; plus a migration step setting `maintenance-media` `file_size_limit` and `allowed_mime_types` (JPEG/PNG/WebP) and an owner-only delete policy for unattached uploads. Upload then attach is **not atomic**: a failed attach leaves an orphan object (reported honestly, cleaned by the delete policy); photos are read with signed URLs the existing read policy allows.

Not needed: a new status, a new thread table, new notification code (the existing trigger covers replies and status changes), a scheduler.

## 4. Migration plan, risks, cuts
- **Plan:** backup with `New-PredeployBackup.ps1` (schemas `public, rentlease_tenancy_care, storage` catalog, functions `write_tenancy_care, get_tenancy_care, log_maintenance_status_change`, tables the two maintenance tables and the care receipts, forward and rollback SQL attached); one migration file with guards (the md5 pins, exact column and constraint sets, no client table privileges, the bucket exactly as found, objects absent); apply with `db query --linked -f` then `migration repair`; never `db push`; rollback files (entry points and patches restored from pinned originals, data retained); rollback-only SQL checks with a fixture built inside the transaction (all four tenant actions, landlord transitions, wrong role, stale revision, replay, final states, non-active tenancy, category and priority values, inbox counts and ordering, access isolation between two landlords, anon denied).
- **Risks:** the app parser rejects unknown categories, so the frontend must ship with or before the new categories; replacing a status trigger function affects every maintenance status change (pinned patch, exactly reversible); a tenant `confirm` has no auto-confirm after N days (no scheduler); the bucket has no limits until the migration; two parties can reply at once (revision check); the inbox is the first cross-tenancy maintenance read, so isolation tests matter.
- **Cut order if time is short:** photos (6); `cancel`; `get_maintenance_request` (the existing history read plus the list read are enough for a first thread); `submitted -> in_progress`. **Must keep:** priority on create, `confirm` and `reopen`, `reply`, the category change, `get_maintenance_inbox`.
- **Rough plan:** migration, checks and rollback 1.5 days, apply and re-verification half a day, frontend (report form with urgency, tracker, reply, confirm, landlord inbox and detail) 3 days, device test 1 day. Photos add about 1.5 days.

## 5. Surprises
1. **No request can be urgent today** (priority forced to `normal`), so the Manage "Needs you" urgent item and the red Urgent chip have never had data.
2. The repo migration `20260709100000` (`maintenance_status` of 3 values, column `urgency`) does **not** match the hosted schema (9 statuses, `priority` with 4 values): the known repo vs hosted drift, now confirmed for maintenance.
3. `log_maintenance_status_change` writes the landlord's stale response as the note of any status change, and is **anon-executable** (a trigger function, so not callable as an RPC), as is `validate_maintenance_request`.
4. `maintenance-media` exists but has **no size or MIME limits and no delete policy**, and nothing uses it.
5. `tenant_confirmed_resolved_at`, `scheduled_for`, `rejected_reason` and the `reopened`/`cancelled` statuses exist and are unused: much of the wireframe is a missing RPC action, not a missing column.
6. `maintenance_requests.tenancy_id` is `ON DELETE CASCADE`: a tenancy hard-delete (admin only) would erase maintenance history.
7. No data anywhere (0 requests, 0 updates, 0 photos), so constraint changes are free now and cost something later.
8. Repeat from the F4 audit: hosted `send-sms` has `verify_jwt=false` and its source is not in the repo.

## 6. Decisions needed from you (ANSWERED, see the top of this document)
1. "Seen" = the landlord's explicit acknowledge (recommended), or an automatic mark when the landlord first opens the request (needs a write on open)?
2. Categories: add Internet and Pests, keep Structural valid but hidden (recommended)?
3. Urgency mapping Urgent=urgent, Soon=normal, Can wait=low; leave `high` unused?
4. Photos in v1, or cut first? (They need the bucket limits, a table and an attach RPC.)
5. Tenant "Not fixed" = `reopen` with a required note, and "Fixed" = `resolved` plus the tenant's confirmation; no automatic confirmation (no scheduler). OK?
6. Allow the landlord to mark "In progress" straight from a new request (counts as seen)?
7. Should the landlord inbox include requests from ended tenancies (read-only history) or active rentals only?
8. Keep the thread inside `maintenance_updates` (recommended) or add a separate table?
