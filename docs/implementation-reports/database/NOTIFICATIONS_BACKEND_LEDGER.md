# Notifications backend ledger

## November 11, 2026 - READ_ONLY_INSPECTION and local preparation

Project cxfsbwbwmwmgtqfonqth. Read-only metadata queries inspected notifications/source columns and enums, existing table grants/RLS policies, source trigger definitions, notification-related function inventory, private reminder columns, reservation event columns, maintenance history columns and respond_rental_reservation definition. No notification/message/report contents, profiles, private locations or secret values were selected. Reporting deployment was visible through existing source triggers; the developer separately reports hosted version 20261111031731. No deployment was performed here.

Observed notifications has id/user_id/type/title/body/data/read_at/created_at; grants only to postgres, owner/Admin policies and no generation or app-facing notification RPC. Source names confirmed: public.messages, viewing_schedules, rental_reservations, tenancies, maintenance_requests/maintenance_updates, rentlease_reservations.events, rentlease_tenancy_care.reminders, rentlease_reporting.events. Existing explicit reminder uniqueness and receipted workflow writes are reused, not replaced. The actual reservation decision function records a unique operation event after the guarded state update; prepared notification generation consumes that event. Metadata checks are not caller-JWT or hosted transaction acceptance.

Prepared migration 20261111035305_in_app_notifications.sql is local only. Reuses public.notifications, adds event key/indexes and additive restrictive raw-table RLS, three authenticated recipient-bound RPCs and seven generation triggers with private helpers. No source RPC replacements or trigger removals. Rollback guidance withdraws new generation/entry points, retaining records. No hosted rollback/restore, privilege change or write-based smoke test.

No permanent live backend mutation was performed in this phase. No production cleanup required. Isolated SQL test data is synthetic and container removal is required. Fresh predeployment compatibility baseline and restricted recovery backup, explicit migration authorization, then frontend release and two-account Android acceptance remain separate steps.

[Living feature](../../features/NOTIFICATIONS.md) ? [History](../phases/NOTIFICATIONS_IMPLEMENTATION.md)


Final local evidence: 12 focused frontend tests passed / 0 failed, and 29 isolated PostgreSQL checks passed / 0 failed, including concurrent event deduplication and monotonic read retries. Disposable network-disabled container removal confirmed. Final TypeScript and git diff --check passed. The initial TypeScript check passed; final type declarations and UI test additions justified one final check. No broad regression suite, hosted writes, deployment, commits/pushes, Expo/ADB/builds or device access. .vscode remains untouched.


## November 11, 2026 - deployment preparation

Fresh read-only production metadata confirmed 37 migrations, notifications RLS with postgres-only table privileges, existing notification enum labels and only primary-key/recipient-profile CASCADE FK constraints. All referenced columns on the seven event sources exist with the expected UUID/text/integer/timestamp types. Inspected source trigger inventory and actual message/viewing validation plus maintenance actor/history functions: participant binding precedes notification generation, maintenance history retains real actor IDs, and no existing trigger is replaced. Expected recipient IDs remain bound to existing profile-backed relationships; generic nonnull labels/body/data satisfy notification constraints. Event-key uniqueness safely absorbs duplicate delivery. No compatibility correction was necessary; reused the passed 29 isolated SQL checks and 12 frontend cases without broad reruns. Unexpected storage/database exceptions deliberately roll back the source transaction, not silently lose alerts; live end-to-end behavior remains unverified.

Source checkpoint/push and a fresh restricted scoped recovery backup are authorized for this preparation only. No permanent live backend mutation was performed in this phase. Deployment remains separate. Backup receipts and recovery limits are retained outside Git under C:/RentLease-Backups.
