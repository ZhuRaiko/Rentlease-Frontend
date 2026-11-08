# Tenancy workspace

November 7, 2026: IMPLEMENTED / AUTOMATED-TESTED, uncommitted after Chat checkpoint 946d51908ca4af901790542b640bd455364f2156. Physical Android acceptance remains pending.

The Tenancy bottom tab opens a read-only real-data workspace for the signed-in account. Upcoming Rentals contains effective approved reservations awaiting tenancy setup. Active Rentals contains actual `active` tenancies; Rental History contains actual `ended` records. Proposed/pending-confirmation/cancelled tenancies are not mislabeled active or ended. There are no fixtures, payments, automatic tenancy creation or lifecycle writes. Maintenance requests remains a link to the existing preview; Back and its Tenancy tab return here.

`src/features/tenancy/views/TenancyWorkspaceView.tsx` renders the ViewModel's sections and consent-protected public counterpart identities. `useTenancyWorkspaceViewModel.ts` handles refresh, cancellation, account masking and reservation expiry deadlines. `tenancyWorkspaceService.ts` reads existing participant reservation RPCs and an explicitly participant-filtered, bounded `tenancies` projection, including RLS-visible listing titles. Missing historical listing titles use a neutral unavailable label. No private coordinates or legal names are selected.

Read-only live catalog verification confirms authenticated SELECT, no anonymous SELECT, enabled RLS and participant/Admin policies on tenancies. The app additionally scopes both actual participants, including when an Admin identity is supplied. No backend change is required. Safe loading caps are 1,000 records per kind; incomplete histories show an error rather than fabricated empty results. Refresh and foreground reentry read authoritative status; expiry uses the reservation server clock and a single deadline timer.

No reservation-to-tenancy foreign key exists in the consumed contract. A matching established (`active`/`ended`) tenancy on the same property, same participants and overlapping period suppresses the reservation handoff. This is relationship matching, not proof of an explicit conversion operation. Offset reads are not a transactional snapshot. Full tenancy lifecycle, maintenance persistence and automatic request Realtime updates remain outside scope.

338 focused tests, TypeScript and whitespace pass, including real tenancy versus reservation separation, ownership/requester scoping, cancellation, stale accounts and UC-08/UC-09 regressions. Physical Android navigation/refresh/keyboard and two-account acceptance remain unverified.

Implementation history: [Messaging/UC-09](../implementation-reports/phases/MESSAGING_VIEWING_IMPLEMENTATION.md). Backend evidence: [ledger](../implementation-reports/database/MESSAGING_VIEWING_BACKEND_LEDGER.md). These shared UC-09 records track this coordinated read-only integration.
