# Admin Audit tab redesign (list and entry screen)

Scope: presentation and wiring only (`src/features/admin-moderation/`). No backend change: it reads `get_admin_audit_log` exactly as applied on 2026-11-13. Source design: `rentlease_audit_wireframe.html`.

## What changed

- **List:** day-grouped (Today, Yesterday, then the date, Manila time) tappable cards (72dp minimum): outcome icon, headline, subject line, one-line reason, outcome pill, time, chevron. Filter chips scroll horizontally on one row (48dp). "Load more" appends the next page by offset (rows already shown = offset; rows are de-duplicated by id because new entries shift older ones down). Empty and error states use the shared `AdminOperationError` message. At 1.3x text and above the pill and time move under the copy.
- **Entry screen (`auditEntry`):** hero (icon, headline, outcome pill, exact time), What happened, Reason given, Decided by, an optional Open report / submission / review button, and collapsed IDs. It uses only fields the RPC already returns. A row with no value is hidden.
- **One mapper:** `models/AuditPresentation.ts` (tests in `tests/auditPresentation.test.ts`). "Admin xxxxxxxx" becomes "Administrator"; the short id appears only in the entry screen as "Admin reference".
- **Deep links:** shown only when the target is in data the session already loaded (reports list, verification queue, reviews list for the current status filter). Back returns to the entry, then to the list with the same rows and filter (the list is not reloaded on return).
- **Not shown (needs backend):** applicant name, report target, actor id.
- **Fixed during review:** a return from the entry reloaded nothing when the rows had been lost, leaving an empty list; the skip now applies only when rows are loaded. Hero pill was left-aligned; Open report button touched the card above it.

## Evidence (emulator-5554, 1080x2400; 100% is density 420 / font 1.0, "320dp/150%" is density 540 / font 1.5; settings restored)

`admin-audit-redesign-screenshots/`: `live-*` are the real app against the hosted project (one real entry); `sample-data-*` use a temporary in-memory service with invented entries (30 rows, to see day groups, Load more and every outcome tone). That service was removed (the file is byte-identical to before, md5 verified). Not verified: TalkBack, dark theme, tablet, an Open submission or Open review deep link (no such target on the device), Android hardware Back from every path, the missing-entry spacing fix on a device.
