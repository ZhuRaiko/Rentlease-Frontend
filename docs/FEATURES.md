# Feature cohorts

Status describes frontend implementation, not live runtime validation. Detailed living docs own feature-specific behavior. `Scaffolded` means a feature location exists without an implemented workflow.

| Feature | Current status | Living documentation |
| --- | --- | --- |
| Authentication & Profiles | IMPLEMENTED baseline and Auth event synchronization; RUNTIME-UNVERIFIED | [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) |
| User Verification | IMPLEMENTED local document-selection/private upload foundation; Tier 2/3 submissions/status workflows DEFERRED; legacy UI disconnected | [User Verification](features/USER_VERIFICATION.md) |
| Property & Listing Management | PREVIEW UI; persistence, uploads and maps DEFERRED | Not yet created |
| Search & Discovery | PREVIEW UI; backend search, maps, GPS and proximity integration DEFERRED | Not yet created |
| Property Recommendations | Scaffolded | Not yet created |
| Rental Price Estimation | PREVIEW UI; FastAPI requests/persistence DEFERRED | Not yet created |
| Messaging & Viewing Schedules | PREVIEW UI; Realtime, uploads and persistence DEFERRED | Not yet created |
| Tenancy Management | Scaffolded; current Tenancy tab opens Maintenance preview | Not yet created |
| Maintenance Requests | PREVIEW UI; persistence/uploads/notifications DEFERRED | Not yet created |
| Ratings & Reports | PREVIEW UI; publication/moderation/uploads/persistence DEFERRED | Not yet created |
| Admin & Moderation | Backend-loaded Admin role gates entry; verification queue/review and moderation content remain PREVIEW, backend workflow DEFERRED | Verification boundary: [User Verification](features/USER_VERIFICATION.md) |
| Notifications | PREVIEW UI; device permission/push delivery/persistence DEFERRED | Not yet created |

Actual screen identifiers and preview reachability are recorded in [ROUTES.md](ROUTES.md). Architecture and feature isolation remain in [ARCHITECTURE.md](ARCHITECTURE.md). No additional feature documents are created merely to populate an index.
