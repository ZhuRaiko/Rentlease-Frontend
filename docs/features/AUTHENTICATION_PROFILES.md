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

The root ViewModel creates the coordinator and subscription on mount, then runs bootstrap. Cleanup unsubscribes, cancels queued refresh timers, and invalidates in-flight results.

- `INITIAL_SESSION`: bootstrap loads the account; the event does not start another load.
- `SIGNED_IN`, `USER_UPDATED`, `TOKEN_REFRESHED`, `MFA_CHALLENGE_VERIFIED`: event-driven refreshes are deferred with a zero-delay timer and coalesced.
- `SIGNED_OUT`: immediately invalidates old reads and clears account, profile form, selected roles, registration/password/phone drafts, cooldown, history and sign-out modal; root workspace is cleared.
- Explicit Auth/account mutations suppress their own notification-triggered reloads, then explicitly reload account state. Their events do not produce duplicate requests.
- Token/sign-in notifications emitted by an active account read do not recursively reload that same identity. A different signed-in identity invalidates an older load.
- An account switch hides the prior snapshot while the new identity is loaded. Generation checks prevent an older request from restoring stale account state.

Background refreshes update the authoritative snapshot without resetting an editor, OTP screen or workspace when the same account's routing destination is unchanged. Edit-profile drafts remain intact in that case. A changed destination applies routing again. Background errors become existing presentation-safe Auth notices; no automatic retry loop is started.

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

- No live account round trip was run in Phase 1. Earlier documentation records an Auth settings HTTP 200; this is not signup/SMS/RLS validation and was not repeated here.
- Email confirmation still opens outside the app; the user returns and confirms/signs in. No new deep-link integration was added.
- SMS settings, trigger timing and restricted/multi-role/Admin records require runtime tests.
- Account reads that fail retain error presentation; database changes without Auth events are not proactively polled.
- Async request coordination is unit-tested; full React/native lifecycle and actual Supabase callback timing remain runtime-unverified.

## Runtime tests still needed

1. Cold-launch session restoration for Tenant, Landlord, both and Admin.
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
- Phase 1 changes are uncommitted; no commit was created automatically.

## Last Verified

Date: 2026-10-18.

Commit baseline: `9849232220536e13da71e487f711a3b7993ad249` plus uncommitted Phase 1 changes. This hash does not include the Phase 1 implementation.

Verification status: TypeScript check passed; `npm.cmd test` passed 27 tests (10 existing routing tests plus 17 foundation tests). Device/native/live Supabase flows: RUNTIME-UNVERIFIED / NEEDS RUNTIME TEST.
