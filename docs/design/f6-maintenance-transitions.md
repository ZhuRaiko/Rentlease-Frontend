# Feature 6: Maintenance transitions (written before the SQL)

Status: DESIGN, nothing applied. Date: 2026-11-17. Decisions: [f6-maintenance-audit.md](f6-maintenance-audit.md) (top). Base: the **hosted** function sources read on 2026-11-17 (`write_tenancy_care` md5 `883656994c2480d657e10017886f8a1e`, `log_maintenance_status_change` md5 `c9f62c2a1a54300dac5f662cd89baeda`), not the repo migration.

## 1. Vocabulary
- **Hosted statuses (9):** `submitted, acknowledged, needs_information, scheduled, in_progress, resolved, reopened, rejected, cancelled`. Priorities: `low, normal, high, urgent` (UI: Urgent = `urgent`, Soon = `normal`, Can wait = `low`; `high` stays unused).
- **Four-step line:** Sent = `submitted`; Seen = `acknowledged` (also `reopened`, `needs_information`); In progress = `in_progress` (also `scheduled`); Resolved = `resolved`.
- **Final** means no action may change the request: `cancelled`, `rejected`, and `resolved` **with** `tenant_confirmed_resolved_at` set. A `resolved` request the tenant has not confirmed is **not final**: the tenant may confirm or reopen it.
- **Open** (counts in the inbox as open): every status except `cancelled`, `rejected` and a confirmed `resolved`. "Awaiting confirmation" is `resolved` with no tenant confirmation.
- All writes go through `write_tenancy_care(p_tenancy_id, p_operation_id, p_action, p_payload)`; the existing receipt per `(actor, operation id)` makes a replay return the first result and write nothing, and the same id with different input is `Conflicting retry` (22023). Every action except `create` carries `requestId` and `revision` (the request's `care_revision`); a stale revision is `Request changed. Reload.` (40001). Every write rotates the revision, so a reply also invalidates the other party's stale view.

## 2. Who may do what (actions)
| Action | Who | Payload keys | From status | Result |
| --- | --- | --- | --- | --- |
| `create` | tenant | `title` 3-100, `description` 10-2000, `category`, optional `priority` (`low`, `normal`, `urgent`; default `normal`) | none | `submitted` |
| `respond` (acknowledge) | landlord | `requestId, revision, status='acknowledged', note` (1-2000) | `submitted`, `reopened`, `needs_information` | `acknowledged` |
| `respond` (start work) | landlord | `status='in_progress'` | `submitted` (new: goes straight, counts as seen), `reopened` (new), `acknowledged`, `scheduled` | `in_progress` |
| `respond` (resolve: "landlord says done") | landlord | `status='resolved'` | `acknowledged`, `in_progress`, `scheduled` | `resolved`, unconfirmed |
| `respond` (same status, note only) | landlord | `status` = current status | any non-final status except `resolved` | same status |
| `reply` (new) | tenant or landlord | `requestId, revision, note` (1-2000) | any non-final status (including an unconfirmed `resolved`) | same status |
| `confirm_resolved` (new) | tenant | `requestId, revision, note?` | `resolved` (unconfirmed) | stays `resolved`, now final |
| `reopen` (new) | tenant | `requestId, revision, note` (**required**, 1-2000) | `resolved` (unconfirmed) | `reopened` |
| `cancel` (new) | tenant | `requestId, revision, note?` | `submitted`, `acknowledged`, `reopened` (anything before `in_progress`) | `cancelled` |

Every other combination is refused with `Transition unavailable` (22023). The tenant cannot use `respond`; the landlord cannot use `create`, `confirm_resolved`, `reopen` or `cancel` (`Tenant required`, `Landlord required`, 42501). A caller who is not a party of the tenancy gets `Access unavailable` (42501). `anon` cannot execute the functions.

## 3. Status by status
| Status | Landlord may move it to | Tenant may move it to | Reply | Notes |
| --- | --- | --- | --- | --- |
| `submitted` | `acknowledged`, `in_progress` | `cancelled` | yes | created by `create` |
| `acknowledged` | `in_progress`, `resolved` | `cancelled` | yes | "Seen" |
| `in_progress` | `resolved` | none | yes | the tenant can no longer cancel |
| `resolved` (unconfirmed) | none (reply only) | confirm (final), `reopened` | yes | landlord says done; the tenant decides |
| `resolved` (confirmed) | none | none | **no** | final |
| `reopened` | `acknowledged`, `in_progress` | `cancelled` | yes | back to Seen |
| `cancelled` | none | none | no | final |
| `needs_information`, `scheduled`, `rejected` | existing transitions kept (`needs_information -> acknowledged`; `scheduled -> in_progress/resolved`) | none | yes (not `rejected`) | **unused**: no action produces them. `rejected` has no way in. `priority = high` is unused too. |

## 4. What each action writes
| Action | `maintenance_requests` | `maintenance_updates` (history and thread) |
| --- | --- | --- |
| `create` | new row: `status submitted`, `priority`, `category`, `requested_by` = tenant, revision | one row: `null -> submitted`, note "Request submitted", actor tenant |
| `respond` (status change) | `status`, `landlord_response` = note, `last_updated_by`, `resolved_at` (when resolved), revision | one row written by the logging trigger: `old -> new`, note = the landlord's note |
| `respond` (same status) | `landlord_response` = note, `last_updated_by`, revision | one explicit row: `status -> status`, note |
| `reply` | `last_updated_by`, revision (so `updated_at` moves) | one explicit row: `status -> status`, note, actor = caller |
| `confirm_resolved` | `tenant_confirmed_resolved_at = now`, `last_updated_by`, revision | one explicit row: `resolved -> resolved`, note = the tenant's note or "Confirmed fixed" |
| `reopen` | `status = reopened`, `resolved_at = null`, `last_updated_by`, revision (`landlord_response` is kept) | one row written by the logging trigger: `resolved -> reopened`, **note = the tenant's note** |
| `cancel` | `status = cancelled`, `last_updated_by`, revision | one row written by the logging trigger: `old -> cancelled`, note = the tenant's note or "Cancelled by the tenant" |

Exactly **one** `maintenance_updates` row is written per action (never two), so exactly one notification per action.

## 5. The status-change logging trigger
Hosted `log_maintenance_status_change()` writes `note = coalesce(new.landlord_response, new.rejected_reason)` for every status change. A tenant `reopen` or `cancel` would therefore log the **landlord's stale response** as the tenant's note. Patch (one anchor): the note is `coalesce(nullif(current_setting('rentlease.care_note', true), ''), new.landlord_response, new.rejected_reason)`. `write_tenancy_care` sets the transaction-local setting `rentlease.care_note` to the acting person's note before every status-changing update and clears it right after, so the logged note is always the actor's own. A status change made any other way (no setting) behaves exactly as today. The function's owner, ACL (default), `search_path=public` and security-definer flag are unchanged.

## 6. Ended tenancy
- **Reading stays allowed** to both parties: `get_tenancy_care`, `get_tenancy_maintenance_history`, and the new `get_maintenance_request`. The landlord inbox keeps showing the open requests of an ended tenancy.
- **Refused** (`Active tenancy required`, 42501): `create`, `reply`, `reopen` and `check_reminder`. `respond` to any status other than `resolved` is refused with `Transition unavailable` (22023). This also covers a tenancy that is `active` in status but past its end date (the existing rule).
- **Allowed so that an open request can be closed** (decision for you, flagged): the landlord's `respond` to `resolved`, the tenant's `confirm_resolved`, and the tenant's `cancel`. Without these an open request on an ended tenancy could never close. If you prefer a strict read-only history, remove `'respond','confirm_resolved','cancel'` from the one guard line.
- A tenancy that is neither `active` nor `ended` (`proposed`, `pending_confirmation`, `cancelled`) refuses every write.

## 7. Notifications (existing trigger, unchanged)
`rentlease_notifications.generate()` (md5 `08b686c7868662747ec9bf3f119c6177`) runs after each insert into `maintenance_updates` and notifies the **other** party (the actor never gets one), once per row (`event_key = 'maintenance:' || update id`). Its text does not vary by action. Every action below produces the same notification:

- type `maintenance_update`, title **"Maintenance update"**, body **"Open RentLease to review this update."**, target kind `tenancy` with the tenancy id (opens Tenancy details).

| Action | Notified |
| --- | --- |
| `create` | landlord |
| `respond` (any) | tenant |
| `reply` by the tenant / by the landlord | landlord / tenant |
| `confirm_resolved`, `reopen`, `cancel` | landlord |

A different title per action would need a patch of `generate()`, which is shared by messaging, viewings, reservations and tenancies; it is **not** in scope.

## 8. New reads
- `get_maintenance_inbox(p_offset integer default 0)`: the caller's requests **as landlord**: every request of their **active** tenancies, plus the **open** requests of their **ended** tenancies. Urgent open first, then newest; 20 per page; counts over the whole visible set (`open`, `inProgress`, `awaitingConfirmation`, `resolved`, `urgentOpen`). A caller who is not a landlord of any tenancy gets zero counts and no rows; a caller without an active Tier 1 account is refused (42501).
- `get_maintenance_request(p_request_id, p_offset default 0)`: any party of the request's tenancy (reading allowed after the tenancy ends): the request (with the viewer's role) and its thread, oldest first, 20 per page.
- `get_tenancy_care` and `get_tenancy_maintenance_history` are not changed.

## 9. Schema
Only the category check changes: `plumbing, electrical, appliance, structural, other, internet, pests` (`structural` stays valid; the UI shows six). No new column, table, status or photo object.
