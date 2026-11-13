# Test baseline audit: the 56 failing tests

Audit only. No source, test, config or snapshot was changed, no test was skipped or rewritten, and the hosted backend was not touched. Where a cause is inferred and not proven, the text says "inferred".

## 1. The run

| Field | Value |
| --- | --- |
| Command | `node scripts/run-tests.cjs` (this is exactly what `npm test` runs) |
| Date | 2026-11-13, about 16:02 local (UTC+8) |
| Commit | `00d00c4b69e418fda429f3b9cd0aea1890f1be23` on `feature/admin-actions-audit`; the working tree is dirty (the uncommitted Admin Actions and Audit work) |
| Node | v25.8.2, Node's built-in test runner, one process for all 107 test files |
| Totals | 1836 tests, 0 suites (the tests are top-level, with no `describe` blocks), 1780 passed, **56 failed**, 0 cancelled, 0 skipped, 0 todo, 37.8 s |
| Raw output (outside the repo, not committed) | `C:\Users\Evance Adriano\AppData\Local\Temp\claude\e81837342269a407\8430e54e-e0d2-4ce9-ae27-5a6cb31c2229\scratchpad\audit\run1.txt` (a second identical run is `run2.txt` in the same folder) |

How this suite works, because it explains most failures: `scripts/run-tests.cjs` registers a loader only for `.ts`. Node cannot `require` a `.tsx` file. Many tests therefore transpile a component's source themselves and hand it a hand-written fake `require` that stubs a fixed list of modules and falls back to the real `require` for everything else. Any `.tsx` component or package the stub list does not know about breaks the test as soon as a View starts importing it.

## 2. Is it really "the same 56"?

| Check | Result |
| --- | --- |
| Earlier full run today (13:11, 1825 tests, saved in my scratchpad) against this run (16:02, 1836 tests) | Identical set of 56 (file + test name compared programmatically). The 11 extra tests are the new Admin tests, all passing |
| A second full run right after this one | Identical set of 56 |
| Each of the 13 failing files re-run alone | Same failures, same counts (1+1+3+8+2+1+2+1+13+20+2+1+1 = 56), same names. Nothing is order-dependent |
| Flaky or order-dependent (kind d) | None found |
| Earlier claim "57 baseline, now 56" | I do not have the list of the earlier 57, so I cannot compare it. Not checked |
| Failing at the commit before the Admin work (`294f0d1`, a throwaway worktree, now removed) | **All 56 already failed there.** Zero failures were introduced by the Admin work |
| Failed at `294f0d1` but passes now | 7 tests: `AdminModeration registers feature-owned hardware Back…`, five `My Rentals card exposes direct … verification…` tests, and `UI uses restrained destructive action…` (unfinishedPostDeletion). These were fixed by the Admin and My Rentals work, not by anything in this audit |

## 3. When the failures started (full suite run in a throwaway worktree at each commit)

| Commit | Date | Failing tests |
| --- | --- | --- |
| `695bc63` Merge integrated frontend through tenancy T6 | 2026-11-10 | 10 (9 of today's 56 are among them) |
| `f7557af` Merge T7 ratings and reviews | 2026-11-10 | 16 |
| `913aebc` Merge saved listings | 2026-11-11 | 21 |
| `7dc5d2c` Merge reporting and Admin moderation | 2026-11-11 | 22 |
| `0ff20d9` Merge in-app notifications | 2026-11-11 | 25 |
| `6d36912` Refine rental posting and unified editing | 2026-11-11 | **63** (+38 in this one commit) |
| `2c43eb4`, `d83c65c`, `294f0d1` | 2026-11-12 | 63 each |
| `00d00c4` (today, with the Admin work) | 2026-11-13 | 56 |

Notes: `6902ec9` ("Codex to Claude commit checkpoint") cannot run the suite at all (a source file it needs, `NearbyPlacesResponse`, was committed later), so it is skipped. Nothing was checked before `695bc63`. No test passed at one commit, failed at a later one, then passed again, so each failure has a clean "first failing commit" (listed per group below, as "at or before" for the oldest). The failures accumulate: each feature merge added tests whose stub lists were not updated.

## 4. Root-cause groups

Kinds: (a) test is stale, product changed on purpose; (b) product bug; (c) environment or tooling (test harness); (d) flaky; (e) SQL drift-guard. No failure is kind (b) that I can prove, no failure is (d) or (e). Groups G1 to G9 below add up to 56.

### G1a. Posting UI tests cannot load the new posting components: 16 tests, kind (c)

All in `propertyWorkspacePresentation.test.ts`: `Cannot find module '../components/PostingSection'` (views `ListingDetailsView`), `'./PostingChoices'` (`ComposerPropertyFields`) and `'../components/SavedPropertyFields'` (`ListingComposerView`).

- Evidence: the three files exist (`src/features/property-listing/components/PostingSection.tsx`, `PostingChoices.tsx`, `SavedPropertyFields.tsx`), all created by `6d36912`. The test's `presentation()` shim has no stub for them and falls back to the real `require`, which cannot load `.tsx` (verified: `require.extensions` has only `.js`, `.json`, `.node` plus the `.ts` loader the runner adds).
- Broke at: `6d36912` (inferred from the commit that introduced the imports and from the failure counts, 25 to 63).
- Before the Admin work: yes (fails at `294f0d1`).
- What the user would see: nothing, as far as I can tell. This is a test-harness gap, not a proven bug. But these 16 tests are the presentation checks for the composer, listing details, estimate and review steps, and they are not running.

### G1b. Chat and discovery tests cannot load newer shared components: 4 tests, kind (c)

- `chatPropertyContext` and `messagingAcceptance` (1 each): `Cannot find module '../../../shared/components/Reporting'`. `Reporting.tsx` was added by `07b632a` and is imported by `MessagingConversationView` and `LiveSearchViews`.
- `searchRuntimeCorrections` (2): `Cannot find module '../../../shared/components/HeartIcon'` (imported by `TenantDiscoveryView`).
- Evidence: the files exist; the test shims lack a stub. At `695bc63` and `913aebc` the same tests failed on a different missing component each time (`InlineRentalEstimate`, `SaveListingButton`), which shows the pattern: every newly added shared `.tsx` component breaks these tests.
- First failing: `messagingAcceptance` at or before `695bc63`; `searchRuntimeCorrections` at `913aebc`; `chatPropertyContext` at `7dc5d2c`. Before the Admin work: yes.

### G2. GPS and wizard tests load real React Native: 9 tests, kind (c)

- 8 in `gpsDiscoveryIntegration.test.ts` and 1 in `propertyWorkspacePresentation.test.ts` ("Stage 1 action footer…"): `SyntaxError: Unexpected token 'typeof'`.
- Evidence (GPS, verified): I hooked `Module._load` and the failing request is `react-native`, required from `useSavedListings.ts`, which the Discovery hook now imports (saved listings, `93bcabd`). The test's `req` has no stub for `react-native` in that path, so Node loads the real Flow-typed React Native source and fails to parse it.
- Evidence (the `propertyWorkspacePresentation` one): `ListingWizardScaffold.tsx` (changed in `6d36912`) imports `react-native-safe-area-context`, which that shim does not stub. Inferred to be the same mechanism; I did not capture the exact failing request.
- First failing: GPS at `913aebc`; the wizard one at `6d36912`. Before the Admin work: yes.
- What the user would see: nothing known. But these 8 tests are the only automated cover of the Nearby/GPS flow (explain first, Allow, Not now, Back clears GPS, account switch and unmount invalidate a pending request), and they do not run.

### G3. Posting-flow ViewModel tests still assume the old screens: 13 tests, kinds (a) and (c); could hide a real bug

All in `propertyExitGuard.test.ts`.

- 7 end on `'listingComposer'` where the test expects `'preview'`, `'listingDetails'`, `'publishConfirmation'` or `'propertyEdit'`.
- 3 crash with `Cannot read properties of undefined (reading 'onPost' / 'onChat')`: the test's `h.bottom()` finds no bottom navigation. `PropertyListingFlowView.tsx` (line 149) now hides the bottom navigation while the posting wizard is open.
- 2 (`owned photos and listing draft remain editable with property Tier 3 …`) get `listingDraftReadOnly` true where false is expected.
- 1 (`property-only 40 percent and complete rental estimate …`) gets 40 where 80 is expected after four `updateDraft` calls.
- Evidence that points at the test harness (verified by an experiment on a copy of one test outside the repo): after `openSavedDraft()` the ViewModel calls `propertyRoutine.open()`, and the harness's default stub for `propertyRoutineDependencies` is `load: async()=>{throw Error('Routine read not configured')}` (`tests/propertyExitGuard.test.ts`, the `propertyRoutineDependencies` stub). The routine ends in `status: 'error'`, `canWriteListing()` becomes false, so `requestPublish()` is refused ("Check the current publication status before continuing"), draft edits are ignored and `listingDraftReadOnly` is true. The completeness formula file (`ListingCompleteness.ts`) has not changed since `08abb8a`, so the 40-not-80 result is explained by the ignored edits (inferred).
- Broke at: `6d36912` (the commit that introduced the posting wizard; it also edited this test file and left these 13 failing).
- Before the Admin work: yes.
- Why this group matters: it is the landlord's save-draft, review, publish and "Review Publication from My Rentals" path. The tests are probably just stale, but they are not running, so nothing automated is checking that path. I did not run the wizard end to end. It could hide a real bug.

### G4. Copy and label changes: 4 tests, kind (a)

- `propertyWorkspacePresentation` "unified composer keeps media first…": the test wants the label `Address line 1`, the field is now `Street address` (`ComposerPropertyFields.tsx`, `6d36912`); the field still exists.
- `propertyWorkspacePresentation` "draft saved destination…": the test wants the button `Open saved listing`, the button is now `Continue Editing` (`ListingDraftSavedView.tsx`, `6d36912`).
- `propertyWorkspacePresentation` "Manage Listing separates lifecycle actions…": the test wants the heading `Manage Listing`, it is now `Manage Status` (`PublishedListingStatusView.tsx`).
- `targetedUxCorrections` "Discovery Notifications follows the guarded feature callback…": the test wants `accessibilityLabel="Open Notifications"`; the label now includes the unread count ("Open Notifications, N unread…", or "Open Notifications, unread count unavailable") (`TenantDiscoveryView.tsx`, in-app notifications, `d7db044`).
- Before the Admin work: yes. User impact: none; the product text is the intended one.

### G5. Profile identity changed to the public nickname: 3 tests, kind (a)

`expressiveVerification.test.ts`: `ProfileAvatar` is now a thin wrapper around `PublicAvatar`, and `ProfileView` shows `publicIdentity?.nickname ?? 'RentLease member'` instead of the private display name. This is the consented-display-name feature (`429f1f5`, 2026-11-07); the tests were last edited 2026-10-23. First failing at or before `695bc63`. Before the Admin work: yes. User impact: none, and the change is deliberate (privacy).

### G6. Hard-coded toolbar counts: 2 tests, kind (a)

`marketplaceWiring` ("all root toolbar consumers…") expects 7 `canPostProperty` attributes in `App.tsx` and finds 8; `unifiedAccountFrontend` expects 6 `canPostProperty={canEnterMarketplace}` and finds 8. A new toolbar consumer was added with in-app notifications (`d7db044`, first failing at `0ff20d9` for `marketplaceWiring`; `unifiedAccountFrontend` was already failing at or before `695bc63`). Before the Admin work: yes. User impact: none.

### G7. Architecture allow-list: 1 test, kind (a)

`marketplaceWiring` "navigation changes preserve backend boundaries…": `usePropertyListingViewModel.ts` imports `../services/unfinishedPostDependencies`, which is not in the test's allow-list of service imports. It is the same dependency-module pattern as the allowed ones (the unfinished-post deletion feature, inferred from `5fb6676`). First failing at or before `695bc63`. Before the Admin work: yes. User impact: none.

### G8. Android Back wiring written for older structure: 3 tests, kind (a)

- `bottomNavigationBack`: the test splits `App.tsx` at `<MaintenanceRequestsFlowView` and gets nothing. That view is no longer mounted (removed from `App.tsx` in `d580ad5`); `App.tsx` mounts `TenancyCareWorkspaceView` instead. `MaintenanceRequestsFlowView.tsx` is now referenced by no other file (dead code).
- `navigationBackAudit` Notifications: `NotificationsFlowView.tsx:44` registers `registerBackAction?.(onClose)` only when no nested target is open, instead of `viewModel.backFromWorkspace(...)` (`d7db044`). Looks intentional (a nested screen registers its own Back); inferred, not exercised.
- `navigationBackAudit` RentalPriceEstimation: the ViewModel has `backFromWorkspace: (onClose) => { if (!workflow.back()) onClose(); }`, which does the same thing as the expected text in different words (inferred, not exercised).
- First failing: `RentalPriceEstimation` and `bottomNavigationBack` at or before `695bc63`; Notifications at `0ff20d9`. Before the Admin work: yes.
- Low risk but user-visible if wrong, because it is hardware Back. A 5-minute manual check covers it.

### G9. Roles no longer gate the marketplace intro: 1 test, kind (a)

`onboardingContinuity`: the test expects status `idle` for a verified user with no roles; `getWorkspaceDestination` (`accountRouting.ts`, `1562f74`, "unified tenant and landlord experience", 2026-11-02) now sends every non-Admin to Discovery, so the status is `required`. Intentional (roles no longer gate access). Before the Admin work: yes. User impact: none.

## 5. Recommended action, size and demo risk (highest risk first)

Sizes are rough estimates (inferred), not measured.

| Rank | Group | What to do | Size | Demo risk (Nov 23) | Could hide a real bug? |
| --- | --- | --- | --- | --- | --- |
| 1 | G3 posting-flow ViewModel tests (13) | Fix the tests: configure the `routine` stub and rewrite the screen expectations for the wizard (composer, details, estimate, review, confirmation). Fix code only if a rewritten test shows a real defect | 4 to 8 hours | **High**: core landlord path (save draft, review, publish, My Rentals review) | **Yes, possibly**; the automated net is off and I did not exercise the wizard |
| 2 | G1a posting UI tests (16) | Fix the tests: add the new components and `react-native-safe-area-context` to the shim (or one shared helper for all shims) | 2 to 4 hours (shared with G1b and G2) | **High**: no presentation coverage of the posting screens | **Possibly** (coverage gap) |
| 3 | G2 GPS and wizard-footer tests (9) | Fix the tests: stub `react-native` and safe-area in those two shims | 1 to 2 hours | **Medium-high**: Nearby/GPS flow and its Back and account-switch rules are uncovered | **Possibly** (coverage gap) |
| 4 | G8 Back wiring (3) | Fix the tests to the new structure; delete the obsolete `MaintenanceRequestsFlowView` assertions (and consider removing the dead view) | 30 to 60 minutes | **Medium-low**: hardware Back | Unlikely; check by hand |
| 5 | G1b Reporting and HeartIcon stubs (4) | Fix the tests: add the stubs | 30 minutes | Low to medium: Report button in chat, For You placeholder | Unlikely |
| 6 | G4 copy (4) | Fix the tests: update the strings | 20 minutes | Low | No |
| 7 | G5 profile identity (3) | Fix the tests: assert the `PublicAvatar` wrapper and nickname display | 30 minutes | Low | No |
| 8 | G9 onboarding roles (1) | Fix the test: roles no longer gate the intro | 15 minutes | Low | No |
| 9 | G6 toolbar counts (2) | Fix the tests: stop hard-coding a count (assert every consumer receives the value) | 10 minutes | Low | No |
| 10 | G7 allow-list (1) | Fix the test: add `unfinishedPostDependencies` to the allow-list | 5 minutes | Low | No |

Rough total to get to green: about 10 to 20 hours, dominated by G3.

Suggested manual smoke checks for the demo (because the tests above are not covering them): post a rental from Post through save draft, Continue Editing, estimate, review and publish; My Rentals "Review Publication"; Edit Listing; Nearby with Allow, Not now, Back and an account switch; hardware Back from Notifications, Tenancy care and Price estimate; the Report action in a chat; the For You tab.

## 6. Appendix: every failing test

Group ids refer to section 4. "Points at" is the first source or test location in the stack (for module errors it is the file that failed to load its import). Node's reported line numbers for assertion failures do not always match the file, so I located assertions by test name.

| # | Group | Test file | Test name | Error (first meaningful line) | Points at |
| --- | --- | --- | --- | --- | --- |
| 1 | G8 | bottomNavigationBack.test.ts | bottom destination Back is distinct from explicit Profile entry | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /onRootBack=\{\(\)=>setWorkspace\(\{type:'tenancy'\}\)\}/. | tests/bottomNavigationBack.test.ts:23:30 |
| 2 | G1b | chatPropertyContext.test.ts | conversation header and property summary use shared identity and preserve real workflow actions | Error: Cannot find module '../../../shared/components/Reporting' | src/features/messaging-viewing/views/MessagingConversationView.tsx |
| 3 | G5 | expressiveVerification.test.ts | curved Profile identity preserves editing, account content and scalable text | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /backgroundColor: colors.primaryAction/. | tests/expressiveVerification.test.ts:68:22 |
| 4 | G5 | expressiveVerification.test.ts | calmer Profile places name with avatar, removes the extra eyebrow and keeps professional grouped sections | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /styles.name.*viewModel.displayName/. | tests/expressiveVerification.test.ts:120:22 |
| 5 | G5 | expressiveVerification.test.ts | avatar diameter preserves equal circular dimensions as accessibility fonts grow | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /width: diameter, height: diameter, borderRadius: diameter \/ 2/. | tests/expressiveVerification.test.ts:131:22 |
| 6 | G2 | gpsDiscoveryIntegration.test.ts | real Discovery hook explains first; explicit Allow searches; Back clears GPS and manual city backend search remains | SyntaxError: Unexpected token 'typeof' |  |
| 7 | G2 | gpsDiscoveryIntegration.test.ts | Not now returns to manual search with no permission or backend call | SyntaxError: Unexpected token 'typeof' |  |
| 8 | G2 | gpsDiscoveryIntegration.test.ts | nearby detail Back preserves radius, results and location; account switch clears them | SyntaxError: Unexpected token 'typeof' |  |
| 9 | G2 | gpsDiscoveryIntegration.test.ts | actual manual hook searches backend and applies filters/sort without duplicate Back screens | SyntaxError: Unexpected token 'typeof' |  |
| 10 | G2 | gpsDiscoveryIntegration.test.ts | new typed location search does not retain a previous suggestion-only city constraint | SyntaxError: Unexpected token 'typeof' |  |
| 11 | G2 | gpsDiscoveryIntegration.test.ts | back invalidates the actual hook pending GPS request | SyntaxError: Unexpected token 'typeof' |  |
| 12 | G2 | gpsDiscoveryIntegration.test.ts | account invalidates the actual hook pending GPS request | SyntaxError: Unexpected token 'typeof' |  |
| 13 | G2 | gpsDiscoveryIntegration.test.ts | unmount invalidates the actual hook pending GPS request | SyntaxError: Unexpected token 'typeof' |  |
| 14 | G6 | marketplaceWiring.test.ts | all root toolbar consumers receive account eligibility, independent of legacy membership or preference | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/marketplaceWiring.test.ts:30:22 |
| 15 | G7 | marketplaceWiring.test.ts | navigation changes preserve backend boundaries and feature isolation | AssertionError [ERR_ASSERTION]: src/features/property-listing/viewModels/usePropertyListingViewModel.ts | tests/marketplaceWiring.test.ts:69:30 |
| 16 | G1b | messagingAcceptance.test.ts | shared listing details render only Text children for Contact Owner, self, and inquiry errors | Error: Cannot find module '../../../shared/components/Reporting' | src/features/search-discovery/views/LiveSearchViews.tsx |
| 17 | G8 | navigationBackAudit.test.ts | Notifications registers feature-owned hardware Back and cleans it up | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /registerBackAction\?\.\(\(\) => viewModel.backFromWorkspace\(on(?:Close\|RootBack)\)\)/. | tests/navigationBackAudit.test.ts:27:30 |
| 18 | G8 | navigationBackAudit.test.ts | RentalPriceEstimation registers feature-owned hardware Back and cleans it up | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /backFromWorkspace:.*onClose\(\); else goBack\(\)/. | tests/navigationBackAudit.test.ts:29:30 |
| 19 | G9 | onboardingContinuity.test.ts | restart during email/phone/role onboarding retains a pending account marker and offers only after real completion | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/onboardingContinuity.test.ts:46:22 |
| 20 | G3 | propertyExitGuard.test.ts | actual ViewModel saves valid listing details for the authoritative property and retains the real listing UUID | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:344:22 |
| 21 | G3 | propertyExitGuard.test.ts | portfolio opens property only without recreating it, and Post detaches cleanly | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:866:30 |
| 22 | G3 | propertyExitGuard.test.ts | portfolio opens draft without recreating it, and Post detaches cleanly | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:851:26 |
| 23 | G3 | propertyExitGuard.test.ts | property-specific Tier 3 pending and uncertain publication do not block another Post or delete recovery | TypeError: Cannot read properties of undefined (reading 'onPost') | tests/propertyExitGuard.test.ts:898:19 |
| 24 | G3 | propertyExitGuard.test.ts | property-specific Tier 3 rejected and uncertain publication do not block another Post or delete recovery | TypeError: Cannot read properties of undefined (reading 'onPost') | tests/propertyExitGuard.test.ts:898:19 |
| 25 | G3 | propertyExitGuard.test.ts | composer Save confirms persisted draft before success navigation without losing pre-UUID listing fields | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:1055:22 |
| 26 | G3 | propertyExitGuard.test.ts | owned photos and listing draft remain editable with property Tier 3 pending | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:1256:26 |
| 27 | G3 | propertyExitGuard.test.ts | owned photos and listing draft remain editable with property Tier 3 approved | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:1256:26 |
| 28 | G3 | propertyExitGuard.test.ts | property-only 40 percent and complete rental estimate use the same unchanged listing formula | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:1297:22 |
| 29 | G3 | propertyExitGuard.test.ts | Listing Details Review Publication uses explicit confirmation and preserves unsaved edits | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:1586:22 |
| 30 | G3 | propertyExitGuard.test.ts | approved My Listings draft loads its exact persisted row before publication review without publishing | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:1682:22 |
| 31 | G3 | propertyExitGuard.test.ts | late response from an abandoned entry cannot replace newer title date or version | TypeError: Cannot read properties of undefined (reading 'onChat') | tests/propertyExitGuard.test.ts:1841:15 |
| 32 | G3 | propertyExitGuard.test.ts | identity correction nested Back protects proposal and retains unsaved listing context | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyExitGuard.test.ts:2109:22 |
| 33 | G1a | propertyWorkspacePresentation.test.ts | composer renders before persistence with local media and physical/location controls | Error: Cannot find module '../components/SavedPropertyFields' | src/features/property-listing/views/ListingComposerView.tsx |
| 34 | G4 | propertyWorkspacePresentation.test.ts | unified composer keeps media first, every physical/address field, a mounted scroll surface and temporary map modal | AssertionError [ERR_ASSERTION]: Address line 1 | tests/propertyWorkspacePresentation.test.ts:123:26 |
| 35 | G1a | propertyWorkspacePresentation.test.ts | physical composer marks only actively required fields and locates first validation issue | Error: Cannot find module './PostingChoices' | src/features/property-listing/components/ComposerPropertyFields.tsx |
| 36 | G1a | propertyWorkspacePresentation.test.ts | listing details required title/rent/description preserve optional date and short-description hint | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 37 | G1a | propertyWorkspacePresentation.test.ts | location hint is at the location controls and disappears after confirmed handoff | Error: Cannot find module './PostingChoices' | src/features/property-listing/components/ComposerPropertyFields.tsx |
| 38 | G1a | propertyWorkspacePresentation.test.ts | description hint uses existing thirty-character completion and is supplied by its field | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 39 | G1a | propertyWorkspacePresentation.test.ts | saved physical property is a read-only summary instead of disabled creation controls | Error: Cannot find module './PostingChoices' | src/features/property-listing/components/ComposerPropertyFields.tsx |
| 40 | G2 | propertyWorkspacePresentation.test.ts | Stage 1 action footer remains outside the scroll content and does not overlay form controls | SyntaxError: Unexpected token 'typeof' |  |
| 41 | G1a | propertyWorkspacePresentation.test.ts | Stage 1 ordinary Property presentation has no validation checklist or action inside the scroll body | Error: Cannot find module '../components/SavedPropertyFields' | src/features/property-listing/views/ListingComposerView.tsx |
| 42 | G1a | propertyWorkspacePresentation.test.ts | Stage 1 contextual field errors respect visible interaction metadata and clear without red untouched fields | Error: Cannot find module './PostingChoices' | src/features/property-listing/components/ComposerPropertyFields.tsx |
| 43 | G1a | propertyWorkspacePresentation.test.ts | Stage 2 Property has no large inline completeness block and keeps contextual field hints | Error: Cannot find module '../components/SavedPropertyFields' | src/features/property-listing/views/ListingComposerView.tsx |
| 44 | G4 | propertyWorkspacePresentation.test.ts | draft saved destination clearly separates saved from published and delegates both actions | TypeError: Cannot read properties of undefined (reading 'props') | tests/propertyWorkspacePresentation.test.ts:434:59 |
| 45 | G1a | propertyWorkspacePresentation.test.ts | Listing Details shares the persistent completeness footer and retains field hints and Stage 3 save | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 46 | G1a | propertyWorkspacePresentation.test.ts | Listing Details directly exposes Review Publication only for a saved draft: true | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 47 | G1a | propertyWorkspacePresentation.test.ts | Listing Details directly exposes Review Publication only for a saved draft: false | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 48 | G1a | propertyWorkspacePresentation.test.ts | saved draft loading presentation hides fields, completeness and submit actions | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 49 | G1a | propertyWorkspacePresentation.test.ts | saved draft error presentation hides fields, completeness and submit actions | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 50 | G1a | propertyWorkspacePresentation.test.ts | published editor reuses fields and footer with Save Changes while excluding property media and publication actions | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 51 | G4 | propertyWorkspacePresentation.test.ts | Manage Listing separates lifecycle actions from property tools and exposes Edit Listing | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/propertyWorkspacePresentation.test.ts:632:745 |
| 52 | G1a | propertyWorkspacePresentation.test.ts | Edit Listing groups shared property and photo tools without duplicating their forms | Error: Cannot find module '../components/PostingSection' | src/features/property-listing/views/ListingDetailsView.tsx |
| 53 | G1b | searchRuntimeCorrections.test.ts | For You is a community placeholder with search CTA and no GPS or fabricated content | Error: Cannot find module '../../../shared/components/HeartIcon' | src/features/search-discovery/views/TenantDiscoveryView.tsx |
| 54 | G1b | searchRuntimeCorrections.test.ts | For You empty state grows into available space with centered content and scrollable overflow | Error: Cannot find module '../../../shared/components/HeartIcon' | src/features/search-discovery/views/TenantDiscoveryView.tsx |
| 55 | G4 | targetedUxCorrections.test.ts | Discovery Notifications follows the guarded feature callback to the existing root preview | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /accessibilityLabel="Open Notifications".*onPress=\{onOpenNotifications\}/. | tests/targetedUxCorrections.test.ts:30:22 |
| 56 | G6 | unifiedAccountFrontend.test.ts | all toolbar consumers use account eligibility and empty Listings directs first owners to Post | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: | tests/unifiedAccountFrontend.test.ts:60:22 |

## 7. Summary

| Group | Count | Kind | Demo risk | Action |
| --- | --- | --- | --- | --- |
| G3 posting-flow ViewModel tests | 13 | (a) stale + (c) harness | **High** (may hide a bug) | Rewrite for the wizard, configure the `routine` stub, 4 to 8 h |
| G1a posting UI tests | 16 | (c) harness | **High** (coverage gap) | Add stubs or a shared shim, 2 to 4 h |
| G2 GPS and wizard-footer tests | 9 | (c) harness | Medium-high (coverage gap) | Stub `react-native` and safe-area, 1 to 2 h |
| G8 Android Back wiring | 3 | (a) stale | Medium-low | Update patterns, delete obsolete assertions, 0.5 to 1 h |
| G1b Reporting and HeartIcon stubs | 4 | (c) harness | Low to medium | Add stubs, 0.5 h |
| G4 copy changes | 4 | (a) stale | Low | Update strings, 20 min |
| G5 profile identity | 3 | (a) stale | Low | Assert `PublicAvatar` and nickname, 30 min |
| G9 onboarding roles | 1 | (a) stale | Low | Update expectation, 15 min |
| G6 toolbar counts | 2 | (a) stale | Low | Stop hard-coding counts, 10 min |
| G7 service import allow-list | 1 | (a) stale | Low | Add one entry, 5 min |
| **Total** | **56** | none (b), (d) or (e) | | |

Plain statement:

- **Safe to ignore for the demo (11 tests):** G4, G5, G6, G7 and G9. I read the product code for each and the product behavior is the intended one; these are old expectations (copy, hard-coded counts, an allow-list, the public-nickname change, roles no longer gating access).
- **Do not ignore (41 tests): G3, G1a, G2 and G8.** I did not find a product bug in them, but they are the posting and publishing flow, the posting screens, the Nearby/GPS flow and hardware Back, and none of them is currently being checked automatically. Treat the demo path through those areas as untested and walk through it by hand before Nov 23.
- **G1b (4 tests)** is low risk but is the same kind of gap (Report action in chat, For You tab); include it in the manual pass.
- None of the 56 was caused by the Admin work, and none is a flaky test or a SQL drift-guard failure. The new Admin drift-guard tests pass.

## 8. Limits of this audit

- I did not run the app, so any "the product is fine" statement is from reading code and git history, marked "inferred" where it is not proven.
- Commits before `695bc63` were not checked; the oldest failures may be older than stated.
- For G2's wizard-footer test I verified the import but did not capture the exact failing request. For G3 the experiment covered one test and the cause is applied to the rest of the group by inference (the same stub, the same screen, and the same read-only flags).
- A throwaway git worktree (outside the repo, with a junction to `node_modules`) was used for the per-commit runs and removed afterwards; `node_modules` was verified intact and the repo's own files were not modified by this audit.
