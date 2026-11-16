# Feature 3: Rent ledger, backend audit and design

Status: PROPOSAL, nothing applied. Date: 2026-11-16. Wireframe: `docs/design/rentlease_f3_rent_ledger_v8.html` (source of truth).
Rule on screen: *the ledger records what each person says and does not move money.*

## Decisions (2026-11-16, supersede the matching text below)
1. **Dispute chat message is sent client-side**, as the landlord's own text, after `write_rent_ledger('dispute')` succeeds. The RPC does not write chat, does not call `send_property_message`, returns no `messageSent`, and does not depend on chat. If the send fails the screen shows Retry; the dispute stands. (Sections 2.2, 2.4, 2.6 are read with this change.)
2. "Past due" label and the 3-day "Due" window: accepted.
3. The landlord may acknowledge a month the tenant never marked (cash): yes.
4. The tenant may revise after a dispute by marking paid again: yes. `landlord_acknowledged` is final.
5. The events table stays (`RESTRICT` on `tenancy_id`). **Notifications are cut from v1** (section 2.7 is not implemented).
6. `waive` stays reserved and is rejected.

Evidence: hosted project `cxfsbwbwmwmgtqfonqth`, read-only catalog queries (structure, privileges, function source, one row count and status counts; no row contents were read), plus the repo migrations. Hosted Edge Function source was not read in this pass; the repo's four functions (`delete-unfinished-post`, `nearby-places`, `rental-price-estimate`, `review-wordcloud`) do not mention rent.

---

## 1. Audit findings

### 1.1 `public.rent_obligations` (live)
| Item | Finding |
| --- | --- |
| Columns | `id uuid pk default gen_random_uuid()`, `tenancy_id uuid not null`, `due_date date not null`, `amount_due numeric(12,2) not null`, `status rent_obligation_status not null default 'upcoming'`, `tenant_marked_paid_at timestamptz`, `landlord_acknowledged_at timestamptz`, `note text`, `reminder_sent_at timestamptz`, `overdue_notified_at timestamptz`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` |
| Enum | `rent_obligation_status`: `upcoming, due, overdue, tenant_marked_paid, landlord_acknowledged, waived, disputed` (no check constraint on status; the enum is the constraint) |
| Constraints | `rent_obligations_pkey (id)`; `rent_obligations_amount_due_check (amount_due > 0)`; `rent_obligations_tenancy_id_due_date_key UNIQUE (tenancy_id, due_date)`; `rent_obligations_tenancy_id_fkey` -> `tenancies(id) ON DELETE CASCADE` |
| Indexes | pkey, the unique key, `idx_rent_obligations_due (status, due_date)` |
| RLS | enabled, not forced, owner `postgres`. Policies: `rent_obligations_admin_manage` (ALL, `is_admin()`), `rent_obligations_read_parties_admin` (SELECT, `can_access_tenancy(tenancy_id)`) |
| Privileges | **`anon`, `authenticated` and `service_role` have no table privilege at all** (select/insert/update/delete all false). The two policies are therefore unreachable; every client read goes through security-definer RPCs. |
| Triggers | only `trg_rent_obligations_updated_at` (`set_updated_at()`). No notification trigger, no status guard. |
| Data | **0 rows** |

### 1.2 Tenancy columns that define the schedule
`tenancies`: `agreed_monthly_rent numeric(12,2) not null (>0)`, `rent_due_day smallint not null (1..28)`, `start_date date not null`, `expected_end_date date` (nullable, `>= start_date`), `actual_end_date date`, `status tenancy_status` (`proposed, pending_confirmation, active, ended, cancelled`), `conversation_id uuid` (nullable, `ON DELETE SET NULL`), `landlord_id`, `tenant_id`, `property_id`, `activated_at`, `ended_at`. Terms cannot change after setup today (TENANCY.md: amendments are later scope). One open tenancy per listing (`idx_one_open_tenancy_per_listing`).

Current "next due" (no payments involved):
- Client: `rentSchedule()` in `tenancy/models/TenancyCare.ts` and `nextScheduledRentDate()` in `TenancyWorkspace.ts`. Active tenancies only; `base = max(start_date, today in Manila)`; the next three dates `YYYY-MM-<rent_due_day>` that are `>= base` and `<= coalesce(actual_end_date, expected_end_date)`. No proration: a stay starting Nov 12 with due day 2 first falls due Dec 2.
- Server: `rentlease_tenancy_care.dates()` inside `get_tenancy_care` does the same, `limit 3`, and also returns up to 50 stored obligations (id, date, amount, status) and `obligationsLimited`.
- The Tenancy details rent card (`TenancyDetailsScreen.ts`) renders `Due on the Nth`, up to three `dueLabel(date)` rows and `RENT_NOTE` ("Payments are not tracked here yet"). Manage (Feature 2) shows only next due and the same disclaimer.

### 1.3 Who reads or writes `rent_obligations`
- **Only `public.get_tenancy_care(uuid,integer)` reads it** (hosted `pg_proc` source search; md5 `624c3bf0...`). Nothing writes it: no function, trigger, view, rule, cron job or Edge Function. `pg_cron` and `pg_net` are **not installed** (only `pg_stat_statements`), so no in-database scheduler exists.
- `reminder_sent_at` and `overdue_notified_at` columns exist but nothing uses them. No `rent_due` / `rent_overdue` notification has ever been created (0 rows of those types).
- Tenancy data now: 1 cancelled, 1 ended, 1 pending_confirmation, **0 active**.

### 1.4 Existing participant authorization and RPC patterns
- `public.can_access_tenancy(uuid, uuid default auth.uid())`: security definer, `search_path=public`, true for admins or either party. **Executable by `anon`** (known surprise; the unreachable read policy depends on it). The tenancy RPCs do **not** use it.
- The pattern the T1/T3/T4/T6 RPCs use (copy it): private schema per feature with all privileges revoked; `<schema>.relationship(p_id)` helper, security definer, `search_path=pg_catalog`; requires `READ COMMITTED` (25001); `auth.uid()` not null and `public.is_tier1_verified(auth.uid()) is true`; participant lookup, then `pg_advisory_xact_lock(hashtextextended(property_id::text,0))` (same property lock as every tenancy operation), then the tenancy row `FOR SHARE`; refusal is always `'Access unavailable'` 42501; per-operation receipts `(actor_id, operation_id) pk` with `input jsonb` compared on retry (`'Conflicting retry'` 22023); a second advisory lock on `hashtextextended(auth.uid()||operation_id,1)`; revision tokens (`care_revision uuid`, rotated by a before-update trigger) and `'... changed. Reload.'` 40001; `revoke all ... from public,anon,authenticated,service_role` then `grant execute ... to authenticated`; all public functions `security definer set search_path=pg_catalog`, owner `postgres`.
- Hosted drift fingerprints observed today (md5 of `prosrc`): `get_tenancy_care` `624c3bf0ce0f129f504c674330466c72`, `is_tier1_verified` `ddd2c8ed28b61e30e23e4f3ddefe4590`, `send_property_message` `b8b2b79bd7927b8919ed3508727dfb4c`, `rentlease_notifications.generate()` `08b686c7868662747ec9bf3f119c6177`.
- Notifications: `public.notifications` is written only through `rentlease_notifications.emit(recipient uuid, event text, typ notification_type, label text, kind text, target uuid)` (security definer, `on conflict (user_id,event_key) do nothing`). Triggers call it (`inapp_tenancy` on `tenancies`, `inapp_message` on `messages`, `inapp_*` on others). `notification_type` already contains `tenancy_update`, `rent_due`, `rent_overdue`, `new_message`. A notification with `kind='tenancy'` and the tenancy id already routes to Tenancy.

### 1.5 Writing to the tenancy conversation
- `public.send_property_message(p_conversation_id uuid, p_message_id uuid, p_body text) returns jsonb` (security definer, `search_path=''`): needs Tier 1, the caller to be a participant, conversation `open` (a confirmed earlier send with the same id is reconciled even if the thread later closed), body 1 to 4000 chars, inserts `messages(message_type='text')`. Idempotent on `p_message_id`.
- `messages` has no client table grants (insert/select false for `authenticated`). Triggers: `validate_message_sender` (sender must be a participant and the conversation `open`), `touch_conversation_after_message`, `inapp_message` (notifies the *other* participant with `new_message`).
- `message_type` enum is `text, image, file, system`. `messages_have_content` allows a `system` message with no body, and `generate()` skips notifications for `system`. **The app has no renderer for `system` messages** (no `'system'` handling in `messaging-viewing` or `shared`), so a system message would show as a blank or odd bubble. Use `text`.
- `tenancies.conversation_id` can be null (`ON DELETE SET NULL`) and a conversation can be `closed`/`blocked`; the chat message must therefore be best-effort.

### 1.6 Surprises
1. No role has table privileges on `rent_obligations`; its two RLS policies are dead. This is good (nothing to revoke), but the "RLS plan" is really a *no-grant* plan.
2. Table is empty and only `get_tenancy_care` reads it. When rows appear, `TenancyCarePanel` ("recorded obligations") and its `obligations` list will start showing them with raw statuses; the UI must be reconciled with the new ledger screen.
3. No scheduler exists (`pg_cron`/`pg_net` absent). A status job (`upcoming -> due -> overdue`) cannot run inside the database. The design derives those three states at read time instead.
4. `tenancy_id` FK is `ON DELETE CASCADE`, unlike most tenancy evidence (`RESTRICT`). A tenancy hard-delete (admin only) would delete the ledger. Any new history table must use `RESTRICT`.
5. No constraint ties `tenant_marked_paid_at` / `landlord_acknowledged_at` to the status, and nothing checks `due_date` against the tenancy dates or due day. Both are added by this design.
6. `can_access_tenancy` and `is_tier1_verified` remain anon-executable (audit surprise 2). Not used by the new RPCs; leave to Feature 5.
7. A `pending_confirmation` tenancy exists in live data; there is still no active tenancy to test on.
8. System messages are allowed by the database but not rendered by the app (see 1.5).

---

## 2. Design

### 2.1 How month rows are created: **virtual schedule, rows only on action**
`get_rent_ledger` *computes* the month list from the tenancy (start, end, due day, rent) and left-joins stored rows. A `rent_obligations` row is inserted only when someone acts on that month (mark paid, acknowledge, dispute), with `amount_due = agreed_monthly_rent` at that moment.

Why not create the full term at tenancy start:
- Open-ended tenancies (`expected_end_date` null) have no finite set of months.
- There is no scheduler, and patching `respond_tenancy_establishment` (a large drift-pinned function) to insert rows at activation adds risk and a rollback problem for no demo value.
- A pre-created `upcoming/due/overdue` row would need a job to keep its status true; a derived status cannot go stale.
- `UNIQUE(tenancy_id, due_date)` already makes on-demand inserts idempotent.

Why not "lazy materialize on every read": it makes a read write, takes locks for every viewer, and creates rows nobody acted on.

The month set returned: every scheduled due date `d` with `start_date <= d <= coalesce(actual_end_date, expected_end_date, +infinity)` and `d <=` the **horizon** = the first scheduled due date strictly after today (Manila). That reproduces the wireframe (Dec upcoming on top, Nov, Oct, Sep below). Page size 12, newest first, `p_offset` like `get_tenancy_care`.

Derived display status for a month with no stored row, or a stored `upcoming/due/overdue` row (the RPCs never store those three; they only ever store the paid/ack/dispute states):
- `upcoming`: `due_date > today + 3`
- `due`: `today >= due_date - 3 and today <= due_date`
- `past_due`: `today > due_date` (UI label "Past due", neutral amber, never "overdue" or "late")
The 3-day window is one constant in the function and is the first thing to change if the wording needs to be softer.

### 2.2 RPCs (exact signatures)
All `language plpgsql security definer set search_path=pg_catalog`, owner `postgres`, `revoke all ... from public,anon,authenticated,service_role; grant execute ... to authenticated`.

```
public.get_rent_ledger(p_tenancy_id uuid, p_offset integer default 0) returns jsonb
public.write_rent_ledger(p_tenancy_id uuid, p_operation_id uuid, p_action text,
                         p_due_date date, p_revision uuid default null) returns jsonb
```
One write function with an action (the same shape as `write_tenancy_care` and `write_tenancy_lifecycle`) instead of three public entry points; fewer grants, one drift fingerprint. `p_action in ('mark_paid','acknowledge','dispute')`; `'waive'` is reserved and rejected (22023) in v1.

`get_rent_ledger` returns:
```
{ tenancyId, tenantId, landlordId, status, today, monthlyRent, dueDay,
  rows: [ { dueDate, amount, storedStatus|null, displayStatus, revision|null,
            tenantMarkedPaidAt|null, landlordAcknowledgedAt|null, changedAt|null,
            canMarkPaid, canAcknowledge, canDispute } ],
  hasMore,
  awaiting: { dueDate, revision } | null }      -- the newest row the landlord must answer
```
`can*` flags are computed server-side for `auth.uid()` so the View never encodes the transition rules. `displayStatus` values: `upcoming, due, past_due, tenant_marked_paid, landlord_acknowledged, disputed, waived`.

`write_rent_ledger` returns `{ dueDate, status, revision }`. It never writes chat (decision 1).

**Status progression job: none.** `upcoming -> due -> past_due` is derived at read time (2.1). `reminder_sent_at`, `overdue_notified_at` stay unused. If an overdue push/in-app reminder is wanted later it needs a scheduler (Edge Function on a schedule), which is out of scope for Nov 23.

### 2.3 Transitions
"Effective status" = stored status, or the derived one when there is no row / a stored upcoming-due-overdue row.

| Effective status | Action | Who | Result | Notes |
| --- | --- | --- | --- | --- |
| upcoming, due, past_due (no row) | `mark_paid` | tenant | `tenant_marked_paid`, `tenant_marked_paid_at = now()` | inserts the row; `p_revision` must be null |
| `tenant_marked_paid` | `acknowledge` | landlord | `landlord_acknowledged`, `landlord_acknowledged_at = now()` | wireframe "Mark received" |
| `tenant_marked_paid` | `dispute` | landlord | `disputed`, chat message written | wireframe "Not received"; tenant timestamp kept |
| `disputed` | `mark_paid` | tenant | `tenant_marked_paid` (new statement), acknowledged timestamp cleared | revision required; unlimited, each is one operation |
| `disputed` | `acknowledge` | landlord | `landlord_acknowledged` | the landlord found it |
| upcoming, due, past_due (no row) | `acknowledge` | landlord | `landlord_acknowledged` with `tenant_marked_paid_at` null | cash paid, tenant never tapped. **Cuttable.** |
| `landlord_acknowledged` | any | anyone | refused (22023 "Already confirmed") | final in v1 |
| no row / upcoming-due-past_due | `dispute` | anyone | refused | nothing to dispute until the tenant says paid |
| any | `mark_paid` | landlord, `acknowledge`/`dispute` by tenant | refused 42501 | role check |

Other rules (all checked in `write_rent_ledger`):
- The tenancy must be `active` or `ended` (a landlord can still confirm the last month after it ends); never `proposed`, `pending_confirmation` or `cancelled`.
- `p_due_date` must be a real schedule date: `start_date <= d <= end`, `extract(day from d) = rent_due_day`, and `d <=` the horizon. A tenant cannot mark a month beyond the next upcoming one.
- Row exists: `p_revision` must equal `ledger_revision` (40001 "Rent record changed. Reload.").
- **What happens on dispute:** status `disputed`; nothing is deleted; the landlord's one-line neutral message goes to the chat; the tenant gets a `new_message` notification from the existing message trigger; the ledger shows "Samuel marked paid Nov 1" and "Landlord asked to check" (date from `updated_at`).
- **Can the tenant revise after dispute:** yes, by tapping "I've paid" again (a new statement, new revision). The landlord can then confirm or dispute again. No automatic escalation; no money logic.

### 2.4 Idempotency, locking, drift guards
- **Idempotency:** `rentlease_rent_ledger.receipts (actor_id uuid, operation_id uuid, input jsonb, result jsonb, created_at, pk(actor_id, operation_id))`, immutable (update/delete trigger raises). Retry with the same input returns the stored result; different input raises `'Conflicting retry'` 22023. `input` = `{tenancy, action, due_date, revision}`. The chat message is not part of the RPC (decision 1); the client sends it with its own message id through the existing chat service, so a retried send is reconciled by `send_property_message` itself.
- **Locking order (same as T1/T3/T6):** `READ COMMITTED` check, identity, property advisory lock `hashtextextended(property_id::text,0)`, tenancy `FOR SHARE`, operation lock `hashtextextended(auth.uid()||operation_id,1)`, then `insert ... on conflict (tenancy_id,due_date) do nothing` and `select ... for update` on the row.
- **Revision:** new column `rent_obligations.ledger_revision uuid not null default gen_random_uuid()` plus a before-update trigger that rotates it (same as `care_revision`). The table is empty, so the ALTER is safe.
- **Constraints added (empty table, no `NOT VALID` needed):** `rent_obligations_status_timestamps` ties timestamps to statuses (`tenant_marked_paid` needs `tenant_marked_paid_at`; `landlord_acknowledged` needs `landlord_acknowledged_at`); no other existing column or constraint is changed.
- **Immutable events (recommended, cuttable):** `rentlease_rent_ledger.events (id, obligation_id references rent_obligations on delete restrict, tenancy_id, actor_id, action, from_status, to_status, created_at)` written by `write_rent_ledger`, update/delete blocked. This is the "records what each person says" evidence and survives a dispute/revision cycle; without it only the latest statement per month is kept.
- **Drift guards at the top of the migration (abort on mismatch):** `rent_obligations` columns/types/defaults, enum labels in order, constraint names, RLS enabled, no `anon/authenticated/service_role` table privilege, only the `updated_at` trigger present; md5(prosrc) of `public.is_tier1_verified(uuid)`, `public.send_property_message(uuid,uuid,text)` and the signature of `rentlease_notifications.emit`; `public.get_tenancy_care` md5 (it reads this table and is **not** replaced); tenancy write grants absent and required tenancy triggers present (same checks as the T6 migration); no pre-existing `public.get_rent_ledger` / `public.write_rent_ledger`; and `count(*) = 0` on `rent_obligations` (stop and review if rows have appeared). **No existing function is replaced, so no anchor-replace patch is needed.**

### 2.5 Grants and RLS plan
- Functions: `revoke all ... from public,anon,authenticated,service_role`, `grant execute ... to authenticated` only. Private schema `rentlease_rent_ledger`: `revoke all` on the schema and all its tables/functions from every client role; RLS enabled on its tables, no policies.
- `rent_obligations`: **no RLS change and no grants.** Keep the existing policies untouched (defense in depth; they cannot be reached because no table privilege exists). Add a guard asserting the no-privilege state so a later grant would break the deploy.
- Authorization is inside the RPC: participant of the tenancy, active Tier 1, role-specific action. The new RPCs do not call `can_access_tenancy`, so Feature 5's planned revoke of its anon execute does not affect them.

### 2.6 Exact neutral chat message
Sent **by the client** after the dispute RPC succeeds, as the landlord's own words (type `text`, sender = the landlord, through the existing chat service and `send_property_message`), because the app cannot render `system` messages and the landlord is the one speaking. The View must show this exact text in the confirmation before it is sent. A failed send shows Retry; the dispute stays recorded.

> Rent ledger: I can't see the rent for Nov 2 on my side yet. Could you please check it? It may just be a delay. Thank you.

`Nov 2` is `to_char(due_date, 'Mon FMDD')`. Fixed text, no free input, no names, no amounts, no accusation. If the tenancy has no open conversation, or the send fails, the dispute is still recorded and the screen offers Retry or tells the landlord to contact the tenant directly. The RPC is unaffected.

### 2.7 Notifications (CUT from v1, not implemented)
Emitted inside `write_rent_ledger` through `rentlease_notifications.emit(...)`, kind `'tenancy'`, target the tenancy id, event key `'rent:'||obligation_id||':'||new_revision` (so each revision notifies once):
- `mark_paid` -> landlord, `tenancy_update`, "Rent update".
- `acknowledge` -> tenant, `tenancy_update`, "Rent update".
- `dispute` -> the chat message already notifies the tenant (`new_message`); `tenancy_update` only when the message was skipped.
No overdue or due-soon notifications (no scheduler).

### 2.8 Migration, backup, rollback
- File name when written: `supabase/migrations/<timestamp>_rent_ledger.sql`, preceded by `begin;` and drift guards, ending with `commit;`.
- **Backup first:** `scripts/predeploy-backup/New-PredeployBackup.ps1` into `C:\RentLease-Backups\` (include `rent_obligations`, `tenancies`, `conversations`, `messages`, `notifications`, function definitions and the migration history). A bare `.sql` file there is not a backup.
- **Apply:** `supabase db query --linked -f <file>`, then `supabase migration repair --status applied <version>`. Never `db push`. Then Claude (chat) re-verifies the hosted state read-only (privileges, md5 of the two new functions, no anon execute, receipts/events immutable).
- **Rollback script** `supabase/test-support/rent_ledger_rollback.sql` (data-retaining, like T3/T6): revoke execute on and drop `public.get_rent_ledger` and `public.write_rent_ledger`; leave `rentlease_rent_ledger` tables, the `ledger_revision` column and any rows (evidence). A second block, allowed only when `rent_obligations`, receipts and events are all empty, also drops the schema, the trigger, the constraint and the column. Chat messages already written stay (they are conversation history).

---

## 3. What the frontend needs

New in `src/features/tenancy/` (the ledger belongs to Tenancy; Manage reaches it through the existing deep link):
- `models/RentLedger.ts`: parser/validator for the two RPC results, `displayStatus` -> `Chip` (reuse `StatusChip`: upcoming blue "Upcoming", due blue "Due", past_due amber "Past due", tenant_marked_paid amber "Confirm" for the landlord and "Waiting" for the tenant, landlord_acknowledged green "Received", disputed amber "Checking"), row copy ("Samuel marked paid Nov 1", "Received Oct 2"), the awaiting banner text, the fixed chat text for display, `ordinal due day`.
- `services/rentLedgerService.ts`: `read(actor, tenancyId, offset, signal)` and `write(actor, op, signal)` over the two RPCs with the identity check, error mapping (22023, 40001, 42501 -> plain sentences), same shape as `tenancyCareService`.
- `viewModels/rentLedgerWorkflow.ts` + `useRentLedgerViewModel.ts`: load/refresh, one pending operation with a fixed `operation_id` retried unchanged after an unknown outcome, double-tap guard, account and generation guards; confirmation state for "Not received" (shows the exact message).
- `views/RentLedgerView.tsx` ("Rent · {title}"): ledger card, awaiting banner with "Mark received" / "Not received" (landlord) or "I've paid" on the due row (tenant), the "records what each person says" note. Add `'rent'` to `TenancyDetailsPanel` and to `AppWorkspace.tenancy.open.panel`.

Screens that switch on:
- **Feature 1, Tenancy details rent card (A5):** replace `RENT_NOTE` and the schedule rows with "Next due" plus a primary "I've paid" for the tenant on the due/next row, and "Open rent ledger" for both; a "Confirm" row for the landlord when something awaits. Remove the "Payments are not tracked here" wording.
- **Feature 2, Manage occupied Rent card (C2):** show the next row with its status chip and "Mark received" / "Not received" when `awaiting` is set; add a `rent` item to **Needs you** ("Samuel says rent for Nov was paid", chip "Confirm", opens the ledger panel). This needs one `get_rent_ledger` read per active tenancy in `tenancyActivityService` (already bounded to 12) and a `rent` kind in `needsYou` / `ManagedFacts`.
- **`TenancyCarePanel`:** its "recorded obligations" list must be hidden or pointed to the ledger so there are not two lists.
- Tests: model parsing and chips, workflow (retry same operation, stale revision, double tap), service error mapping, `needsYou` rent item, the exact chat text, the removed disclaimers. SQL checks the way T3/T6 did (isolated Postgres with the captured tenancy triggers).

---

## 4. Risks, and what to cut (demo Nov 23; today is Nov 16)

Risks:
- **No active tenancy exists** to test on; the two-account flow must be created first (a tenancy must be confirmed and activated; a future start date means it stays Upcoming).
- Chat message is attributed to the landlord; if that is not acceptable the only alternative is a `system` message, which needs a renderer in Chat (extra frontend work).
- Derived `past_due` wording and the 3-day window are product choices.
- Revision after dispute can ping-pong; there is no limit in v1.
- Existing tenancies that started before launch would show their earlier months as "Past due" (no data exists yet, so this is theoretical today).
- Backend deploy must follow the backup, `db query -f` and chat re-verification steps; that is roughly a half day of waiting on re-verification.

Cut order if time is short (each cut keeps the rule "records what each person says"):
1. Notifications (2.7); the chat message already notifies on dispute.
2. Events table (2.4); keep only the latest statement per month.
3. Landlord direct "Mark received" from upcoming/due/past_due (2.3).
4. Revision after dispute (tenant must wait for the landlord to confirm).
5. `waived` stays reserved; `reminder`/`overdue` columns stay unused (already out of scope).
6. Pagination beyond 12 months and the `hasMore` flag.
Must keep: `get_rent_ledger`, `write_rent_ledger` with `mark_paid`, `acknowledge`, `dispute`, receipts, revision, drift guards, no-anon grants, the ledger screen, and the Manage "Needs you" item.

Rough plan: migration + SQL checks + rollback 1.5 days, apply + re-verification 0.5 day, frontend 2.5 days, device two-account test 1 day, buffer 1 day.

## 5. Decisions (answered, see the top of this document)
1. Dispute message sent as the landlord's text (recommended) or a `system` message (needs a Chat renderer)?
2. "Past due" label and the 3-day "Due" window acceptable?
3. Allow the landlord to confirm a month the tenant never marked (cash)? Recommended yes.
4. Allow the tenant to revise after a dispute? Recommended yes.
5. Keep the events table and notifications in v1, or cut them first?
