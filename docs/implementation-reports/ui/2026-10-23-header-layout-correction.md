# Header containment and Android safe-area audit

2026-10-23, Asia/Singapore. Branch feature/ui-improvements, baseline 6f004eb plus existing uncommitted gradient experiments and this layout correction. No commit or push. IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED.

## Reproduced cause and correction

At the top of Tier 2 and Matching Preferences, normal and 320dp/150% captures showed correctly applied status-bar insets. The reproducible verification fault occurs on scrolling: VerificationScaffold placed ScreenHeader inside ScrollView, allowing Back/Close to move upward and be clipped by the safe viewport. AuthScaffold had the same containment pattern by source inspection. Profile, AdminScaffold and Matching Preferences place navigation outside the scrolling body. Opening Tier 2 from a scrolled overview started it at the top in this session; inherited offset was tested and not established as the cause.

Move ScreenHeader before ScrollView in VerificationScaffold and AuthScaffold, bounding the body with flex:1. No inset/padding patch. Verification keeps its fill/content-driven action layout and scrollable heading/body; Auth keeps KeyboardAvoidingView, form/footer content and existing behavior. The navigation row is now persistent. All Back, Close, disabled and registered hardware-Back callbacks remain unchanged.

ScreenHeader already uses a 56dp minimum, 48dp minimum controls, intrinsic height, wrapping title, no line cap and centered alignment; no fixed height/clipping/absolute positioning was found there. ScreenContainer owns native safe areas once per flow; headers do not independently add top insets. Root App.tsx uses a full-screen statusBarTranslucent workspace Modal under SafeAreaProvider; each flow wraps ScreenContainer. Native observations did not establish missing/double top insets, so provider, status-bar configuration and ScreenContainer are unchanged.

## Audit coverage

| Area | Finding / disposition |
| --- | --- |
| Verification overview, Tier 2/3 steps/statuses | Shared scrolling navigation corrected once in VerificationScaffold; runtime overview and approved Tier 2 inspected |
| Matching Preferences | ScreenHeader outside form ScrollView in KeyboardAvoidingView; title wraps and Close centers at 320dp/150%; no clipping reproduced, no speculative patch |
| Profile, Admin and Discovery shared header | External-to-scroll header; existing flow-level safe area; no source defect requiring change |
| Auth forms | Same scroll containment defect in AuthScaffold corrected; normal Edit Profile keyboard/scroll inspected without edits/save |
| Messaging, maintenance, ratings, notifications, estimator | Source-reviewed flow wrappers all use ScreenContainer; custom external headers need separate device/font coverage |
| Listing wizard and supplementary custom headers | Older custom top bars include fixed dimensions; not evidence of this reproduced failure, left unchanged pending runtime inspection |

Auth registration/sign-in and listing wizard also merit keyboard/large-font inspection. Physical display cutouts, landscape, app resume, modal transitions on other Android versions, all verification statuses/private preview and Admin session coverage remain unverified. The user subsequently clarified that Matching Preferences renders correctly; its intro heading was simply too close to the header (see follow-up below). No new dependency, ViewModel, data/service/security/navigation change.

## Android evidence

Actual emulator-5554 captures, same ordinary dual-role account. Normal physical 1080x2400/density420/font1.0 (approximately 411dp); narrow override840x1867/font1.5 (320dp). Back returns to overview, Close returns to Profile, content scroll and bottom navigation remained usable. No submission, preference save, profile save or moderation write. Edit Profile keyboard inspection was not retained as an artifact because its diagnostic capture included account contact details.

| Observation | Before | After |
| --- | --- | --- |
| Tier 2 at top, normal | [Before](header-layout-screenshots/tier2-before.png) | [After](header-layout-screenshots/tier2-after.png) |
| Tier 2 at top, narrow/large | [Before](header-layout-screenshots/tier2-narrow-before.png) | [After](header-layout-screenshots/tier2-narrow-after.png) |
| Tier 2 scrolled, narrow/large | [Before](header-layout-screenshots/tier2-scrolled-before.png) | [After](header-layout-screenshots/tier2-scrolled-after.png) |
| Matching normal, unchanged control | [Before](header-layout-screenshots/matching-before.png) | [After](header-layout-screenshots/matching-after.png) |
| Matching narrow/large, unchanged control | [Before](header-layout-screenshots/matching-narrow-before.png) | [After](header-layout-screenshots/matching-narrow-after.png) |

[Scrolled enlarged overview after](header-layout-screenshots/overview-scrolled-narrow-after.png) also retains navigation. Some captures show the Expo development tools overlay; it is not product UI. Page heading/body can still scroll out of view by design; the navigation row stays visible.

Original display confirmed restored: physical1080x2400, density420, font1.0, no size override. User session and original Metro retained. Agent observations are not user acceptance or full native integration/accessibility/security validation.

## Files and checks

App code: src/features/user-verification/components/VerificationScaffold.tsx; src/features/authentication/components/AuthScaffold.tsx. Regression: tests/headerLayout.test.ts. Living docs: USER_VERIFICATION.md and AUTHENTICATION_PROFILES.md. Prior gradient changes remain separate and untouched by this correction.

Two source-structure regression checks failed on the old containment and pass after the fix. They guard header ownership/Back wiring/no duplicated inset, not rendered native measurements. `npm.cmd run typecheck` PASS; `npm.cmd test` 290/290 PASS, zero failures/skips/cancellations; staged/unstaged whitespace checks PASS. No automatic install/upgrade. Existing friendly styling, typography, gradients and borders are preserved.

## Matching Preferences clarification and spacing follow-up

The user confirmed rendering/insets were correct and identified the intro copy, "A place that fits your needs", as visually too high. Its `newHereBlock` had horizontal/bottom padding but no top separation. Added existing `spacing.lg` (24dp) top padding to that content block in DiscoveryFilterView.tsx. This is content rhythm, not a safe-area/header patch. The header, Close callback, typography, form controls and scroll/footer behavior remain unchanged.

[Before](header-layout-screenshots/matching-before.png) / [after intro spacing](header-layout-screenshots/matching-intro-spacing-after.png), actual normal-size Android captures. Agent inspected the added breathing room; no new enlarged-font capture for this one-line spacing change. Typecheck and diff checks PASS. The preceding 290-test result applies to the earlier scaffold correction; tests were not repeated for this spacing-only adjustment.

Tier 2 follow-up: the user requested the same breathing room above its title. VerificationScaffold headingFrame now has 24dp top padding via spacing.lg, keeping all its workflow headings consistent. [Tier 2 after](header-layout-screenshots/tier2-heading-spacing-after.png), normal Android capture. Navigation inset/position and content behavior are unchanged; no fixed height added. Typecheck and diff checks PASS; tests not rerun for this spacing-only adjustment.
