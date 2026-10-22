# RentLease experimental interface design

## Scope and authority

Phase 1 refinement, 2026-10-23, on feature/ui-improvements. The user's RentLease App Showcase is the primary visual direction: a friendly Filipino property marketplace with subtle neo-brutalist character. Refine Discovery, property details, Profile, Verification and Admin dashboard only. Existing architecture, ViewModels, real content and actions remain authoritative. Other screen layouts await Phase 2 approval. Shared primitives reach their existing consumers.

## Visual balance

Aim for 75-80% approachable marketplace and 20-25% restrained structure. Favor photography, clear prices, readable names and practical next steps. Use confidence through hierarchy, not thick framing. No decorative graphics added to fill space, no hard-offset shadows, no new fonts or libraries.

## Tokens and shared recipes

Use src/shared/theme exports. ui.ts retains panel, control, rule, pageTitle, sectionTitle, body and supporting recipes. Panel borders are 1dp in outline (#DCE5DD), with 12dp panel corners and no heavy bottom edge. Controls use 10dp corners, controlBorder (#7D9383), 48dp minimum targets and content-driven heights. Canvas is warm-white #F7F9F5; ink is #172C27. Existing primaryAction green (#32743C) remains the brand/action color. Semantic success, warning and error colors remain distinct. Ordinary navigation icons stay neutral.

Keep Roboto. Page titles are 22dp/700 with 28dp line height; section headings 17dp/600 with 23dp line height; body 15dp/22dp and supporting copy 13dp/20dp. Prices, property names and important results receive stronger emphasis; routine labels do not compete. Profile name is 20dp/26dp. Default font scaling and text wrapping remain enabled.

## Representative compositions

- Discovery: softly bordered feed cards; compact landlord identity; property photo before caption; more-images overlay replaces the repeated thumbnail strip while retaining its existing View listing destination; unchanged captions, rental values, scores and actions. Price/location/match/rating remain easy to scan.
- Property details: image-led hero, existing Back/save/Close/gallery controls, rent/title/labels/location/specifications before description, then landlord and match context. Remove the outer content box and heavy section rules. Existing inquiry, saved listing, estimate and supplementary destinations remain.
- Profile: softly tinted identity area with circular avatar, name/roles/bio and outlined Edit. Verification is an unboxed section with compact tier marks, exact status text and property scope. Settings remain simple divided rows.
- Verification: softly separated overview panels. Status pages group the result/icon/message, review note and dated metadata; approved return action uses primary green. Other statuses retain their actual labels, reasons, uncertainty and recovery controls. Do not infer status from a tier color or hide backend information.
- Admin dashboard: one preview disclosure, one overview heading, compact wrapping statistics, restrained semantic tints and simple queue summaries. Preview labels remain visible; live counts are not replaced with fixtures. No new moderation behavior.

## Accessibility and preserved behavior

Keep existing callbacks, selected/disabled state, Back guards, safe-area handling and ViewModel ownership. At width / fontScale < 280, Discovery listing actions and property price use a full-width row. Marketplace and Admin navigation reflow into two rows to retain complete enlarged labels. Do not cap text scaling or shorten labels.

Check default approximately 411dp/100% and 320dp/150% text on Android. Agent observations are separate from user acceptance and full role/status/TalkBack coverage. Verification records and actual before/after captures belong in docs/implementation-reports/ui/.

## Phase 2 boundary

Full Auth/onboarding layouts, landlord creation/management, messaging/scheduling, ratings/reports, notifications, maintenance/tenancy, estimator and detailed Admin review/enforcement/audit layouts remain deferred. This refinement changes no backend, auth/role/tier rule, recommendation calculation, workflow or navigation destination. Leave uncommitted for review.
