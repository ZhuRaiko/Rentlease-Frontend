# Soft neo-brutalist design experiment - Phase 1

Date: 2026-10-23, Asia/Singapore. Branch: `feature/ui-improvements`. Baseline: `66afe39`; implementation remains uncommitted. IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED. Stop here for user inspection before Phase 2.

## Visual language

Green actions, neutral canvas, deep green ink/outlines, white framed content and firm geometry. One family (existing Roboto), 24dp page titles, 18dp section headings, 16dp body and 14dp supporting copy. Panels use 4dp corners, 1dp outlines and 3dp baselines; controls use 8dp corners and at least 48dp targets with content-driven height. No new font, library, decorative animation, gradient or shadow system. The supplied references informed clear outlines, typography and photographic emphasis; neon colors, decorative finance graphics and luxury treatments were not adopted.

## Reviewed context

AGENTS.md, architecture/frontend/Figma guidance, feature index/routes, existing Profile/Verification/Admin docs, PRODUCT.md and DESIGN.md. Skills: Impeccable product/hardening guidance and context loader, Hallmark redesign, design-taste-frontend, frontend-design, ui-ux-pro-max, RENTLEASE implementation/MVVM/verification/documentation/security/artifact guards. Existing auth fields, listing dashboard, navigation composition, Discovery states, Admin flow, shared controls, tokens and tests were inspected. Backend/role/security contracts were preserved; no live security test was attempted.

## Shared system and representative screens

- `src/shared/theme/ui.ts`: typed panel/control/rule/title/body/supporting recipes. `colors.ts`: canvas, ink, outline and more readable neutral text. Existing greens/status colors remain.
- AppButton: one control shape and outline, preserving primary/secondary/danger behavior; dark is added for existing Discovery dark controls. DiscoveryButton delegates all label/disabled/callback/variant rendering to it.
- ScreenHeader: stronger baseline and wrapping title. DiscoveryHeader delegates visual navigation while preserving its existing Back/Close/action priority. Marketplace navigation receives the same firm separator without route changes.
- Discovery: framed feed cards, neutral canvas, larger wrapping landlord/caption/rent/location/match text and green selected-tab underline. Saved/results cards remove shadows and fixed compact width; search/filter primitives inherit shared controls. Existing preview properties, captions, scores and data states remain.
- Property details: framed content, larger description/metadata, wrapping price/rating and spec layout, neutral navigation icons, flex-positioned hero controls and existing inquiry/save/estimate actions.
- Profile: existing account panel composition now consumes the shared recipes. Circular avatar/initials, roles, biography, settings rows, exact status text and destinations remain.
- Verification: existing numbered panels use shared panel/type recipes; buttons/scaffold inherit the system. Tier/status/property distinctions and every document/recovery/review control remain.
- Admin dashboard: wrapping stats, restrained semantic accents, readable preview disclosures, framed queues and wrapping activity. Real verification counts and explicitly labelled preview values remain; no fabricated data/integration added.

Shared button/header/neutral-color changes reach existing consumers across the application. Other screen-specific layouts are not claimed redesigned. No App.tsx, ViewModel, service, model/business contract, database, dependency or lockfile change.

## Screenshots and native evidence

- [Profile baseline, identity/top](phase1-design-screenshots/profile-top-before.png)
- [Profile baseline, summary/settings](phase1-design-screenshots/profile-before.png)
- [Discovery after](phase1-design-screenshots/discovery-after.png)

These are actual emulator captures, not generated mockups. Baseline captures contain the existing signed-in account presentation. Discovery after shows Phase 1 panels/type on the connected 1080x2400 / 420dpi emulator (approximately 411dp wide), font scale 1.0. There is no valid matching before/after pair for every screen. No Admin screenshot or role switch was attempted.

Injected taps did not reliably navigate; Android then displayed an app-not-responding dialog and the development client reported an unexpected end of HTTP stream while loading the project. An isolated local Metro connection did not recover reliable inspection; that extra server was stopped. An editing encoding error briefly expanded the property-detail file; it was restored from the clean committed baseline and intended changes reapplied with UTF-8. The corrected source passed subsequent typecheck/tests. The runtime failure's root cause is not established by these observations. No business logic was changed to compensate. Emulator size/density/font settings were not changed.

## Validation and remaining acceptance

- `npm run typecheck`: PASS.
- `npm test`: 288 passed, zero failed/skipped/cancelled. Existing Auth/roles/navigation/verification/Admin/preview regressions preserved. Contrast coverage expanded for ink, neutral canvas and button pairs; one inline-border source assertion updated for shared recipe consumption.
- `git diff --check` and staged whitespace check: PASS.
- Source review: no fixed button heights or line limits introduced; main price/stats/metadata groups wrap, essential text scales and controls retain 48dp targets. This is not proof of native rendering under all conditions.
- No dependencies changed; Expo dependency installation/upgrade was not performed.

After development-runtime recovery, inspect 320/375/414dp widths and large fonts: Discovery captions/names/metrics and saved/results/empty/error states; details hero controls, long address/description, specs and existing actions; Profile long name/bio and tenant/landlord/dual-role cases; Verification approved/pending/rejected/incomplete/unconfirmed states and property-specific wording; Admin loading/error/empty/count/stat/activity states. Check Back/Close/bottom navigation, selection and disabled feedback, document preview/zoom and confirmation cancellation. Use separate authorized fixtures for any later submission/review writes. User Android acceptance remains required.

## Phase 2, pending user inspection

Full Auth/onboarding layouts and fields; landlord listing dashboard/create/edit/management; search/filter-specific layout polish and supplementary gallery/location screens; messaging and scheduling; ratings/reports; notifications; maintenance/tenancy; price estimator; detailed Admin queues/review/enforcement/audit screens. Some inherit shared primitives now; full adoption and native acceptance are deferred. No Phase 2 implementation or automatic commit/push.

## Follow-up native visual inspection (2026-10-23)

Agent-observed on emulator-5554 after the development app rendered again. The earlier ANR/loading evidence is historical; it did not recur during these completed visual checks. User Android acceptance remains RUNTIME-UNVERIFIED. No backend write, submission, role change or review decision was performed.

Inspected ordinary-account Discovery/feed, property-details top/content, Profile identity/summary and Verification overview (all three tiers) at default approximately 411dp / font scale 1.0 and at 320dp / font scale 1.5. The active account has Tenant and Landlord roles and approved verification timestamps; this does not cover tenant-only/landlord-only accounts or all submission states. At normal size, the existing approved Tier 2 status showed its exact label, review note, PHT dates and outlined return action.

Native findings corrected and re-inspected:
- Property hero controls inherited excessive vertical padding; Back used a low-contrast raster asset. Use the existing green chevron treatment and remove excess icon-button padding while retaining 48dp minimum targets.
- At 320dp / 150% text, the listing action squeezed the landlord identity. Move the action to a full-width row when `width / fontScale < 280`.
- Five bottom-navigation labels split long words at that setting. Reflow to two rows under the same presentation-only condition, retaining every label, selected/disabled state, callback and safe-area inset. Default layout remains one row.
- Property rent broke between digits next to the rating. Give price/location their own full-width row under that condition; the rating follows. The corrected screenshot preserves the whole rent value.

Profile text briefly clipped after Android's live font configuration change. A clean app restart at the same 320dp/150% setting removed that clipping; no Profile logic or font-scaling cap was added. Identity/name/roles/bio/Edit, summary labels/statuses/property scope and Verification headings/actions wrap. Screens remain scrollable. The Expo development-tools overlay is visible in some captures and is not product UI.

New captures: [Profile normal](phase1-design-screenshots/profile-after.png), [Profile enlarged](phase1-design-screenshots/profile-narrow-large-after.png), [Profile summary enlarged](phase1-design-screenshots/profile-summary-narrow-large.png), [Discovery before narrow fix](phase1-design-screenshots/discovery-narrow-large-before-fix.png), [Discovery after narrow fix](phase1-design-screenshots/discovery-narrow-large-after.png), [property details enlarged](phase1-design-screenshots/property-details-narrow-large-after.png), [Verification normal](phase1-design-screenshots/verification-after.png), [Verification enlarged](phase1-design-screenshots/verification-narrow-large-after.png), [optional tiers enlarged](phase1-design-screenshots/verification-optional-narrow-large.png), [approved status normal](phase1-design-screenshots/verification-approved-after.png).

After these corrections: typecheck PASS; 288/288 tests PASS, zero failures/skips/cancellations. Display restored and confirmed: 1080x2400, density 420, font scale 1.0; no size override remains. The extra Metro server started during diagnosis was stopped; the existing server on 8081 is retained. The user subsequently supplied an Admin session; dashboard inspection was completed as recorded below. Other verification statuses, private preview/zoom, write confirmations, keyboard/TalkBack and full user acceptance remain outside the completed observations.

### Admin visual inspection completed

The user signed in as Admin; the agent did not handle credentials or change roles. Agent observed the existing queue with a pending Tier 3 record, then opened Dashboard through its existing tab. At approximately 411dp/100% text the dashboard showed its real pending count, explicitly labelled preview statistics, disclosure, queues and navigation. At 320dp/150% text, statistic panels reflowed to one column and queue summaries remained readable and scrollable.

The enlarged Admin navigation split Dashboard mid-word. AdminBottomNavigation now uses a two-by-two layout under the same width/fontScale < 280 condition as the marketplace adaptation. Selected-state styling, all four callbacks and safe-area padding remain. This was re-inspected in [Admin enlarged statistics](phase1-design-screenshots/admin-stats-narrow-large-after.png) and [Admin enlarged queues](phase1-design-screenshots/admin-queues-narrow-large-after.png). Also available: [Admin normal](phase1-design-screenshots/admin-dashboard-after.png) and [Admin before navigation fix](phase1-design-screenshots/admin-narrow-large-before-fix.png).

All five representative Phase 1 surfaces now have agent native visual evidence at normal and narrow/enlarged settings. This is not full state coverage or user acceptance. Pending/rejected/unconfirmed/incomplete ordinary-user submission states, tenant-only/landlord-only layouts, private preview/zoom, keyboard/TalkBack, approval/rejection and error/empty/loading transitions remain unverified in this visual pass. No moderation action, submission, private-document opening or backend write was performed.

Final validation after the Admin adaptation: npm run typecheck PASS; npm test 288/288 PASS, zero failed/skipped/cancelled; staged/unstaged whitespace checks PASS. Final emulator settings confirmed restored: physical 1080x2400, density 420, font scale 1.0, no size override. User's Admin session and existing Metro server are retained; no commit/push.
