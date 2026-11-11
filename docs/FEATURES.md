# Feature cohorts

Status describes frontend implementation, not live runtime validation. Detailed living docs own feature-specific behavior. `Scaffolded` means a feature location exists without an implemented workflow.

| Feature | Current status | Living documentation |
| --- | --- | --- |
| Authentication & Profiles | IMPLEMENTED baseline and Auth event synchronization; RUNTIME-UNVERIFIED | [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) |
| User Verification | Tier 2 submission/upload/metadata USER-REPORTED development-build PASS; Tier 2 rejected correction/incomplete-upload recovery, Tier 3 flow and shared fullscreen zoom IMPLEMENTED/AUTOMATED-TESTED, Android RUNTIME-UNVERIFIED | [User Verification](features/USER_VERIFICATION.md) |
| Property & Listing Management | Real property-centered My Listings, clean Post, two-page Property -> Listing Details composer, controlled amenities, server-aligned completeness and Phases 1-5 IMPLEMENTED / AUTOMATED-TESTED; Android physical creation user-reported RUNTIME-VERIFIED; repaired composer/photos/draft/portfolio RUNTIME-UNVERIFIED. Map confirmation partially user-verified; 360 DEFERRED | [Property & Listing Management](features/PROPERTY_LISTING_MANAGEMENT.md) |
| Search & Discovery | Manual city/barangay search, server filters/sort/pagination, real details/photos/amenities and independent GPS proximity IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED; maps/saved/recommendations DEFERRED | [Search & Discovery](features/SEARCH_DISCOVERY.md) |
| Property Recommendations | Deterministic content ranking over bounded real listing reads; public Tier 2 signal unavailable; Android pending | [Recommendations](features/PROPERTY_RECOMMENDATIONS.md) |
| Rental Price Estimation | Phase 2A/B deployed; owner Android inference and compact asking-rent guidance verified; non-owner acceptance pending, coordinates disabled | [Price Estimation](features/RENTAL_PRICE_ESTIMATION.md) |
| Messaging, Viewing & Reservations | UC-08 RPC/Realtime metadata DEPLOYED; Android acceptance pending. UC-09A viewing and UC-09B reservations DEPLOYED / read-only LIVE-VERIFIED. Android RUNTIME-UNVERIFIED. Payments/automatic tenancy/uploads excluded. | [Messaging, Viewing & Reservations](features/MESSAGING_VIEWING.md) |
| Tenancy Management | Wireframe dashboard and real upcoming/active/history reads; T1 backend deployed 20261110062844; frontend release and Android acceptance pending | [Tenancy](features/TENANCY.md) |
| Maintenance Requests | PREVIEW UI; persistence/uploads/notifications DEFERRED | Not yet created |
| Ratings & Reports | T7A reviews IMPLEMENTED/TESTED locally; moderation backend PREPARED, native/hosted acceptance pending. Property/user reporting implemented locally; backend prepared, not deployed | [Ratings and Reviews](features/RATINGS_REVIEWS.md) |
| Admin & Moderation | Tier 2 queue/private viewing/approval USER-REPORTED development-build PASS; new zoom and Tier 3 compatibility AUTOMATED-TESTED, Android RUNTIME-UNVERIFIED; non-image viewing DEFERRED; other moderation PREVIEW | [Admin Verification](features/ADMIN_VERIFICATION.md) |
| Notifications | PREVIEW UI; device permission/push delivery/persistence DEFERRED | Not yet created |

Actual screen identifiers and preview reachability are recorded in [ROUTES.md](ROUTES.md). Architecture and feature isolation remain in [ARCHITECTURE.md](ARCHITECTURE.md). No additional feature documents are created merely to populate an index.

Reporting details and deployment limits: [Reporting and moderation](features/REPORTING_MODERATION.md).
