# F1c extension backend design: "stay longer"

Status: **designed and written, not applied, not run.** Migration `supabase/migrations/20261117100000_tenancy_extension.sql`.
Wireframe: `docs/design/rentlease_f1c_stay_longer_v10.html`. Audit that fed this: the answers to the two read-only extension audits of 2026-11-17.

## Product rules (decided, built as written)

- A tenant of an **active** tenancy asks to extend. The owner accepts or declines. The end date moves **only on accept**.
- The client offers +1, +3, +6 months or a custom date. The server validates the date only.
- Requested end must be later than the current end and no later than `latest_end(current_end)`:
  `new_end = (current_end + 1 day) + N months - 1 day`, with N = 6 for the upper bound. So Jan 31 allows up to Jul 31, and Feb 28 allows up to Aug 31 (not Aug 28).
- Today (Asia/Manila) must be on or before the current end, and the tenancy must have an end date.
- One pending request per tenancy. No counter-offer. No notifications. The owner may decline with an optional note. The tenant may withdraw and may ask again after a decline or a withdrawal.
- Rent, rent day and every other column stay unchanged.

## The decision: A (separate table and RPC) over B (kind column and a patched lifecycle RPC)

| | A. `rentlease_tenancy_extension` + `write_tenancy_extension` | B. `kind` column on `rentlease_tenancy_end.requests`, patch `write_tenancy_lifecycle` |
|---|---|---|
| Pinned function | none touched; `write_tenancy_lifecycle` md5 `312e8bdaee38ba3b762a55b1635b2c63` stays valid | patch needed (anchor-replace, new pin, new rollback backup) |
| Lifecycle `accept` | cannot see an extension row | would act on whatever pending row exists unless every branch checks `kind` |
| Reason rule | extension note is optional | lifecycle requires a reason on every action; B must special-case it |
| `proposed_end_date` | extension keeps its own `requested_end_date` and `base_end_date` | column means "today" for early end; B overloads it |
| Early-end UI | untouched | mislabels an extension (see below) |
| Cost | one more schema, three RPCs | smaller schema, riskier patch |

Chosen: **A**. If B had been chosen, these would mislabel or misbehave on an extension row: `get_tenancy_lifecycle` (its `pending` object), `lifecycleActions`/`parseLifecycle` in `TenancyLifecycle.ts`, `attentionItems` end-request item in `TenancyWorkspaceScreen.ts` ("asked to end the stay"), `usePropertyManagement.ts:86` (`endRequest` and the "Ending request" chip, "Reply" Needs-you item), `tenancyDetailsWorkflow`/`TenancyLifecyclePanel` (accept offered only when `pending.date === today`), and the `one_pending_tenancy_end` unique index.

### How the two features stay consistent

Both writers take the same **property advisory lock** (`hashtextextended(property_id::text, 0)`) and then lock the tenancy row, so a request or decision on either feature is serialized with the other.

- **Extension request while an early-end request is pending:** refused, `22023 extension_unavailable:early_end_pending`.
- **Early-end request created while an extension is pending** (the lifecycle RPC is not changed and does not know about extensions): allowed. The extension stays `pending`. Then:
  - owner **accept** of the extension is refused, `22023 extension_unavailable:early_end_pending`, until the early-end request is resolved. Decline and withdraw still work. (Reason: accepting would change the tenancy row, which changes `rentlease_tenancy_end.version()` and makes the early-end request's `base_version` stale.)
  - if the early-end request is **accepted**, the tenancy becomes `ended`. The extension stays `pending` (no fifth status) but is no longer actionable: accept refuses `22023 extension_unavailable:not_active`, `get_pending_tenancy_extensions` stops listing it, and the owner can still decline and the tenant can still withdraw to clear it.
  - if it is rejected or withdrawn, accept works again.
- **Accept re-checks everything:** status active, the tenancy's end date is still the one the request was made against (`40001 Tenancy changed. Reload.` otherwise), today is not past the end, no early-end request, and the calendar (below).

## State machine

```
(none) --request(tenant)--> pending --accept(owner)--> accepted   (tenancies.expected_end_date := requested_end_date)
                               |--decline(owner, optional note)--> declined
                               |--withdraw(tenant)--------------> withdrawn
declined / withdrawn / accepted: terminal. A new request may be made if canRequest.
```

`canRequest` is false with one of: `not_tenant`, `not_active`, `no_end_date`, `past_end_date`, `early_end_pending`, `request_pending`.

## RPCs (all `security definer`, `search_path = pg_catalog`, execute for `authenticated` only; revoked from PUBLIC, anon, service_role)

1. `write_tenancy_extension(tenancy_id, operation_id, action, payload jsonb)` returns `{requestId, status, requestedEndDate, currentEndDate, revision}`.
   - `request`: `{requestedEndDate: "YYYY-MM-DD", note?}` (tenant). `withdraw`: `{requestId, revision}` (tenant). `accept`: `{requestId, revision}` (owner). `decline`: `{requestId, revision, note?}` (owner).
   - `requestId` and `revision` are strings (uuid). Unknown payload keys are refused. A note, when present, is 1 to 1000 characters after trimming.
   - Replay: a retry with the same `(actor, operation_id)` and the same normalized input returns the stored result; different input is `22023 Conflicting retry`. The replay happens before any state check.
2. `get_tenancy_extension(tenancy_id)` returns the pending request, else the latest finished one, and what the caller may do (see fields below).
3. `get_pending_tenancy_extensions()` returns `{rows, hasMore}` for the signed-in owner: oldest first, at most 50, only requests on active tenancies whose end date is not past.

### `get_tenancy_extension` fields
`tenancyId, role ('tenant'|'landlord'), currentEndDate, latestEndDate, canRequest, cannotRequestReason, request`. `request` (or null): `id, status, requestedEndDate, baseEndDate, note, decisionNote, whoDecided ('tenant'|'landlord'|null), revision, createdAt, decidedAt, conflictDate (owner and pending only, live), canAccept, canDecline, canWithdraw`.
### `get_pending_tenancy_extensions` row
`tenancyId, propertyId, requestId, requestedEndDate, currentEndDate, createdAt, conflictDate`.
No user ids are returned anywhere; roles only.

## Conflicts

The extra days are `current_end + 1` through `requested_end`, checked with the range `[from, to + 1)`. A day is committed when:
- another party's reservation with status `pending` or `approved` and not expired (`expires_at > clock_timestamp()`) covers it. "Another party" is a different tenant or landlord than this tenancy's, the same rule as the `aac_reservation_tenancy_commitment` trigger; or
- another tenancy on the property in `proposed`, `pending_confirmation` or `active` covers it (an open-ended one covers everything after its start).

Checked at **request** time, again at **accept** time, and live in both owner reads. The `aac` trigger still runs on the accept's `UPDATE` as a backstop, but is not relied on.

**Error contract:** SQLSTATE `23P01`, message `extension_conflict:YYYY-MM-DD` where the date is the first conflicting day (the later of the other booking's first day and `current_end + 1`). Only a date leaves the database (no ids, names or amounts). Privacy note: the refused tenant sees that date of someone else's booking, as decided.

## Error table

| SQLSTATE | Message | Meaning |
|---|---|---|
| 42501 | `Access unavailable` | not signed in, not Tier 1, or not a participant |
| 42501 | `Tenant required` / `Owner required` | wrong role for the action |
| 22023 | `extension_unavailable:<not_active\|no_end_date\|past_end_date\|early_end_pending\|request_pending>` | state refuses the action |
| 22023 | `extension_date_invalid:<missing\|malformed\|not_after_end\|beyond_limit>` | date rule |
| 23P01 | `extension_conflict:YYYY-MM-DD` | calendar conflict, with the first date |
| 40001 | `Extension request changed. Reload.` | stale revision, unknown request id, or not pending |
| 40001 | `Tenancy changed. Reload.` | the tenancy's end date moved since the request |
| 22023 | `Invalid operation`, `Invalid payload`, `Unexpected fields`, `Note must be ...`, `Conflicting retry` | malformed input or reused operation id |

## What an accept writes, and what it triggers

One `UPDATE public.tenancies SET expected_end_date = requested_end_date`. All seven tenancy triggers fire. By reading: `aaa_tenancy_property_gate`, `aab_tenancy_identity_gate` and `inapp_tenancy` act only when status or confirmations change, so they pass or return early; `aac_reservation_tenancy_commitment` re-checks approved reservations of other parties (already checked); `trg_tenancies_updated_at` stamps the row. **`trg_sync_listing_from_tenancy` and `trg_validate_tenancy` have no definition in this repository** (they predate it): the design assumes they accept a date-only update. The check batch runs a real accept through them.

## Report: end-date readers (nothing changed for these)

Verified by reading the code; all use `coalesce(actual_end_date, expected_end_date)` or the raw column, so they update on the next read after the date moves.

| Reader | Where | After the date moves later while active |
|---|---|---|
| Rent ledger schedule and write validation | `rentlease_rent_ledger.due_dates`, `get_rent_ledger`, `write_rent_ledger` | correct; extra months appear on the next read |
| Maintenance "closed" and write gate | `20261110072014_tenancy_rent_maintenance.sql:86`, `20261117090000_maintenance_care.sql:77-79` | correct |
| Lifecycle (`complete` after the end, `request_end` before it) | `get_tenancy_lifecycle` returns `expectedEndDate` live | correct; `version()` changes (see consistency above) |
| Details progress "Day X of N", Tenancy tab ranges, Past ordering | `tenancyDetailsService`, `tenancyWorkspaceService`, `TenancyDetailsScreen.ts`, `TenancyWorkspaceScreen.ts` (direct `tenancies` select) | correct after the client re-reads |
| Manage stay dates and next rent | `usePropertyManagement.ts:84` | correct after refresh |
| Reservation and tenancy overlap checks | `request_rental_reservation`, approve, `aac` trigger, establishment eligibility | correct; other parties are now blocked for the extra days |
| Rating eligibility | `submit_tenancy_review`, `get_tenancy_reviews` | unaffected: needs `ended` + `actual_end_date` |
| Cancelled and past lists | status-based | unaffected |
| Notifications | `inapp_tenancy` event key excludes the end date and returns early | none created |

**Not moved by an accept:** the source reservation's `end_date` (the details "Source reservation" document will show the old dates). No materialised view, generated column or client cache of the end date was found in the migrations or in `src` (`AsyncStorage` keys do not hold tenancy dates). The `CREATE TABLE tenancies` DDL predates the repository, so a generated column cannot be ruled out from files; `database.types.ts` shows `expected_end_date` as a plain nullable column.

## Not built

- Counter-offers, notifications, rent changes on extension, an extension for an owner-initiated request, open-ended stays.
- Automatic expiry of a pending request. A request that can no longer be accepted (past end date, tenancy ended) stays `pending` until withdrawn or declined, and is hidden from the owner feed.
- Updating the source reservation's `end_date`.
- A frontend. The wireframe's owner "offer a shorter date" button is out of scope (no counter-offer).

## Files

- Migration: `supabase/migrations/20261117100000_tenancy_extension.sql`
- Rollback (data retained): `supabase/test-support/tenancy_extension_rollback.sql`; full (empty tables only): `tenancy_extension_rollback_full.sql`
- Checks (ends in a deliberate exception): `supabase/test-support/tenancy_extension_checks.sql`

## Fingerprints (`md5(prosrc)`), computed from the migration files, not from a database

Dependencies pinned by the migration's guard (not replaced): `is_tier1_verified` `ddd2c8ed28b61e30e23e4f3ddefe4590` (from the ledger migration), `write_tenancy_lifecycle` `312e8bdaee38ba3b762a55b1635b2c63`, `get_tenancy_lifecycle` `c0eacfc87a52d0731a2e0eab2b34baee`, `rentlease_rent_ledger.due_dates` `8d82e44cbc7b94bf538608aefe1b48ce`, `rentlease_reservations.guard_tenancy_commitment` `7f3420d0026e508c25b240f0bae7e96c`.

New functions: `write_tenancy_extension` `60f187a9a9489c0e26a15b46ec89e3cd`, `get_tenancy_extension` `a3733c90e3c08ba79340c2c278b64714`, `get_pending_tenancy_extensions` `b79b8191fe9e5935faf2d9aff9b900c3`.

## Before applying (not done)

Run the check batch against a scratch database or branch, not the hosted project in use. Confirm the four file-computed fingerprints match the live `prosrc` (`select md5(prosrc) from pg_proc where oid = to_regprocedure(...)`); if any differs the guard stops the migration safely. Confirm `trg_validate_tenancy` and `trg_sync_listing_from_tenancy` accept an end-date-only update (check 5 of the batch does this).
