# Phase 1 friendly marketplace refinement

Date: 2026-10-23, Asia/Singapore. Branch: feature/ui-improvements. Built on the existing uncommitted Phase 1 work over baseline 66afe39; no branch switch, commit, merge or push. This report records a refinement, not a restart or Phase 2 expansion.

## Reference and design audit

The user's RentLease App Showcase.png is the primary visual reference. Its useful characteristics are photographic emphasis, approachable green/white surfaces, compact account information, restrained thin outlines and clear result/action grouping. Its decorative backdrop and unimplemented actions are not functional requirements.

The preceding experiment repeated dark borders, thick bottom edges and heavy headings across identity, verification, listing content and statistics. That made every group compete. Discovery captions and a thumbnail strip delayed the principal photo. Property specifications appeared below description/landlord/match context. Profile's framed identity and framed verification duplicated emphasis. Approved status information was disconnected across an icon, status, note and dates. Admin repeated several workspace headings and large outlined panels.

Impeccable product/quieter/distill guidance informed specific corrections: remove duplicated framing, preserve familiar controls, reserve emphasis for prices/results/actions, consolidate metadata, keep disclosures and avoid removing working functionality for visual simplicity. Existing RENTLEASE architecture/MVVM, documentation, verification and security boundaries were retained; no backend inspection or modification was needed for this presentation pass.

## Refined system

Use roughly 75-80% friendly marketplace and 20-25% restrained structural character. Shared ui.ts keeps its recipes; panels now use 12dp corners and one thin muted border, controls use 10dp corners and a distinct control-border token, and repeated 3dp bottom edges are removed. Warm-white canvas and neutral deep ink replace green framing as the dominant surface language. Established primaryAction green remains unchanged. Page/section/body/supporting sizes are 22/17/15/13dp with default scaling and smaller weight contrasts. Header titles and prices retain clear emphasis. No library, font, gradient, decorative illustration or shadow system was added.

## Screen changes

- Discovery: compact landlord identity; photo before caption; more-images overlay consolidates the strip's existing View listing interaction; existing captions, amounts, match scores, counts and destinations remain. A consistent star and heart outline replace ambiguous handcrafted rating/save shapes. No save action was added to the feed.
- Property details: remove the outer content card and heavy section rules. Rent/title/type/location/specifications lead, followed by description, landlord and match context. Type/furnishing chips were already no-op controls; they are now compact static labels. All implemented Back/Close/save/gallery/inquiry/estimate/supplementary actions remain. Match information uses a subtle contextual surface. Save and Close are grouped on the hero; the existing gallery destination is an overlay on the photo.
- Profile: softly tinted identity area; circular initials/photo avatar unchanged; lighter name/bio/role hierarchy and outlined Edit profile. Verification is an unboxed section with exact labels, compact tier marks and property scope. Settings retain neutral icons and divided rows.
- Verification: result/icon/message are grouped, then note and labeled PHT dates. A prominent result avoids repeating a second outlined check beside the main icon. Approved return action is green; other states retain secondary return, uncertainty, rejection/history/recovery/error controls and all guards. Overview panels inherit the softer recipes. Status pages can fill available height so short-page actions sit near the bottom; long content and enlarged actions remain scrollable.
- Admin: remove redundant subtitle/eyebrow and shorten the overview description. Keep the full real/preview disclosure. Statistics use compact sentence-case labels and restrained semantic surfaces, with original live counts and explicit preview values. Queue summaries and activity keep their destinations and data.

## Modified frontend files

Shared: src/shared/theme/{ui,colors,radius}.ts; src/shared/components/{AppButton,ScreenHeader,RentLeaseBottomNavigation,VerificationStatusIndicator}.tsx.

Authentication: views/ProfileView.tsx; components/AccountVerificationSummary.tsx and ProfileActionRow.tsx.

Search/Discovery: components/DiscoveryControls.tsx, DiscoveryFeedPost.tsx, DiscoveryIcon.tsx and DiscoveryPropertyCard.tsx; views/TenantDiscoveryView.tsx and PropertyDiscoveryDetailView.tsx.

Verification: components/VerificationScaffold.tsx and VerificationTierCard.tsx; views/VerificationStatusView.tsx.

Admin: components/AdminCards.tsx and AdminScaffold.tsx; views/AdminDashboardView.tsx. Existing shared consumers inherit primitives; unrelated screen layouts are not claimed redesigned.

The existing expressiveVerification source assertion about a heavy panel edge was changed to reject that obsolete treatment while retaining action/status checks. Existing contrast checks cover the updated neutral/primary pairs. PRODUCT.md, DESIGN.md and relevant living feature documents describe the current direction. The earlier Phase 1 report is retained as historical evidence; its corrupted question-mark title separator was corrected.

## Screenshots

Before captures are actual prior Phase 1 Android captures copied into phase1-refinement-screenshots; they are not generated mockups or screenshots of the concept board. After captures are taken from the connected development build in this refinement. Exact account/fixture and scroll position can differ between captures; they are visual comparisons, not state-transition proof.

| Screen | Before | After |
| --- | --- | --- |
| Discovery | [Before](phase1-refinement-screenshots/discovery-before.png) | [After](phase1-refinement-screenshots/discovery-after.png) |
| Property details | [Before](phase1-refinement-screenshots/property-details-before.png) | [After](phase1-refinement-screenshots/property-details-after.png) |
| Profile | [Before](phase1-refinement-screenshots/profile-before.png) | [After](phase1-refinement-screenshots/profile-after.png) |
| Verification result | [Before](phase1-refinement-screenshots/verification-before.png) | [After](phase1-refinement-screenshots/verification-after.png) |
| Admin dashboard | [Before](phase1-refinement-screenshots/admin-before.png) | [After](phase1-refinement-screenshots/admin-after.png) |

## Validation and scope limits

IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED. Final source validation: `npm.cmd run typecheck` PASS; `npm.cmd test` 288/288 PASS, zero failed/skipped/cancelled. Staged and unstaged `git diff --check` PASS. No dependency or lockfile change; no compatibility install was needed. The shared-panel source assertion now rejects the obsolete heavy bottom edge; workflow/status/role regressions remain.

Agent-observed on emulator-5554 at approximately 411dp/100% and 320dp/150% text: Discovery photo/caption/metrics and navigation; property hero, rent/specifications and actions; Profile identity/roles/bio, tier summary and settings; Verification overview and approved Tier 2 result; Admin disclosure/statistics/queues and navigation. Enlarged content wraps and scrolls, including the full approved return action. Clean restarts followed font configuration changes to avoid stale live-layout artifacts. The supplied ordinary session is dual-role, with verified Account/Identity and unverified Property; it does not cover all roles/states. Its approved identity record has no review note, correctly leaving that conditional card absent. Earlier before captures use another existing record with a note.

Enlarged captures: [Discovery](phase1-refinement-screenshots/discovery-narrow-large-after.png), [property details](phase1-refinement-screenshots/property-details-narrow-large-after.png), [Profile](phase1-refinement-screenshots/profile-narrow-large-after.png), [Verification overview](phase1-refinement-screenshots/verification-overview-narrow-large-after.png), [result](phase1-refinement-screenshots/verification-narrow-large-after.png), [return action](phase1-refinement-screenshots/verification-action-narrow-large-after.png), [Admin](phase1-refinement-screenshots/admin-narrow-large-after.png). [Normal Verification overview](phase1-refinement-screenshots/verification-overview-after.png) supplements the result comparison.

Original emulator settings restored and confirmed: physical 1080x2400, density 420, font scale 1.0, no size override. Existing Metro and user-controlled ordinary session retained. No credentials handled, private document opened, moderation decision or submission performed. Existing preview property assets remain low-resolution; replacing them is outside this styling pass.

Agent observations are not user acceptance or complete native integration/security coverage. Still inspect tenant-only/landlord-only and long-content records; pending/rejected/incomplete/unconfirmed and error/loading/empty conditions; keyboard/TalkBack, private preview/zoom, write confirmations and cancellation with authorized fixtures. Existing ViewModels, services, auth/roles, recommendation calculations, schema and navigation destinations are unchanged.

Stop after this refinement for user inspection. Phase 2 remains deferred: full Auth/onboarding, landlord listing creation/management, search/filter-specific polish and supplementary gallery/location screens, messaging/scheduling, ratings/reports, notifications, maintenance/tenancy, estimator and detailed Admin review/enforcement/audit layouts. No commit or push.
