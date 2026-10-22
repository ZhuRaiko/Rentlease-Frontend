# Authentication & Profiles

## Purpose and feature boundary

Own Supabase Auth onboarding, authoritative account/profile/role loading, session-driven account synchronization, safe profile edits, sign-out, and routing decisions. Architecture follows [ARCHITECTURE.md](../ARCHITECTURE.md); shared backend boundaries follow [BACKEND_CONTEXT.md](../BACKEND_CONTEXT.md).

Tier 1 email/phone onboarding belongs here. Tier 2/3 documents and Admin review belong to [USER_VERIFICATION.md](USER_VERIFICATION.md). Marketplace content remains preview data. This feature does not implement backend authorization, migrations, or Storage configuration.

## Session/account ownership

- IMPLEMENTED: the singleton `SupabaseClient<Database>` persists the session in AsyncStorage and manages token auto-refresh through the existing AppState listener.
- IMPLEMENTED: `App` mounts one `useAuthProfilesViewModel`; its `account` snapshot owns the current Auth user, profile, full recognized role collection, account status, tier timestamps and trust score.
- The feature-local `accountSynchronization.ts` coordinates requests, generations and timers only. It does not store a second account/session snapshot.
- `App` owns workspace selection, the Tenant/Landlord UI preference and saved Matching Preferences in account-scoped process memory. The workspace Modal is keyed by account ID so feature-local state is remounted across identity changes. These local preferences do not persist across restart or change backend membership.

## Auth event synchronization and lifecycle

`accountService.subscribeToAccountAuthChanges` owns the Supabase subscription; it forwards only the event and user ID. The callback is synchronous and performs no nested Supabase request.

The root ViewModel creates the coordinator and subscription on mount, then starts coordinator-owned bootstrap. Only current account-result/error callbacks complete startup; an obsolete bootstrap promise has no UI completion tail. Cleanup unsubscribes, cancels queued refresh and deadline timers, and invalidates in-flight results.

- `INITIAL_SESSION`: bootstrap loads the account; the event does not start another load.
- `SIGNED_IN`, `USER_UPDATED`, `TOKEN_REFRESHED`, `MFA_CHALLENGE_VERIFIED`: event-driven refreshes are deferred with a zero-delay timer and coalesced.
- `SIGNED_OUT`: immediately invalidates old reads and clears account, profile form, selected roles, registration/password/phone drafts, cooldown, history and sign-out modal; root workspace is cleared.
- Explicit Auth/account mutations suppress their own notification-triggered reloads, then explicitly reload account state. Their events do not produce duplicate requests.
- Token/sign-in notifications emitted by an active account read do not recursively reload that same identity. A different signed-in identity invalidates an older load.
- An account switch hides the prior snapshot while the new identity is loaded. Generation checks prevent an older request from restoring stale account state.

Background refreshes update the authoritative snapshot without resetting an editor, OTP screen or workspace when the same account's routing destination is unchanged. Edit-profile drafts remain intact in that case. A changed destination applies routing again. Background errors become existing presentation-safe Auth notices; no automatic retry loop is started.

Bootstrap is an exception to presentation preservation: an accepted account must leave the bootstrap screen even when its identity/destination matches an earlier snapshot. An account load has a 15-second recovery deadline; the entire initial/Retry startup attempt has a separate 15-second deadline that replacement Auth-event loads cannot extend. These deadlines add no startup delay and perform no automatic sign-out. A stalled attempt resolves to the existing error/Retry presentation, and late results are ignored. Successful account or signed-out results resolve immediately. Timers require an active JS event loop and may fire after the app resumes from suspension.

Auth events are not a subscription to every profile/user_roles database change. Server-only changes are observed on the next account load, Auth event or restart; immediate cross-device moderation/role synchronization remains runtime-unverified and has no dedicated Realtime subscription.

## Authoritative refresh and routing precedence

Account loading reads the persisted session, confirms the Auth user with `getUser`, then retrieves own `profiles` and `user_roles` before deriving routes.

Successful sign-in, phone update/verification, explicit Tier 1 recovery, role selection and profile save reload the account. Profile save no longer forces Profile after the reload. During registrationPhone/mobileConfirmation/verificationPending only, the Auth ViewModel also checks on background-to-active return and once two seconds after entering verificationPending. Automatic checks have a 30-second cooldown, exclude overlapping checks and skip explicit loading operations. They use the existing background account coordinator, preserve unchanged OTP presentation, and add no interval polling. Effect cleanup removes the AppState listener/timer; coordinator generations still protect account switching/disposal. Delayed verification or errors retain Check again/Check verification status recovery.

Routing uses `models/accountRouting.ts`:

1. Non-active account → restricted, including restricted/suspended/deleted.
2. Active Admin role → Admin-capable Profile destination and Admin workspace; ordinary email/Tier 1/role onboarding is bypassed.
3. Ordinary unconfirmed email → email confirmation.
4. Missing Tier 1 timestamp → phone onboarding, or pending synchronization if Auth already confirms a nonempty phone.
5. Missing Tenant/Landlord role → role selection.
6. Otherwise → ordinary Profile and marketplace eligibility; App selects Discovery or property management according to the permitted mode.

The root opens a workspace when account identity or permitted workspace changes, not on every token refresh. RLS and backend Admin checks remain authoritative.

## Roles and profile rules

- Roles are a collection: tenant, landlord, admin. Normal self-selection accepts Tenant, Landlord, or both through `set_user_roles({ requested_roles: string[] })`; frontend never offers Admin selection.
- UI mode changes no backend role. Tier 3 approval does not grant landlord.
- The current profile editor directly updates only `display_name` and `bio` on the caller's row, then reloads the account. This safe existing path is retained.
- `avatar_path` is a normal editable backend field but has no editor/upload flow in this phase.
- Email/phone remain Auth operations. Account status, trust score, verification timestamps and suspension/moderation fields are not written by the editor.
- Generated `update_my_profile` and `refresh_my_tier1_verification` RPCs are available but unused. Their presence alone does not establish that the current direct-write/refresh paths must change.

## Current implementation

### Marketplace navigation Phase 2 (2026-10-22)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** The prominent Profile mode switcher has been removed. Eligible ordinary Profile screens now use the root-supplied marketplace toolbar, with no selected marketplace tab. Discovery entry selects Tenant context for Tenant-capable accounts; Listings/Post selects Landlord context using actual membership. Chat/Maintenance retain that process-local perspective. These are workspace preferences, never backend roles. Landlord-only accounts default to property management but can browse Discovery. Dual-role accounts default to Tenant mode on entry. Listings/My Properties use one dashboard entry; Post uses the existing creation preview. All use actual backend-loaded Landlord membership, not the selected mode or Tier 3. Mode switching and navigation invoke no `set_user_roles` operation.

`viewModels/marketplaceIntroduction.ts` coordinates an account-scoped device-local marker through `services/marketplaceIntroductionService.ts` and `marketplaceIntroductionStorage.ts` (existing AsyncStorage dependency). A confirmed signup records `pending`; only explicit Save or Skip records `done`. Opening the editor does not complete it. Keys contain the account ID and values contain only pending/done, never credentials, tokens, account snapshots or preference contents. Signup marker failures do not repeat signup; the controller retries the local write on eligibility checking.

Authoritative account routing still takes precedence: restrictions, Admin bypass, confirmed email, Tier 1 and backend-loaded roles. Before ordinary workspace entry the Auth ViewModel checks the marker; errors show Retry setup check instead of silently losing the offer. Checking/coalescing, epoch invalidation, disposal and account identity guards reject stale results. Sign-out clears memory, retaining the durable marker. Save/Skip must acknowledge storage before continuing; failure retains the introduction with recovery. Leaving through another marketplace tab keeps pending, so the offer returns after restart until Save/Skip.

Skip saves no preference edits. Save retains existing preferences in account-scoped App memory; their contents still disappear on restart/sign-out. Profile can reopen the editor. No preference backend, ranking, role mutation or second account owner was added. Auth callback synchronization and bootstrap coordination remain unchanged.

Limitations: markers cover successful signups observed after this correction, on this device. Older lost markers are not reconstructed from account age. Clearing app data, uninstalling or using another device loses this continuity. Existing cold-launch investigation remains unresolved.

Registration password correction: the first native input was reused from Email to Password while Confirm Password mounted fresh. Installed React Native Android setters can retain email variation flags when changing keyboard class, explaining the asymmetric secure-entry path. `AuthField` now gives each question/secure-field identity a distinct TextInput key and explicitly uses the default keyboard for password fields. Visibility is excluded from the key, preserving the mounted input and controlled value during Show/Hide; each field retains independent visibility. This source-level cause/fix is automated-tested; actual hiding, focus, autofill and keyboard behavior remain Android RUNTIME-UNVERIFIED. `models/authInputPresentation.ts` owns the pure identity mapping.

Manual Android acceptance: restart during email confirmation and phone OTP, finish Tier 1/roles, and expect the optional screen. Open then restart without Save/Skip and expect it again. Save or Skip, restart/sign in, and expect no repeat. Test another account, restricted/Admin precedence, local storage recovery, duplicate taps, normal Profile editing, and both password Show/Hide controls while preserving values/focus. Recheck dual-role navigation and existing verification flows without modifying approved records.

### UI refinement Phase 1 (2026-10-22)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Login uses the existing form scaffold with reduced top spacing, Android keyboard avoidance, next-field focus, password Show/Hide and keyboard submit. Inputs and registration navigation are disabled while signing in. Registration remains one question at a time with its existing validation and signup recovery.

Auth notices now carry a ViewModel-owned semantic tone: validation/service errors, successful saves/resends, pending/uncertain warnings and neutral instructions are distinct. Shared `FeedbackNotice` renders these tones without classifying message strings in Views. The root account snapshot, Auth subscription/bootstrap, service operations and routing precedence are unchanged.

Profile keeps the initials avatar fallback, real display name/bio and capitalized roles. A compact summary derives Tier 1/2/3 indications from existing backend profile timestamps via `models/accountPresentation.ts`; it does not fetch or invent submission states. Missing timestamps show Not Verified, with Not Applicable for ordinary Tier 1 onboarding bypassed by Admin and Tier 3 absent on a non-landlord. Existing timestamps remain evidence even when a role later changes. Tier 3 is explicitly an account indication, not approval of every property. The Verification action opens authoritative submission/property details; pending, under-review and rejection details remain there. No avatar upload or new profile query is added.

Profile now focuses on identity, verification summary, Edit Profile, Matching Preferences, Verification, Ratings & Reports and Account Settings. Notifications is now in the Discovery header. Discover Properties/My Properties duplicate rows and prominent mode pills are removed; the root-supplied marketplace toolbar preserves access. Labels and descriptions stack within flexible rows instead of competing horizontally. Edit Profile stays discoverable on Profile and Account Settings. Settings groups actual contact, role and account information without treating a missing phone as proof of failed verification. Shared buttons retain existing variants, allow text wrapping/system scaling, expose disabled accessibility state and use a darker green action token for readable white labels.

Manual Android acceptance: small-screen Login with keyboard open and larger system text; password Show/Hide and keyboard submit; invalid credentials versus informational/success notices; registration Back/Skip; Profile/Settings navigation and role-aware workspace entry; Tenant/Admin/non-landlord verification indications; verify an account Tier 3 badge never suggests all properties are approved. Existing cold-launch conclusions below remain unchanged.

### Registration experience (2026-10-22)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Registration retains the fullscreen, one-question-at-a-time layout, existing green theme and Roboto typography. The sequence remains name → preferred name → email → password → email confirmation → phone → SMS confirmation → roles. Preferred name is now optional with **Skip for now**; skipping clears it and uses trimmed first and last names as `display_name`. Password and confirmation share one step, require matching values and at least eight characters, and have independent Show/Hide controls. Email validation, input focus/keyboard hints, busy controls and inline errors support this flow.

The progress indicator shows the current stage out of eight; its filled portion excludes the current stage. It does not assert successful email/SMS verification or Tier 1 completion. Existing backend account facts still determine progression, including the pending Tier 1 synchronization screen and Tenant/Landlord/Both selection without a default role.

Only the password step's **Create account** action (or its keyboard submit) calls `useAuthProfilesViewModel.register`, which validates the complete draft and invokes the existing `accountService.signUp` through the existing mutation coordinator. Earlier Continue/Skip actions are local. The payload remains normalized email, unchanged password and `display_name` metadata; no new backend operation was introduced. A synchronous registration-local guard excludes duplicate requests, including rapid taps before React rerenders. Definitive backend validation errors permit a corrected manual retry; uncertain/network outcomes require checking email confirmation or signing in, without automatic signup retry. After a created/uncertain attempt, Back cannot return to editable pre-signup questions; ordinary Profile navigation is unaffected.

Before submission, Back preserves the in-memory draft. No credentials or registration draft are persisted. Confirmation password is cleared after account creation; both password fields are cleared when authoritative routing leaves email confirmation, or account state is cleared. The existing password remains in memory only for the existing manual email-confirmation return/sign-in path. Restarting loses an unfinished local draft; an already-created account uses confirmation/sign-in and existing account restoration. Android email deep links remain deferred.

`registrationFlow.ts` owns pure validation, display-name fallback, stage progress, Back recovery and a phase/generation request guard; it owns no account/session snapshot or external client. Views remain presentation-only. Auth services, account synchronization/bootstrap, routing precedence, phone_change OTP, Tier 1 refresh and role persistence are unchanged.

IMPLEMENTED, RUNTIME-UNVERIFIED: signup with display-name metadata; password sign-in; confirmation-link waiting/resend/manual return; Philippine phone change and six-digit phone_change OTP/resend; Tier 1 pending-status recovery; multi-role selection; persisted-session bootstrap; Auth event synchronization; profile read/display-name/bio update; sign-out/account switching; restricted routing; Admin onboarding bypass.

PREVIEW/LEGACY: marketplace feature contents are not made backend-backed merely by authenticating their entry. Connected verification/Admin behavior is documented separately in [User Verification](USER_VERIFICATION.md) and [Admin Verification](ADMIN_VERIFICATION.md).

DEFERRED within this feature: avatar upload, Google OAuth, password recovery, post-onboarding contact changes and Android email deep-link/redirect configuration. Profile opens the separate user verification workflow; see [User Verification](USER_VERIFICATION.md) for Tier 2/Tier 3 implementation and evidence. This does not change Auth/account ownership, startup or roles.

## Known issues and unresolved decisions

- Initial Phase 1 validation was static/unit-only. Subsequently the user reported normal-user sign-in PASS, Admin sign-in PASS and session identity restoration PASS. These are user-reported runtime results, not additional live tests performed by the agent; they do not establish every onboarding/RLS flow.
- The user reproduced intermittent cold-launch infinite loading again after the previous changes. The modeled completion-ownership race has regression coverage, but the remaining runtime cause is unresolved; see the second investigation below.
- Email confirmation still opens outside the app; the user returns and confirms/signs in. No new deep-link integration was added.
- SMS settings, trigger timing and restricted/multi-role/Admin records require runtime tests.
- Account reads that fail retain error presentation; database changes without Auth events are not proactively polled.
- Async request coordination is unit-tested; full React/native lifecycle and actual Supabase callback timing remain runtime-unverified.

### Cold-launch infinite-loading bugfix (2026-10-18)

Observed runtime report: fully closing/reopening sometimes restored the session and sometimes never left initial loading. Returning to the normal landing workspace is acceptable; no previous-activity restoration was requested or added.

Reproduced code-level root cause: bootstrap awaited an explicit refresh and then unconditionally marked success/cleared notice. A startup SIGNED_IN/USER_UPDATED could invalidate that read and schedule a replacement. If the replacement failed first, its callback exposed an error, but the older read could later resolve as stale/null; bootstrap's unconditional tail then erased the error while screen remained bootstrap. Retry is rendered only for asyncState error, so it disappeared. A never-settling getSession/getUser/profile/role operation also had no bounded recovery. The exact triggering event/network condition on the user's device remains unconfirmed without a runtime trace; the orchestration race was reproduced locally without pretending to run Supabase.

Fix: coordinator-owned bootstrap with no stale caller completion; current results/errors alone update startup state; a non-extendable startup deadline plus per-read deadline; existing error/Retry recovery; late/stale results ignored; sign-out/disposal cancel timers. Accepted account snapshots always leave bootstrap. Subscription ownership, deferred event callbacks, explicit-mutation suppression, routing precedence, Admin bypass and normal editor/OTP preservation are retained.

Regression coverage in accountSynchronization.test.ts now includes replacement failure followed by stale original success, replacement success while the original hangs, hung-load timeout/Retry with late-result rejection, event churn that cannot extend startup deadline, sign-out/disposal deadline cancellation, initial-load failure and signed-out startup resolution. These are coordinator/UI-callback model tests, not live React Native/Supabase integration tests.

Status: **RUNTIME RETEST REPRODUCED THE ISSUE — INVESTIGATION OPEN**. The user subsequently reported an infinite-loading occurrence around the sixth cold launch despite earlier successful launches. The previous code changes address modeled failure paths but do not establish cold-launch reliability. The underlying network/Auth operation is not physically aborted by the recovery timer; a persistently blocked dependency may cause Retry to time out again rather than authenticate. No session is fabricated or discarded to dismiss loading.

### Second cold-launch investigation (2026-10-18)

Development-only `[AUTH-BOOT]` tracing now records module/App/ViewModel/View mounts, subscription lifecycle, Auth events, request generations, individual account-read stages, deadlines, state and workspace decisions. Logs use an explicit field whitelist and contain presence flags rather than identities, credentials or account/document contents. Production logging is disabled. Two new tests cover omitted sensitive extra fields and production silence.

Live emulator evidence: a persisted ordinary-user account reached Discovery; the first launch in the subsequent monitored repeat sequence also reached Discovery. In that sequence, the second launch emitted no new app trace during 24 seconds; a follow-up Android activity inspection showed the launcher in the foreground. This does not reproduce or explain the user's visible infinite-loading screen. No remaining root cause or second behavioral fix is claimed. Admin repeated launches and recovery deadline presentation were not live-validated in this pass.

Source inspection confirms the Auth loading presentation depends on `screen === 'bootstrap'`, and Retry depends on `asyncState === 'error'`. The startup deadline invokes the current ViewModel error callback, which sets the notice and error state. This reaches Retry when the Auth View is mounted and JavaScript/native rendering progresses. The root SafeAreaProvider also gates child mounting on native insets; this is a candidate to distinguish with traces, not a confirmed defect. Expo/native startup before JavaScript is outside the account timer. Workspace initialization has no separate asynchronous startup loader.

See [the second investigation report](../../RENTLEASE_PHASE_1_COLD_LAUNCH_INVESTIGATION_2.md) for the state map, evidence limits and failed-run capture instructions. Repeated device testing remains required; no extra timeout, routing change or session reset was introduced.

## Runtime tests still needed

Registration refinement Android checklist (RUNTIME-UNVERIFIED):

- Walk forward/back through name, optional preferred name, email and password; retain draft values, test Skip after entering a preferred name, and confirm full-name fallback on the resulting profile.
- Test invalid email, short/mismatched passwords, both Show/Hide controls, input focus, autofill, keyboard visibility, scrolling and larger system text on a small Android screen.
- Rapidly tap Create account; confirm only one signup occurs. Exercise network/uncertain outcomes, Back and sign-in/email recovery without another automatic signup.
- Complete real email confirmation/resend/manual return, Philippine phone_change SMS OTP including invalid/expired codes/resend, pending Tier 1 refresh, then Tenant, Landlord and Both on suitable test accounts. Progress must follow authoritative state.
- Restart before signup and after signup; verify local draft loss versus existing confirmation/sign-in recovery. Recheck restricted/Admin routing and normal Profile Back behavior.

1. Repeated cold-launch retest for an ordinary user and Admin: sign in, fully close the Expo app/session, reopen, and confirm every attempt reaches the normal destination, signed-out screen or error with Retry. Repeat several launches (at least 10 per account), including quick restarts and a network-unavailable launch followed by reconnect/Retry. Report success/error outcomes and whether Retry is always available after a stalled attempt. Cold-launch reliability is not yet marked passed.
2. Signup → confirmation email/resend → manual return → real SMS request/invalid/expired OTP/resend → backend Tier 1 → role selection.
3. Admin with no Tier 1 enters Admin; inactive Admin remains restricted.
4. Token refresh and repeated sign-in events do not reopen Discovery or discard profile drafts/OTP input.
5. Sign-out/session loss while account loading cannot restore the old account; account switch cannot show another user's workspace/form state.
6. Profile save persists display name/bio and respects freshly changed restriction/roles/onboarding state.
7. Network failures recover through existing controls without reload loops.

## Relevant files and backend contract

- `App.tsx`
- `src/features/authentication/models/AuthProfile.ts`, `models/accountRouting.ts`
- `src/features/authentication/viewModels/useAuthProfilesViewModel.ts`, `viewModels/accountSynchronization.ts`
- `src/features/authentication/viewModels/registrationFlow.ts`
- `src/features/authentication/viewModels/marketplaceIntroduction.ts`, `src/shared/models/marketplaceNavigation.ts`
- `src/features/authentication/services/accountService.ts`
- `src/features/authentication/views/` (existing layouts retained)
- `src/shared/services/supabase/client.ts`, `database.types.ts`
- `tests/accountRouting.test.ts`, `tests/accountSynchronization.test.ts`, `scripts/run-tests.cjs`
- `tests/registrationFlow.test.ts`
- `tests/marketplaceNavigation.test.ts`, `tests/marketplaceWiring.test.ts`

Structural contract: generated `profiles`, `user_roles`, `app_role`, `account_status`, `set_user_roles`. Auth email/phone confirmation and backend trigger/RLS behavior require the confirmed business contract, not inference from generated Insert/Update fields.

## Relevant Git history

- `05c70bd`: original UI previews.
- `af9778f`: real Auth/Profile integration, roles and Admin routing baseline.
- `9849232`: generated database contract and typed singleton.
- `cf59ffb`: user-created commit containing Phase 1 Auth stabilization and document foundation.
- This targeted cold-launch fix is uncommitted; no commit was created automatically.

## Last Verified (registration / Phase 1 history)

Date: 2026-10-22.

Last Verified Commit baseline: `c2a1b9f` plus uncommitted UI Phase 1 changes. The baseline contains the earlier registration/verification work, but not this UI refinement; no commit was created.

Registration checkpoint: refinements IMPLEMENTED / AUTOMATED-TESTED (`npm run typecheck` passed; full `npm test`: 180 passed, 0 failed, including 12 registration helper tests and two additional routing tests). These tests exercise pure flow/coordination contracts, not rendered native interactions or live signup/SMS. Registration Android behavior remains RUNTIME-UNVERIFIED. Historical normal-user/Admin sign-in and session identity restoration: USER-REPORTED PASS. A persisted ordinary-user emulator launch reached Discovery during the earlier investigation. Cold-launch reliability: ISSUE REPRODUCED BY USER; ROOT CAUSE STILL UNRESOLVED. Historical investigation test counts describe their original passes, not the current suite.

Compatibility check: `npx expo install --check` reports existing patch-version drift: installed `expo@57.0.30` versus expected `~57.0.31`, and `expo-location@57.0.21` versus expected `~57.0.22`. No dependencies were added or upgraded for registration. Git working/index whitespace checks passed.

Android production JS/Hermes export passed (912 modules) to a temporary directory. This validates bundling only; it is not an APK build or Android runtime acceptance test.

### UI Phase 1 validation record

Last Verified Date: 2026-10-22. Last Verified Commit baseline: `c2a1b9f` plus uncommitted UI refinements; these changes are not in that commit. Verification Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. `npm run typecheck` passed; `npm test` passed **188/188**, zero failures/skips/cancellations. Eight additional tests cover status/role/applicability mappings, contextual recovery, Tier 3 selection/confirmation cancellation with no writes, and Login/confirmation/recovery source wiring. Existing Auth routing, registration, synchronization, Tier 2/Tier 3 upload, Admin review and private-preview regressions remain. Native rendering/gesture/keyboard/live acceptance is not implied.

Android JS/Hermes export passed to a temporary folder (bundling only, not an APK/runtime test). `npx expo install --check` reports existing installed `expo@57.0.30` versus expected `~57.0.31`, and `expo-location@57.0.21` versus expected `~57.0.22`; no dependencies were added/upgraded. Backend services, schema, RLS, RPCs, Storage operations, Auth synchronization and root `App.tsx` remain unchanged. Source review found no View-level backend access or new MVVM violation. Shared presentation primitives affect button wrapping/disabled feedback across their existing consumers; untested marketplace operations remain unchanged.

## Phase 2 validation record

Last Verified Date: 2026-10-22. Last Verified Commit baseline: `bfe567d` plus uncommitted Phase 2 changes; the commit does not contain this phase. Verification Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**.

`npm run typecheck` passed. `npm test`: 202 passed, 0 failed/skipped/cancelled, including 14 new navigation/provenance/guard/filter-projection/source-wiring tests. Existing Auth routing/synchronization, registration, Tier 2/Tier 3, Admin review, private preview and PHT formatting regressions remain. Tests are Node model/controller/source-wiring checks, not native rendered interaction or live security acceptance.

Android JS/Hermes export passed to a temporary directory (922 modules; not an APK or runtime test). `npx expo install --check` still reports installed `expo@57.0.30` versus expected `~57.0.31` and `expo-location@57.0.21` versus expected `~57.0.22`. No dependency was added/upgraded. Working-tree/staged whitespace checks passed. Final source review found no new View-level data access, cross-feature ViewModel dependency, role mutation or duplicate Auth/client owner. No live account/submission writes or new Android acceptance tests were performed. No commit/merge/push was made.

### Phase 2 corrections validation (2026-10-22)

Baseline commit: `550275c` plus uncommitted corrections; these changes are not contained in that commit. Status: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Typecheck passed; full suite passed 213/213, zero failures/skips/cancellations. Eleven additional tests cover durable onboarding continuity, account/restart/error/stale-response handling, native input identity and presentation wiring. Tests are model/controller/source checks, not native or live signup acceptance. New tests: `tests/onboardingContinuity.test.ts`, `tests/authCorrections.test.ts`. Existing navigation tests were updated. No new dependency, backend change, commit or push.

Corrections compatibility validation: Android Metro/Hermes export passed (925 modules) to a temporary directory; this is bundling only. Expo install --check exited 1 for pre-existing expo 57.0.30 (expected ~57.0.31) and expo-location 57.0.21 (expected ~57.0.22). No dependencies changed. Git working-tree and staged whitespace checks passed. Source review found no new MVVM violation. FEATURES.md, FRONTEND_CONTEXT.md and AUTH_SUPABASE_INTEGRATION.md retain accurate existing status/boundaries and were intentionally unchanged.

## Designer-led UX refinement (2026-10-22)

Status: IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Last Verified Commit baseline: `976d13d` plus uncommitted UX changes; that commit does not contain this pass.

The design uses existing Roboto/green tokens, neutral surfaces, stronger text hierarchy and consistent 48dp navigation targets. Shared `ScreenHeader.tsx` replaces inconsistent Back/header chrome across Auth, Verification and Admin; its compact chevron is separate from the touch target and titles can wrap. Welcome now refines the earlier brand-led, card-based entry design, with responsive AuthBrand and clear Sign in/Create account actions; the first minimalist redesign was superseded following Android feedback. Sign in removes its duplicate oversized wordmark while preserving all form handlers, visibility and validation.

Registration keeps one question per step. `OnboardingAccountOptions.tsx` provides a collapsed Account options footer, revealing signed-in identity and the existing safe sign-out/switch action. It cannot switch accounts merely by expanding. Controls remain disabled during explicit operations. Ordinary phone onboarding no longer shows a permanent refresh button; bounded automatic checks and contextual recovery are described above.

Matching Preferences removes the tall hero, repeated introductory headings and multicolor selection treatments. Its bounded, keyboard-aware scroll form uses green only for selected choices. A separate bounded footer above the existing safe-area toolbar owns Save and continue/Save preferences plus optional Skip for now. Footer actions retain existing ViewModel Save/Skip, storage acknowledgement, duplicate guards, error display and unsaved navigation confirmation. Preference contents remain session-local; pending/done introduction continuity is unchanged.

Sources added: `shared/components/ScreenHeader.tsx`, `authentication/components/OnboardingAccountOptions.tsx`, `authentication/viewModels/onboardingStatusCheck.ts`. Existing Auth/Profile/scaffolds/Settings/Welcome/SignIn, root composition and Matching Preferences presentation are updated. No service, backend, credential persistence, navigation framework, dependency or authorization change.

Validation: typecheck passed; full `npm test` 223 passed, 0 failed/skipped/cancelled. Ten new model/source-wiring tests cover bounded lifecycle checks, accessible account switching, footer Save/Skip, Profile reachability, role-aware workspace entry, contextual Admin refresh, status labels and shared navigation. These are not rendered native integration tests. Existing onboarding/registration/continuity, Tier 2/3, Admin review/private previews and PHT regressions remain. Agent observed Welcome and Sign in on an Android emulator at approximately 411dp/font scale 1.0 without submitting credentials. This is limited visual evidence, not user acceptance or live onboarding success. Smaller widths, large fonts, keyboard/focus, role variants and authenticated revised screens still require manual testing. Existing cold-launch investigation remains unresolved.

Manual acceptance: test phone OTP and background/return without code loss, pending auto-check plus offline/retry, collapsed Account options and safe switching; Save/Skip and restart continuity; Profile account links and dual-role Discover/Listings/Post; tenant denial and Admin precedence. Inspect all layouts at narrow width and enlarged fonts, then recheck native Back and existing verification previews/submission flows on suitable test records.

UX compatibility checks: Android Metro/Hermes export passed (924 modules) to a temporary directory, not an APK/runtime test. `npx expo install --check` exited 1 for pre-existing expo 57.0.30 versus ~57.0.31 and expo-location 57.0.21 versus ~57.0.22; no upgrade was applied. Working-tree and staged whitespace checks passed. FEATURES.md remains an accurate concise status index. FRONTEND_CONTEXT.md, BACKEND_CONTEXT.md and AUTH_SUPABASE_INTEGRATION.md remain unchanged because their stack/structural/backend boundaries did not change. No commit, merge or push was made.

## Targeted corrections and Profile return (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED. Baseline `976d13d` plus earlier uncommitted UX work and these targeted corrections. Existing local work is preserved.

Confirmed root cause: workspace-to-Profile callbacks discarded workspace state, and root Profile had neither an onBack callback nor a hardwareBackPress handler. Android therefore handled Back outside internal navigation. App now captures a single owner-scoped AppWorkspace entry plus permitted actor mode. `shared/models/profileReturn.ts` validates it against current identity, marketplace eligibility, Admin precedence and role membership before use; logout, identity changes or lost eligibility clear/invalidate it. Profile's visible header Back and root Android Back invoke the same return function. The handler runs only on Profile with a valid target, no workspace and no sign-out dialog, and removes its subscription on cleanup. Modal Back continues to delegate to existing feature actions; draft exit confirmation stays feature-owned.

Return restores the supported workspace entry, not every nested feature screen or discarded draft. No persistent route stack or second navigation framework is introduced. No target means no invented unauthorized return. Profile edit/settings and onboarding actions remain owned by the Auth ViewModel.

Welcome uses the earlier design's stronger wordmark/tagline and two actionable cards with restrained green emphasis, flexible sizing and readable copy. Small-width/large-font branding uses the compact variant; only the decorative wordmark caps scaling, while functional text retains system scaling. The newer SignInView was preserved byte-for-byte in this targeted pass (SHA256 BCCFBD4C2775FC3E9195B59AE4E5879B85F980FAD09F86B09E5393DE9B6CF63E).

Profile Verification now uses a document/check icon and Ratings & Reports a review-bubble/star icon through shared InterfaceIcon, with action labels supplied by ProfileActionRow. No icon dependency was added. Notifications moves to the Discovery header through existing root preview navigation; its redundant Profile row is removed. Discover/For You actions and unfinished preview boundaries remain unchanged.

Typecheck and full suite passed 231/231 (0 failed/skipped/cancelled), including eight additional return/Back/header/icon/status/rejection regression tests. Existing rejected-status workflow guards remain. Agent observed Admin Dashboard -> Exit -> Profile with visible Back -> Android Back -> Admin Dashboard in the existing Android development build, without review/account writes. This narrow observation is not user acceptance of ordinary Discovery, role switching, logout/restriction races, large fonts or draft guards. Test those cases manually; no native success for untested flows is claimed.

Targeted compatibility: Expo install --check reports the same pre-existing expo 57.0.30/~57.0.31 and expo-location 57.0.21/~57.0.22 patch drift, with no dependency changes. Git working-tree/index whitespace checks pass. FEATURES.md remains an accurate concise index; FRONTEND_CONTEXT.md and AUTH_SUPABASE_INTEGRATION.md retain accurate stack/Auth contract boundaries and were intentionally unchanged. No commit/merge/push occurred.

Final targeted bundle validation: Android Metro/Hermes export passed (926 modules) to a temporary directory. Agent also repeated Admin Exit -> Profile -> visible header Back -> Admin Dashboard successfully. Both native Back observations are limited to that existing development-build Admin session; user acceptance and ordinary-user return flows remain RUNTIME-UNVERIFIED.
