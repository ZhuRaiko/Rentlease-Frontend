# In-app notifications

## Status - November 11, 2026

IMPLEMENTED LOCALLY / 12 focused frontend tests and 29 isolated SQL checks passed; final TypeScript/whitespace passed / hosted and Android RUNTIME-UNVERIFIED. Source baseline: master merge `7dc5d2c5dcf8d065b20dd684aeadc58aae56883c`, branch `feature/in-app-notifications`. New migration `supabase/migrations/20261111035305_in_app_notifications.sql` is PREPARED, NOT DEPLOYED. No production notification, schema or privilege was changed.

## Notification Center

The existing Discovery bell opens the real account-scoped Notification Center; it now has an unread badge, chronological persisted updates, explicit read/unread indicators and Philippine timestamps, mark all read, refresh/retry, honest empty/error states and 20-row keyset pagination. Unified tenant/landlord accounts use the existing Discovery tab to reach it. No new bottom tab or router. Root composition retains the center while opening the authorized conversation or tenancy details; Back refreshes the center. A report resolution opens the reporter's own report-status workspace. Viewing/reservation alerts open their exact conversation, which owns those existing workflows. Maintenance/rent alerts open tenancy details with existing rent/maintenance actions. No resource authorization is inferred from receiving an alert.

`App.tsx` owns one account-scoped notification workflow. `InAppNotification.ts` validates narrow projections; `inAppNotificationService.ts` verifies actual Auth identity before and after RPC calls; `inAppNotificationWorkflow.ts` owns guarded loads, writes and destinations; `useInAppNotifications.ts` owns foreground refresh and 30-second foreground polling. Views contain no backend clients. Account changes replace the workflow, clear badges and mask previous selections immediately. Transport has abort/disposal and 15-second timeout guards. Missing RPCs show a backend-update message, never sample success.

Read markers are idempotent, monotonic and persisted server-side. Unknown outcomes retain the exact ID/cutoff in memory for explicit retry; competing operations are blocked until reconciliation. Restart rereads authoritative server state rather than replaying actions offline. Mark all uses the last server cutoff and excludes ordinary newer events. Pagination represents a live read sequence rather than an exhaustive transactional UI snapshot; refresh starts at the newest page. Read/refresh failures do not fabricate a zero badge. Reconnect is handled by explicit retry, foreground refresh and polling; no Realtime publication requirement or background polling.

## Storage and event generation

Reuse `public.notifications`; no competing notification store. Add nullable `event_key`, unique `(user_id,event_key)` for generated events and owner/unread paging indexes. Existing notifications remain untouched; legacy unkeyed notifications are not shown or counted by this new contract, avoiding an implicit migration of arbitrary historical payloads. No old business events are backfilled.

Three new authenticated-only, postgres-owned SECURITY DEFINER RPCs use `pg_catalog` search paths: `get_in_app_notifications`, `read_in_app_notifications`, `get_in_app_notification_target`. All require an active Tier 1 actual caller and exact recipient ownership; Admin role does not grant another account's inbox. Direct client writes are absent, and an additive restrictive raw-table policy protects against accidental future broad grants. No client recipient parameter or creation RPC exists. The target resolver independently checks current conversation/tenancy participant or report-reporter binding, returning null for deleted/inaccessible resources. Destination screens retain their own authorization.

Private, client-inaccessible trigger helpers generate generic content in the same transaction as committed source actions:

| Event | Authoritative source | Recipient / target |
| --- | --- | --- |
| New message | `messages` INSERT, excluding system/deleted messages | Actual conversation counterpart / conversation |
| Viewing request/decision/time change | `viewing_schedules` INSERT or meaningful UPDATE, keyed by revision | Other actual participant / conversation |
| Reservation update | `rentlease_reservations.events` INSERT | Other participant derived from actual reservation / conversation |
| Tenancy proposal/confirmation/lifecycle | `tenancies` INSERT or status/confirmation change | Other participant (both for actorless system change) / tenancy |
| Maintenance request/response | `maintenance_updates` INSERT | Other actual tenancy participant / tenancy |
| Rent reminder | Existing `rentlease_tenancy_care.reminders` INSERT | Explicit requesting actor / tenancy |
| Reporter-visible resolution | `rentlease_reporting.events` terminal decision INSERT | Actual reporter only / own reports |

Stable message/history/operation IDs or source revisions deduplicate delivery; transaction rollback leaves no notification. Receipted business retries do not insert new source events. Generic text contains no message bodies, attachment paths, report reasons/private notes, legal names, documents or coordinates. No notification modifies a source lifecycle, listing availability, ownership, verification or money. Unexpected trigger/storage failures abort the source transaction rather than silently invent success; rollout must verify actual source contracts and monitor failures.

## Rollout, limits and acceptance

Requires separately authorized production preflight/recovery backup and isolated deployment of only this migration after existing Messaging/Viewing, Reservations, T1, T3/T4 and Reporting contracts are confirmed. Existing historical filenames must not be replayed. Prepared types describe local additions, not live availability. Data-retaining withdrawal guidance: `supabase/test-support/in_app_notifications_rollback.sql` removes only the seven new generation triggers and withdraws three RPCs, retaining stored updates, event keys and indexes. Hosted restore/withdrawal is untested.

No FCM, Expo push registration, background delivery, cron, automatic rent reminder scheduling, SMS or email. Existing explicit Check rent reminder still controls reminder creation; no paid/unpaid/overdue state is invented. Legacy push-permission/fixture sources remain disconnected compatibility previews, not a working permission or delivery promise. No review/verification/listing notifications were fabricated beyond the requested source events. In-app changes appear on the next refresh, not instant cross-device delivery. Report destinations show the own-status list rather than selecting one case automatically.

Manual Android after backend rollout: two authorized accounts send a message, propose/decide viewing and reservation, propose/confirm tenancy, create/respond to maintenance, explicitly check a rent reminder, and independently resolve a report. Verify correct recipient only, generic content, badge/read state after reopening/restart, load older/refresh, mark-all with a newer event, offline retry, account switching, nested Back and deleted/inaccessible destinations. Confirm normal source actions remain unchanged.

[Implementation history](../implementation-reports/phases/NOTIFICATIONS_IMPLEMENTATION.md) ? [Backend ledger](../implementation-reports/database/NOTIFICATIONS_BACKEND_LEDGER.md)
