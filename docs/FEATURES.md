# Feature cohorts

Status describes frontend implementation, not live runtime validation. Detailed living docs own feature-specific behavior. `Scaffolded` means a feature location exists without an implemented workflow.

| Feature | Current status | Living documentation |
| --- | --- | --- |
| Authentication & Profiles | IMPLEMENTED baseline and Auth event synchronization; RUNTIME-UNVERIFIED | [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) |
| User Verification | Tier 2 submission/upload/metadata USER-REPORTED development-build PASS; Tier 2 rejected correction/incomplete-upload recovery, Tier 3 flow and shared fullscreen zoom IMPLEMENTED/AUTOMATED-TESTED, Android RUNTIME-UNVERIFIED | [User Verification](features/USER_VERIFICATION.md) |
| Property & Listing Management | Phase 1 form/RPC foundation IMPLEMENTED/AUTOMATED-TESTED; separate location integration blocks app save; Android RUNTIME-UNVERIFIED. Listings/media/publication remain PREVIEW/DEFERRED | [Property setup and boundaries](ROUTES.md#phase-1-physical-property-creation-2026-10-23) |
| Search & Discovery | PREVIEW UI; optional account-setup preferences and session-local editing IMPLEMENTED, Android RUNTIME-UNVERIFIED; backend search/recommendations/maps/GPS DEFERRED | [Routes and preview boundary](ROUTES.md#search--discovery-feature-states) |
| Property Recommendations | Scaffolded | Not yet created |
| Rental Price Estimation | PREVIEW UI; FastAPI requests/persistence DEFERRED | Not yet created |
| Messaging & Viewing Schedules | PREVIEW UI; Realtime, uploads and persistence DEFERRED | Not yet created |
| Tenancy Management | Scaffolded; current Tenancy tab opens Maintenance preview | Not yet created |
| Maintenance Requests | PREVIEW UI; persistence/uploads/notifications DEFERRED | Not yet created |
| Ratings & Reports | PREVIEW UI; publication/moderation/uploads/persistence DEFERRED | Not yet created |
| Admin & Moderation | Tier 2 queue/private viewing/approval USER-REPORTED development-build PASS; new zoom and Tier 3 compatibility AUTOMATED-TESTED, Android RUNTIME-UNVERIFIED; non-image viewing DEFERRED; other moderation PREVIEW | [Admin Verification](features/ADMIN_VERIFICATION.md) |
| Notifications | PREVIEW UI; device permission/push delivery/persistence DEFERRED | Not yet created |

Actual screen identifiers and preview reachability are recorded in [ROUTES.md](ROUTES.md). Architecture and feature isolation remain in [ARCHITECTURE.md](ARCHITECTURE.md). No additional feature documents are created merely to populate an index.
