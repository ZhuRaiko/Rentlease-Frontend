# Authentication & Profiles

## Purpose and feature boundary

Own Supabase Auth onboarding, authoritative account/profile/role loading, session-driven account synchronization, safe profile edits, sign-out, and routing decisions. Architecture follows [ARCHITECTURE.md](../ARCHITECTURE.md); shared backend boundaries follow [BACKEND_CONTEXT.md](../BACKEND_CONTEXT.md).

Tier 1 email/phone onboarding belongs here. Tier 2/3 documents and Admin review belong to [USER_VERIFICATION.md](USER_VERIFICATION.md). Marketplace content remains preview data. This feature does not implement backend authorization, migrations, or Storage configuration.

## Session/account ownership

- IMPLEMENTED: the singleton `SupabaseClient<Database>` persists the session in AsyncStorage and manages token auto-refresh through the existing AppState listener.
- IMPLEMENTED: `App` mounts one `useAuthProfilesViewModel`; its `account` snapshot owns the current Auth user, profile, full recognized role collection, account status, tier timestamps and trust score.
- The feature-local `accountSynchronization.ts` coordinates requests, generations and timers only. It does not store a second account/session snapshot.
- `App` owns workspace selection and the Tenant/Landlord UI preference. The workspace Modal is keyed by account ID so feature-local state is remounted across identity changes.

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

Successful sign-in, phone update/verification, manual Tier 1 refresh, role selection and profile save reload the account. Profile save no longer forces Profile after the reload.

Routing uses `models/accountRouting.ts`:

1. Non-active account → restricted, including restricted/suspended/deleted.
2. Active Admin role → Admin-capable Profile destination and Admin workspace; ordinary email/Tier 1/role onboarding is bypassed.
3. Ordinary unconfirmed email → email confirmation.
4. Missing Tier 1 timestamp → phone onboarding, or pending synchronization if Auth already confirms a nonempty phone.
5. Missing Tenant/Landlord role → role selection.
6. Otherwise → ordinary Profile/Discovery workspace.

The root opens a workspace when account identity or permitted workspace changes, not on every token refresh. RLS and backend Admin checks remain authoritative.

## Roles and profile rules

- Roles are a collection: tenant, landlord, admin. Normal self-selection accepts Tenant, Landlord, or both through `set_user_roles({ requested_roles: string[] })`; frontend never offers Admin selection.
- UI mode changes no backend role. Tier 3 approval does not grant landlord.
- The current profile editor directly updates only `display_name` and `bio` on the caller's row, then reloads the account. This safe existing path is retained.
- `avatar_path` is a normal editable backend field but has no editor/upload flow in this phase.
- Email/phone remain Auth operations. Account status, trust score, verification timestamps and suspension/moderation fields are not written by the editor.
- Generated `update_my_profile` and `refresh_my_tier1_verification` RPCs are available but unused. Their presence alone does not establish that the current direct-write/refresh paths must change.

## Current implementation

IMPLEMENTED, RUNTIME-UNVERIFIED: signup with display-name metadata; password sign-in; confirmation-link waiting/resend/manual return; Philippine phone change and six-digit phone_change OTP/resend; Tier 1 pending-status recovery; multi-role selection; persisted-session bootstrap; Auth event synchronization; profile read/display-name/bio update; sign-out/account switching; restricted routing; Admin onboarding bypass.

PREVIEW/LEGACY: marketplace feature contents and Admin review content are not made backend-backed merely by authenticating their entry.

DEFERRED: avatar upload, Google OAuth, password recovery, post-onboarding contact changes, Android email deep-link/redirect configuration and Tier 2/3/Admin verification integration.

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
- `src/features/authentication/services/accountService.ts`
- `src/features/authentication/views/` (existing layouts retained)
- `src/shared/services/supabase/client.ts`, `database.types.ts`
- `tests/accountRouting.test.ts`, `tests/accountSynchronization.test.ts`, `scripts/run-tests.cjs`

Structural contract: generated `profiles`, `user_roles`, `app_role`, `account_status`, `set_user_roles`. Auth email/phone confirmation and backend trigger/RLS behavior require the confirmed business contract, not inference from generated Insert/Update fields.

## Relevant Git history

- `05c70bd`: original UI previews.
- `af9778f`: real Auth/Profile integration, roles and Admin routing baseline.
- `9849232`: generated database contract and typed singleton.
- `cf59ffb`: user-created commit containing Phase 1 Auth stabilization and document foundation.
- This targeted cold-launch fix is uncommitted; no commit was created automatically.

## Last Verified

Date: 2026-10-18.

Commit baseline: `cf59ffb84df3ae812d61a1afd291082f8761e8bd` plus uncommitted cold-launch bugfix changes. This hash contains Phase 1 but does not include the current bugfix.

Verification status: see the second investigation report for current validation results (36 tests, including the preserved 34). Normal-user/Admin sign-in and session identity restoration: USER-REPORTED PASS. A persisted ordinary-user emulator launch reached Discovery during investigation. Cold-launch reliability: ISSUE REPRODUCED BY USER; ROOT CAUSE STILL UNRESOLVED. Other untested device/native/live flows remain RUNTIME-UNVERIFIED.
