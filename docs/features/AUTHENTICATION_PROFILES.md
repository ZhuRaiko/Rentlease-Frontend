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

Historical first correction added a single owner-scoped Profile return target and native Back handling. The later navigation audit below supersedes its capture-every-workspace behavior: a dismissed child is not a valid Profile predecessor. Earlier agent-observed Admin exit/return evidence remains historical and does not validate the current navigation corrections.

Return restores the supported workspace entry, not every nested feature screen or discarded draft. No persistent route stack or second navigation framework is introduced. No target means no invented unauthorized return. Profile edit/settings and onboarding actions remain owned by the Auth ViewModel.

Welcome uses the earlier design's stronger wordmark/tagline and two actionable cards with restrained green emphasis, flexible sizing and readable copy. Small-width/large-font branding uses the compact variant; only the decorative wordmark caps scaling, while functional text retains system scaling. The newer SignInView was preserved byte-for-byte in this targeted pass (SHA256 BCCFBD4C2775FC3E9195B59AE4E5879B85F980FAD09F86B09E5393DE9B6CF63E).

Profile Verification now uses a document/check icon and Ratings & Reports a review-bubble/star icon through shared InterfaceIcon, with action labels supplied by ProfileActionRow. No icon dependency was added. Notifications moves to the Discovery header through existing root preview navigation; its redundant Profile row is removed. Discover/For You actions and unfinished preview boundaries remain unchanged.

Typecheck and full suite passed 231/231 (0 failed/skipped/cancelled), including eight additional return/Back/header/icon/status/rejection regression tests. Existing rejected-status workflow guards remain. Agent observed Admin Dashboard -> Exit -> Profile with visible Back -> Android Back -> Admin Dashboard in the existing Android development build, without review/account writes. This narrow observation is not user acceptance of ordinary Discovery, role switching, logout/restriction races, large fonts or draft guards. Test those cases manually; no native success for untested flows is claimed.

Targeted compatibility: Expo install --check reports the same pre-existing expo 57.0.30/~57.0.31 and expo-location 57.0.21/~57.0.22 patch drift, with no dependency changes. Git working-tree/index whitespace checks pass. FEATURES.md remains an accurate concise index; FRONTEND_CONTEXT.md and AUTH_SUPABASE_INTEGRATION.md retain accurate stack/Auth contract boundaries and were intentionally unchanged. No commit/merge/push occurred.

Final targeted bundle validation: Android Metro/Hermes export passed (926 modules) to a temporary directory. Agent also repeated Admin Exit -> Profile -> visible header Back -> Admin Dashboard successfully. Both native Back observations are limited to that existing development-build Admin session; user acceptance and ordinary-user return flows remain RUNTIME-UNVERIFIED.

## Navigation Back correction (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Baseline `9d9e9c9` plus uncommitted changes. Root composition and pure `shared/models/profileReturn.ts` now retain only an authorized top-level Profile predecessor; dismissed child flows preserve it rather than replacing it. Profile Back falls back to the current authorized landing when needed. Visible/hardware Back share this policy. Hardware Back in Edit Profile/Settings invokes the existing guarded Auth goBack; loading consumes Back and the sign-out dialog retains priority. Auth bootstrap, onboarding, account synchronization, persistence and backend calls are unchanged.

Identity/restriction/role changes invalidate stale workspace/return targets; no ordinary destination is restored for an Admin. Root Modal callbacks are scoped to account/workspace and removed on feature cleanup. See [Routes](../ROUTES.md#navigation-back-audit-correction-2026-10-22) for complete parent/tab/Close policy and Android checklist. Typecheck and 267/267 automated tests pass; native Back, sign-out, account switching and role/restriction transitions require Android acceptance. No new runtime verification is claimed.

### Bottom-tab Back distinction (2026-10-22)

Root hardware Back no longer uses Profile as a generic marketplace fallback. Discovery Home requests Android exit confirmation; Listings/Post, Chat and Tenancy roots return to Discovery after existing feature/draft guards. Explicit Profile entry and account-scoped Profile return handling remain intact. Exit does not sign out; Auth/onboarding/session contracts are unchanged. See Routes for native confirmation lifecycle and Android tests. IMPLEMENTED / AUTOMATED-TESTED (274/274 suite) / Android RUNTIME-UNVERIFIED; baseline `9d9e9c9` plus uncommitted navigation changes.

## Profile folio overhaul (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Last Verified Date: 2026-10-22. Last Verified Commit: baseline `01c1a5b` plus uncommitted Profile/Verification presentation work; this commit does not contain the redesign. Earlier dark/pale full-width island headers and three summary cards are superseded by this composition.

Profile retains an open, sectioned folio layout, refined after the overhaul: a circular initials avatar beside the wrapping display name and real roles, with optional biography and Edit below. The extra account eyebrow and oversized standalone name were removed. The avatar now uses equal width/height and half-diameter rounding rather than the earlier asymmetric island corners. ProfileAvatar reserves additional circular space as system font scale grows. Name, roles and bio wrap naturally without fixed text heights or font-scaling caps; the identity copy flexes beside the avatar with minWidth zero. Increased top spacing and a 22px/600 name replace the earlier crowded 34px/800 hierarchy. Section titles use 18px/600, body 16px and supporting/action/status text 14px, reducing weight/size shifts. Existing initials fallback remains. ProfileAvatar can render an optional supplied ImageSource with cover cropping inside the clipped circle, but no remote avatar source or upload integration was present or added. No new profile field or external integration is introduced.

A single verification ledger follows, with three compact rows containing tier number, tier/domain label and the unchanged backend-derived status, displayed as a small outlined indicator plus readable text rather than a filled pill. Tier identity colors come from shared verificationTierIdentities, matching the accepted Verification overview without copying its cards. Per-tier explanatory descriptions are omitted from Profile rendering. One concise requirement line distinguishes mandatory Account from optional Identity/Property; one property-scope note preserves the account-level versus individual-property distinction. Profile still shows timestamp/applicability summaries, not submission details, progress percentages or new trust calculations.

The ordinary user's existing Verification entry is now View details beside the ledger heading. Matching Preferences is grouped under Preferences; Ratings & Reports and Settings under Account & safety. Admin sees Administration and its existing moderation action, retains Settings, and does not receive ordinary Verification/preferences/review actions. ProfileActionRow is used only here and now renders a compact action list with existing callbacks/press feedback. Edit Profile, notices, root-supplied Back, bottom navigation and safe-area/scroll composition remain. No ViewModel/service/Auth/backend/navigation/dependency changes were needed; source review found no MVVM violations.

Validation after the calmer Profile refinement: typecheck PASS; full suite 286/286 PASS, zero failures/skips/cancellations; whitespace PASS. Coverage includes tier contrast, shared identities, real status labels, all account-role/applicability mappings, absent profiles, removed repeated explanations, action/source wiring and wrapping/scaling constraints. Presentation assertions were updated for intentionally removed layout treatments and status pills; semantic/action/Back assertions were retained. Added checks cover name placement, professional headings and confirmed/pending/negative/unverified indicator selection. Node tests do not render Android or prove native accessibility.

Android screenshot acceptance: compare this open composition against the superseded header/card stack and the accepted Verification overview. Test 320/375/414dp widths, portrait/landscape, large fonts, very long names, multiple roles and no/long bio. Check the curved initials tile, Edit target, grouped tools, ledger wrapping, TalkBack tier/status announcements, all timestamp/applicability states and the property-scope note. Exercise ordinary/Admin account layouts, Verification details, preferences, ratings, Settings, Edit, Profile Back, bottom navigation and scrolling above safe areas. No native screenshot/runtime acceptance was performed in this pass.

The Profile refinement treats Profile as an independent product surface rather than a small copy of Verification. Tier accents remain recognizable and the later Verification refinement adopts the shared light status indicator without copying Profile composition. Shared verificationIndicatorKind (retained under the profileVerificationIndicator compatibility export) maps the existing StatusPresentation to check/pending/error/unavailable/unverified marks without changing labels or deriving verification state. Profile currently receives timestamp/applicability statuses; pending/review glyph support does not add submission-status loading. Visible text and grouped TalkBack tier/status labels remain. No per-tier descriptions were restored; the short property-scope note is retained. IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED, 2026-10-22, baseline `01c1a5b` plus preserved uncommitted changes. Confirm the new identity row, long names/dual roles, font scaling, status symbols/text and action spacing with Android screenshots; no native rendering acceptance is claimed.

### Circular avatar and shared indicator follow-up (2026-10-22)

The user accepted the Profile composition; this pass changes only its avatar frame and extracts the existing status presentation into shared VerificationStatusIndicator. Name/roles/bio/Edit/spacing, grouped tools, compact ledger, bottom navigation and Back callbacks remain. No Auth/ViewModel/service change. VerificationStatusBadge remains available and Admin rendering is unchanged. Last Verified Date: 2026-10-22; baseline `01c1a5b` plus preserved uncommitted UI work. IMPLEMENTED / AUTOMATED-TESTED (typecheck and 286/286 suite PASS, whitespace PASS) / Android RUNTIME-UNVERIFIED.

Android acceptance: compare Profile against the accepted screenshot, expecting only a circular avatar. Check circle shape/initials at narrow widths and large fonts, long names/dual roles and unchanged spacing/actions. Optional photo-source rendering is implemented with cover/clipping but has no live upload/source workflow; verify it with an approved supplied source before connecting one. No Android rendering/photo-upload success is claimed.

### Everyday housing-app polish (2026-10-22)

Profile layout and circular avatar remain unchanged. ProfileActionRow now gives existing Matching Preferences, Account Settings and Admin asset icons the same primaryAction tint as drawn Ratings & Reports/Verification icons; asset/drawn icons share a 30dp slot and 24dp artwork. The smaller Edit asset also uses brand tint. Actions, labels, routes, roles and data are unchanged. This is presentation only, with no new dependency or MVVM boundary change.

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED, baseline `01c1a5b` plus preserved uncommitted UI changes. Typecheck PASS, full suite 288/288 PASS (zero failed/skipped/cancelled), whitespace PASS. Automated checks cover shared icon tint/slots and preserved actions/status semantics. Compare icons and text hierarchy on Android with narrow widths, large fonts and the accepted Profile screenshot; no native rendering acceptance is claimed.

### Brand and neutral hierarchy refinement (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED, on `feature/ui-improvements` with existing uncommitted changes preserved. This supersedes earlier pastel tier and green navigation styling: Matching Preferences, Ratings & Reports and Account Settings use `textSecondary` gray. The circular avatar uses the established `primaryAction` green with white initials; photo cover/clipping and scalable diameter remain. Name/bio and tier labels use neutral text, supporting copy uses secondary gray, and Edit/verification details retain meaningful brand emphasis. Shared 01/02/03 markers use neutral `surfaceStrong` backgrounds with `primaryAction` numbers, independent of actual status. Profile structure, roles, biography, all callbacks, status values and accessibility scaling remain.

Validation: typecheck PASS; npm test 288/288 PASS, zero failures/skips/cancellations; git diff --check PASS. Existing icon assertions were updated to the requested gray treatment; no business expectations changed. No screenshots were supplied or Android runtime performed. Inspect narrow screens, long names/bios, increased font scaling and tenant/landlord/dual-role accounts; confirm gray row icons, readable avatar and unchanged Edit/details/settings destinations.

### Restrained neo-brutalist Profile presentation (2026-10-23)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. This supersedes the unframed Profile presentation described above. The existing identity layout now sits in a neutral panel with a dark green outline, firm bottom/left edges and shared 4dp `radius.firm` corners. The circular green avatar retains its scalable diameter, initials fallback and optional photo clipping; its edge is defined with existing dark green ink. The wrapping name is 24dp/800, roles use restrained green and body text remains readable neutral. Edit retains its action and outlined treatment with firmer corners.

The compact verification summary gains a framed boundary and stronger heading rule. White outlined 01/02/03 markers use shared green ink independently of status. Preferences and Account & safety retain separated rows, thin dividers, gray navigation icons and existing callbacks beneath stronger section rules. No account data, role/status mapping, ViewModel, service, navigation or backend behavior changed. `PRODUCT.md` and `DESIGN.md` record this scoped direction using existing project tokens.

Validation: npm run typecheck PASS; npm test 288/288 PASS, zero failures/skips/cancellations; git diff --check PASS. Existing uncommitted work is preserved and nothing was committed. Source review retained wrapping, minWidth: 0, default font scaling and 48dp targets; it is not native layout verification. Android acceptance remains required at narrow widths and large fonts with long names/bios, tenant-only/landlord-only/dual-role accounts, exact status labels, Edit/details/settings and bottom-navigation/Back behavior.

### Current Phase 1 marketplace refinement (2026-10-23)

Profile follows the user's showcase: softly tinted identity, circular avatar, 20dp name, lighter roles/bio, outlined Edit profile, unboxed verification summary and divided settings. Compact tier marks retain exact status text and property scope. Shared recipes use 12dp panels, 10dp controls and thin neutral rules; existing Auth screens inherit primitives without workflow/layout redesign. All account data, role mappings, callbacks, ViewModels and services remain unchanged. The dual-role ordinary session was visually inspected; tenant-only/landlord-only and extreme content still need acceptance.

Validation (2026-10-23): baseline `66afe39` plus uncommitted changes on `feature/ui-improvements`; IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED. Typecheck PASS, 288/288 tests PASS with zero failures/skips/cancellations, staged/unstaged whitespace PASS. Agent inspected all five representative surfaces at approximately 411dp/100% and 320dp/150%, then restored 1080x2400/420dpi/font scale 1.0. This is visual evidence for observed records, not user acceptance, live security validation or all role/status/error coverage. No backend/private-document/submission/moderation write occurred. See [current refinement report and screenshots](../implementation-reports/ui/2026-10-23-phase-1-marketplace-refinement.md). Earlier strong framing and ANR-limited evidence are historical, superseded for this observed pass. Phase 2 remains deferred.

### Header containment correction (2026-10-23)

The shared AuthScaffold and VerificationScaffold now keep ScreenHeader outside their scrolling bodies, preventing navigation from moving partly out of the safe viewport. ScreenContainer remains the single top/side safe-area owner at the flow boundary. No extra inset, fixed header height, font limit, status-bar/global theme, ViewModel, callback or backend change. Main titles/forms still scroll; Back/Close remain visible with their original distinct actions. Existing uncommitted gradient work is preserved.

IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED, baseline `6f004eb` plus uncommitted work. Typecheck and 290/290 tests PASS, zero failures/skips/cancellations; whitespace PASS. Agent observed Tier 2 and Matching Preferences at normal approximately 411dp/100% and narrow 320dp/150%, plus Edit Profile with keyboard/scroll at normal size. Matching Preferences clipping did not reproduce; its existing external header/insets were left unchanged. Original emulator display/font settings restored. Other status/role/cutout devices and signed-out Auth flows still require runtime acceptance. See [audit and before/after evidence](../implementation-reports/ui/2026-10-23-header-layout-correction.md).

Matching Preferences follow-up: user clarified the intro heading was too close to the navigation row, rather than clipped. DiscoveryFilterView's intro block now has 24dp top content padding using spacing.lg. Safe-area ownership and header styling are unchanged. Agent inspected the normal-size Android result; typecheck/whitespace PASS. No behavior change or new large-font acceptance claim.

### Compact Profile tier identity (2026-10-23)

AccountVerificationSummary now adds Profile-only right-weighted row fades in the existing emerald/teal/amber category hues: neutral through 60% width, gradually reaching 10% color opacity at the right edge. Matching pale category surfaces and dark category inks tint the 01/02/03 chips. Dividers, spacing, wrap behavior, labels, exact statuses, scope and callbacks are unchanged. VerificationStatusIndicator still owns semantic inks/symbols; Not Verified stays neutral. No shared identity-model/theme or verification overview changes in this pass. Agent inspected actual before/after at default Android settings; narrow/large-font and other status records were not freshly inspected. Typecheck and 290/290 tests PASS, zero failed/skipped/cancelled; whitespace PASS. User acceptance remains RUNTIME-UNVERIFIED. See [comparison](../implementation-reports/ui/2026-10-23-profile-verification-identity.md).

Profile row-edge follow-up: the native background already filled each row, with no parent radius/overflow truncation; the visible seam came from ending the gradient at maximum opacity against the white folio gutter. The unchanged 10% peak now sits at 94%, feathering through 3% at 98% to transparent at 100%. Earlier stops, colors, chip/status styles, geometry and dividers remain unchanged. Default Android capture inspected; typecheck/whitespace PASS. No fresh full-suite/narrow-state acceptance for this small stop adjustment.

Profile verification strip follow-up (2026-10-23): restored the pre-feather gradient distribution, neutral through 60% and rising through 2%/5% to 10% at the right edge. Each existing compact row now has an explicit white surface, shared radius.sm (8dp) and overflow:hidden; gradient fills the whole row and clips at its rounded boundary. Removed redundant bottom separator lines, retained 4dp inter-row gap and existing vertical padding, labels, tinted number chips and status semantics. No added outline/shadow or functionality change. Agent compared the earlier stronger capture and inspected normal Android after a clean reopen; a Fast Refresh clipping artifact did not persist after relaunch. Typecheck, 290/290 tests and whitespace PASS. No new narrow/font/state acceptance; uncommitted, awaiting user review. See the current Profile identity report for capture.

Profile verification left-identity refinement (2026-10-23): only AccountVerificationSummary changes. Emerald/teal/amber fades now start behind the number chips, with three soft plateaus (18% opacity through 20% width, 10% at 24-27%, 4% at 31-34%), fading completely by 40%. Remaining 60% stays white. Existing 8dp clipped strips, chip styling, type, padding/gaps and status semantic colors/wording remain. A padding-free white status backing and auto left margin retain right alignment when accessibility text wraps. Full overview-card right-side gradients are unchanged. Agent inspected normal and 320dp/150% text, including neutral Not Verified wrapping at right; original display restored. Typecheck, 290/290 tests and whitespace PASS. No functionality/state/navigation change; user acceptance pending. See current Profile identity report for before/after and enlarged capture.

Profile number-anchor follow-up (2026-10-23): boxed tier chips are replaced by unboxed 22dp/28dp, weight700 category-colored numbers. The leading slot grows from 32dp to 40dp, shifting labels slightly right while the flexible label/status area retains its right edge. Slot minimum height remains32dp, row padding/gap and left gradients unchanged. Removed unused chip-surface colors; existing number values, labels, status semantics and callbacks remain. Normal Android capture inspected; typecheck, 290 tests and whitespace PASS. No fresh enlarged-font check for this revision; user review pending.

Profile numeral/spacing refinement (2026-10-23): numbers are now unboxed 24sp Roboto weight900 with tabular-nums and32sp line height. Rows use16dp horizontal padding and16dp number-to-label column gaps; the numeral column is36dp at default, scaling with system fontScale to avoid clipping. Existing vertical padding/gap, 8dp corners, gradients, category inks, friendly label type and status semantics remain. Status retains right alignment within the16dp inset; labels/status can reflow into separate lines rather than overlap. Agent inspected default and320dp/150% font rendering and restored physical1080x2400/420dpi/font1.0. Typecheck,290/290 tests and whitespace PASS. User acceptance pending; no logic/navigation/backend change.

Profile bloom-language consistency (2026-10-23): the compact strips now use the overview's elliptical radial-gradient character and same five plateau strengths/stop rhythm, mirrored to the existing left accent. Profile radius is70% width/180% height, origin left0/top35%, at32% overview intensity. The bloom fades out by roughly43% width; right semantic-status area remains white. Existing24sp tabular numbers,16dp padding/gaps, row wrapping and status placement/colors are unchanged. No overview-card or shared theme changes. Agent inspected default Android capture; typecheck,290 tests and whitespace PASS. No new enlarged-font/state acceptance for this background-only revision; uncommitted for review.
