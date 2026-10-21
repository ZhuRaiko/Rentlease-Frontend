# Authentication & Profile connection status

Audit date: 2026-10-21 (Asia/Singapore). Repository baseline: `6578b6ebf7186df67e46c7bef6e20b3a1548648d` **plus the existing uncommitted working tree**. Findings describe the inspected working tree, not only that commit. This pass changes documentation only; no app execution, live Supabase inspection, migrations, tests, commits or pushes were performed.

## Evidence rules and scope

Executable source is authoritative for connectivity. Generated types establish API structure, not deployed functions, grants, policies, triggers or successful delivery. Historical test/runtime evidence is attributed below and does not certify this working tree.

- **IMPLEMENTED**: executable code exists.
- **AUTOMATED-TESTED**: an identified historical test run passed; present test coverage and the historical run are distinguished below. Tests were not rerun for this documentation task.
- **BACKEND-VERIFIED**: requires explicit live backend evidence for the stated operation. No full Auth/Profile operation receives this label in this audit.
- **ANDROID RUNTIME-VERIFIED**: only the narrowly stated prior user-reported or agent-observed Android behavior, with attribution; never a blanket reliability claim.
- **PARTIALLY CONNECTED**, **NOT CONNECTED**, **NOT IMPLEMENTED**, **UNCERTAIN** describe missing layers or evidence. Where the repository cannot prove a fact: **UNCERTAIN / REQUIRES RUNTIME OR LIVE BACKEND VERIFICATION**.

“Connected” below means the client call chain reaches the real Supabase API. It does not imply independently verified backend effects. RLS remains authoritative; frontend gates are presentation only. Tier 2/3 workflows are outside this Auth/Profile audit except where needed to distinguish legacy phone screens and stale documentation.

## High-level connection matrix

Counts use these 17 rows exactly: **8 clearly connected client areas, 3 partial/uncertain areas, 6 not-connected/not-implemented areas**. Signup includes automatic profile creation and therefore remains partial at its backend boundary. Session restore remains partial because documented cold-launch reliability is unresolved.

| Area | View | ViewModel | Service | Supabase/Backend | Connected End-to-End | Verification Level | Notes |
|---|---|---|---|---|---|---|---|
| Sign up | Yes | Yes | Yes | Real Auth call; profile trigger unavailable | PARTIAL | IMPLEMENTED; UNCERTAIN | Account creation wired; email delivery/profile creation unverified |
| Login | Yes | Yes | Yes | Password Auth + profile/roles reads | CONNECTED (client) | IMPLEMENTED; prior ANDROID RUNTIME-VERIFIED, user-reported | No fake login |
| Email confirmation | Yes | Yes | Yes | Signup/resend/sign-in/getUser | CONNECTED (manual-return client flow) | IMPLEMENTED; UNCERTAIN delivery | No Android callback/deep link |
| Phone OTP | Yes | Yes | Yes | updateUser/resend/verifyOtp | CONNECTED (client) | IMPLEMENTED; UNCERTAIN SMS delivery | SMS hook/Bird code/config not present |
| Tier 1 | Yes | Yes | Read only | Timestamp read; sync definition unavailable | PARTIAL | IMPLEMENTED gate; routing AUTOMATED-TESTED historically; UNCERTAIN sync | Refresh button reloads; no refresh RPC call |
| Profile load | Yes | Yes | Yes | profiles SELECT | CONNECTED (client) | IMPLEMENTED; indirect prior sign-in evidence | Live self-SELECT policy unavailable |
| Profile edit | Yes | Yes | Yes | profiles UPDATE + reload | CONNECTED (client) | IMPLEMENTED; UNCERTAIN persistence/permission | display_name and bio only |
| Avatar | Initials only | No upload | No avatar operation | Field/type only; bucket unknown | NOT CONNECTED | NOT CONNECTED | avatar_path neither rendered nor saved |
| Role selection | Yes | Yes | Yes | set_user_roles + reload | CONNECTED (client) | IMPLEMENTED; routing AUTOMATED-TESTED historically | Tenant, Landlord, both; live escalation defense unverified |
| Admin routing | Yes | Yes | Yes | user_roles SELECT | CONNECTED (client) | IMPLEMENTED; routing AUTOMATED-TESTED historically; prior ANDROID RUNTIME-VERIFIED, user-reported | Active Admin bypass precedes ordinary onboarding |
| Session restore | Retry/bootstrap | Yes | Yes | Persisted session/getUser/profile/roles | PARTIAL (reliability) | IMPLEMENTED; coordinator AUTOMATED-TESTED historically; limited prior ANDROID RUNTIME-VERIFIED | Intermittent cold-launch issue remains open |
| Logout | Confirmation/switch | Yes | Yes | signOut, local scope | CONNECTED (client) | IMPLEMENTED; stale-load coordinator AUTOMATED-TESTED historically | Clears account/workspace; full native cleanup unverified |
| Password reset | No | No | No | No recovery call | NOT IMPLEMENTED | NOT IMPLEMENTED | No forgot-password UI or recovery handler |
| Password change | No | No | No | No password update | NOT IMPLEMENTED | NOT IMPLEMENTED | Signup password is unrelated |
| Email change | No | No | No | No email update | NOT IMPLEMENTED | NOT IMPLEMENTED | Settings/email are read-only |
| Phone change after onboarding | No dedicated entry | Reusable onboarding actions | Phone-change methods exist | Real Auth phone-change APIs | NOT CONNECTED as account setting | NOT CONNECTED | Change-number control exists only inside onboarding OTP |
| Account deletion | No | No | No | No end-user deletion operation | NOT IMPLEMENTED | NOT IMPLEMENTED | deleted status is not a deletion feature |

## Canonical client, architecture and generated types

`src/shared/services/supabase/client.ts` exports the lazy module singleton `getSupabaseClient(): SupabaseClient<Database>`. It imports generated `Database` from `src/shared/services/supabase/database.types.ts`; the only executable `createClient` call found under application source is here. It uses AsyncStorage, `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: false`. Its AppState listener starts refresh when active and stops it otherwise. That listener lives with the singleton, not with each ViewModel mount.

`src/features/authentication/services/accountService.ts` reuses this client for every active Auth/Profile backend operation. No Authentication/Profile View imports the client or executes Supabase calls. `App.tsx` instantiates one `useAuthProfilesViewModel` and supplies it to `AuthProfilesFlowView`; child Views consume the typed ViewModel through props. Welcome receives callbacks rather than importing the ViewModel. The feature respects View → ViewModel → service → Supabase.

The handwritten `AccountProfile` in `src/features/authentication/models/AuthProfile.ts` is a projection, not a generated Row alias. Its display_name/account_status are nullable broad strings, whereas the generated Row requires non-null display_name and the account_status enum. `AppRole`/`UserRole` duplicate generated enum values but currently match tenant/landlord/admin. `parseProfile` and `parseRoles` defensively map unknown input. These are handwritten contract duplication/broadening, not proof of obsolete values; no replacement was made. The singleton still types the actual SELECT/UPDATE/RPC builders with Database.

Generated `profiles` additionally contains created_at, updated_at, suspended_until and suspension_reason; the account query omits those. `user_roles` has user_id, role and created_at, with a profile relationship. Generated Update permitting a field structurally does **not** prove that RLS/grants permit a client to change it.

## Authentication Views and actual routes

All files below live in `src/features/authentication/views/`. Every listed View has **Calls Supabase directly: NO**. “Real data” includes real user input bound to real operations, not a successful runtime claim. Static labels, layout assets and input hints are not fake account data.

| File | Route/screen | Connected to ViewModel? | Uses real backend data? | Mock/hardcoded data? | Current purpose |
|---|---|---|---|---|---|
| AuthProfilesFlowView.tsx | All AuthProfileScreen cases | YES, typed prop | YES | Static UI copy only | Dispatch screens; bootstrap notice/Retry; sign-out Modal |
| WelcomeView.tsx | welcome | YES, callbacks from flow; no VM import | PARTIAL: notice only | Static brand/choice copy | Navigate to signIn/registrationName |
| SignInView.tsx | signIn | YES, AuthProfilesViewModel type import/prop | YES | Input hints only | Bind credentials and submitSignIn |
| RegistrationView.tsx | registrationName, registrationNickname, registrationEmail, registrationPassword | YES | YES, draft → register | Input hints only | Collect names/email/password; create account |
| RegistrationView.tsx | emailConfirmation | YES | YES | Static explanatory copy | resendEmail/continueAfterEmailConfirmation |
| RegistrationView.tsx | registrationPhone, mobileConfirmation | YES | YES | +63 UI prefix, phone/code hints | request/resend/verify phone_change OTP; change input number |
| RegistrationView.tsx | verificationPending | YES | YES | Static pending explanation | Reload status; switch account without new SMS |
| RegistrationView.tsx | roleSelection | YES | YES | Fixed allowed role choices, not loaded user roles | toggleRole/submitRoles |
| ProfileView.tsx | profile | YES | YES | Static cover/icons; initials fallback | Name/bio/roles/Tier 1; profile/settings/workspace actions |
| EditProfileView.tsx | editProfile | YES | YES | Bio hint only | display_name/bio save; read-only Auth email/phone |
| SettingsView.tsx | settings | YES | YES | Fallback copy only | Account summary; edit and sign-out confirmation |
| RestrictedAccountView.tsx | restricted (also dispatcher fallback) | YES | YES | Static support/restriction copy | Display status and sign out |

There are no separate active email-code, profile-setup or password-recovery Views. Name collection and the display-name editor provide the current profile setup. RegistrationView's final branch renders role selection; the flow routes only recognized registration screens to it. The restricted screen says users can review profile/account information, but provides only sign out, not a profile/settings link: a source-visible copy/action mismatch.

## Primary ViewModel: state, actions and callers

`src/features/authentication/viewModels/useAuthProfilesViewModel.ts` exports `useAuthProfilesViewModel` and the return type `AuthProfilesViewModel`. Only App instantiates the hook; flow/child Views consume the provided result.

Exported state/derived values: screen, draft, account, roles, hasTenantRole, hasLandlordRole, isAdmin, displayName, profileName, profileBio, selectedRoles, signInIdentifier, signInPassword, notice, asyncState, showSignOutConfirmation, resendSeconds, entryVersion, signedOutVersion.

Exported operations: bootstrap, navigate, goBack, updateDraft, setProfileName, setProfileBio, setSignInIdentifier, setSignInPassword, setNotice, submitSignIn, register, resendEmail, continueAfterEmailConfirmation, requestPhoneOtp, resendPhoneOtp, verifyPhoneOtp, refreshVerificationState, toggleRole, submitRoles, saveProfile, setShowSignOutConfirmation, signOut, switchAccount.

`hasTenantRole`, `entryVersion`, `signedOutVersion` are consumed by App (hasTenantRole also by ProfileView). `setNotice` has no external consumer found in this feature/root composition; all other returned operations/state have active UI/root consumers. `switchAccount` wraps `signOut('signIn')`; it is not an independent login/session service.

View actions are wired either to ViewModel operations or supplied root workspace callbacks. Role-mode switching is intentionally App-local presentation state, not a backend role write. Static support instructions have no contact action. Missing recovery/contact/avatar/delete actions are absent, not fake successful ViewModel operations.

`friendlyError` handles timeout, invalid credentials, unconfirmed email, weak password, expired/invalid token, rate limiting, session/permission, network, phone/SMS and already-registered errors; otherwise a generic message. Views disable submit controls during async loading and render notices. These handlers generally have no separate imperative in-flight lock; disabled controls are the ordinary submission guard. No automatic retry loop is implemented.

## Services and reachable backend operations

All active functions in this table are in `src/features/authentication/services/accountService.ts`. Except for the error helper, their caller is the root Auth ViewModel. Internal profile/role parsers are not public operations.

| Public function | Supabase method/RPC | ViewModel caller | Reachable from UI? |
|---|---|---|---|
| subscribeToAccountAuthChanges | auth.onAuthStateChange; subscription.unsubscribe cleanup | mount effect | YES, lifecycle |
| loadAccount | auth.getSession → auth.getUser → parallel profiles/user_roles SELECT | coordinator load via bootstrap/refresh | YES |
| signUp | auth.signUp({email,password,options:{data:{display_name}}}) | register | YES |
| signIn | auth.signInWithPassword({email,password}) | submitSignIn; continueAfterEmailConfirmation | YES |
| resendSignupEmail | auth.resend({type:'signup',email}) | resendEmail | YES |
| requestPhoneChange | auth.updateUser({phone}) | requestPhoneOtp | YES, onboarding |
| resendPhoneChange | auth.resend({type:'phone_change',phone}) | resendPhoneOtp | YES, onboarding |
| confirmPhoneChange | auth.verifyOtp({type:'phone_change',phone,token}) | verifyPhoneOtp | YES, onboarding |
| saveUserRoles | rpc('set_user_roles',{requested_roles}) | submitRoles | YES |
| updateOwnProfile | profiles.update(changes).eq('id',userId).select('id').single() | saveProfile | YES |
| signOutAccount | auth.signOut({scope:'local'}) | signOut/switchAccount | YES |
| isUnconfirmedEmailError | No backend call; error.code comparison | submitSignIn catch | YES, error path |

`src/shared/services/supabase/auth/authService.ts` separately exports `getCurrentSession` (auth.getSession) and `signOut` (auth.signOut with no explicit scope). No imports/callers were found for this module in active source: it is not the active logout/session path. It shares the canonical client and is not a duplicate client.

`src/shared/services/supabase/storage/storageService.ts` exports `getStorageClient`, returning shared client.storage. It provides no avatar workflow. Existing verification-document Storage operations belong to another feature and do not establish avatar connectivity. No Auth/Profile ViewModel invokes Storage or Edge Functions.

## CURRENT CONNECTED AUTHENTICATION FLOW

```text
App launch
→ App.useAuthProfilesViewModel()
→ mount: createAccountSynchronization({load: loadAccount, apply, clear, onError})
→ accountService.subscribeToAccountAuthChanges(callback)
→ bootstrap() → coordinator.bootstrap() → refresh('explicit')
→ accountService.loadAccount()
→ getSupabaseClient().auth.getSession()
→ auth.getUser() if session exists
→ parallel profiles SELECT by Auth user id + user_roles SELECT by user_id
→ parseProfile/parseRoles → AccountSnapshot
→ routeAccount → getAccountDestination / getWorkspaceDestination
→ AuthProfilesFlowView screen + App workspace Modal

Signup
WelcomeView → navigate('registrationName')
→ RegistrationView: name → nickname → email → password
→ useAuthProfilesViewModel.register()
→ mutateAccount(() => accountService.signUp(email,password,displayName))
→ supabase.auth.signUp({email,password,options:{data:{display_name}}})
→ Supabase Auth account creation [hosted outcome not verified here]
→ session returned? refreshAccount() : screen='emailConfirmation'
→ automatic auth.users → profiles trigger [expected; definition absent here]

Login
SignInView → submitSignIn → mutateAccount(() => accountService.signIn(...))
→ auth.signInWithPassword → refreshAccount → loadAccount → routeAccount

Email confirmation/manual return
RegistrationView → resendEmail → resendSignupEmail → auth.resend(type='signup')
→ external confirmation link [hosted config/delivery required]
→ 'I confirmed my email' → continueAfterEmailConfirmation
→ retained draft password? signIn + refreshAccount
→ otherwise existing account? refreshVerificationState : return to signIn

Phone verification
RegistrationView → requestPhoneOtp → normalizePhilippinePhone
→ mutateAccount(() => requestPhoneChange('+63…')) → auth.updateUser({phone})
→ refreshAccount(true) → mobileConfirmation when phone still incomplete
→ resendPhoneOtp → resendPhoneChange → auth.resend(type='phone_change')
→ verifyPhoneOtp → confirmPhoneChange → auth.verifyOtp(type='phone_change')
→ refreshAccount → profiles.tier1_verified_at read → routeAccount
→ Auth SMS hook → send-sms Edge Function → Bird [UNPROVEN; not in checkout]

Role selection
RegistrationView → toggleRole('tenant'/'landlord') → submitRoles
→ mutateAccount(() => saveUserRoles(selectedRoles))
→ rpc('set_user_roles',{requested_roles:selectedRoles})
→ refreshAccount → user_roles SELECT → routeAccount → App Discovery workspace

Profile read/edit
loadAccount → account.profile → ProfileView / SettingsView / EditProfileView
EditProfileView → saveProfile → updateOwnProfile(account.user.id,{display_name,bio})
→ profiles UPDATE + returned id → refreshAccount → routeAccount

Logout/account switch
Settings/Profile settings → confirmation Modal → signOut()
or RegistrationView → switchAccount() → signOut('signIn')
→ mutateAccount(signOutAccount) → auth.signOut({scope:'local'})
→ SIGNED_OUT clear + explicit clearAccount(destination) → root workspace reset
```

## Signup, login and confirmation details

Signup email/password entry and Auth account-creation call: **CONNECTED**. `register` trims/lowercases email, uses trimmed nickname or joined first/last names as display_name, and requires a name, an `@` and at least eight password characters. First/last names are draft fields, not separately persisted profile columns by this service. Confirmation and session establishment: **PARTIAL** across hosted email delivery/configuration, with a connected manual-return flow. Profile creation: **UNKNOWN** because its trigger definition is absent. There is no client-side profiles INSERT.

Login trims/lowercases the identifier and passes the actual password, sets loading, calls real Auth, then reloads session/user/profile/roles before routing. `email_not_confirmed` sends the user to emailConfirmation while retaining email/password in memory for manual retry. No credentials are fabricated. Password fields are cleared after routing beyond emailConfirmation and on account cleanup; there is no custom credential persistence.

Email confirmation is requested implicitly by signup subject to hosted Supabase settings; the client passes neither emailRedirectTo nor an in-app email OTP. It checks Auth user.email_confirmed_at for routing and recognizes unconfirmed-login errors. “I confirmed” signs in again when the in-memory password exists, otherwise reloads an existing account or returns to signIn. This is account/session reloading, not a dedicated auth.refreshSession call. No Linking listener, exchangeCodeForSession, setSession or recovery callback exists in the active app. `app.json` has no scheme/intent-filter callback setup, and URL session detection is disabled.

`supabase/config.toml` is local configuration: email confirmations=false; SMS signup=false and confirmations=false; localhost site/redirect URLs; Twilio disabled; no enabled send-SMS hook. These do not establish hosted project settings and differ from the confirmation-required workflow assumed by docs/UI. Frontend minimum password length eight also exceeds the local Auth minimum six. No configuration was changed.

## Phone/SMS/OTP and Tier 1

Phone UI accepts ten digits starting with 9, displays +63, strips non-digits, and the ViewModel validates /^9\d{9}$/ before forming E.164 +63 plus ten digits. It does not accept arbitrary country codes or a full international number in this input. OTP verification requires exactly six numeric digits. Request/resend errors use existing notices; successful request enters mobileConfirmation after a real account reload. Resend uses a 60-second in-memory cooldown shared with email resend. Expired/invalid/rate-limit/network errors have mapped messages. Restart loses the draft/cooldown; there is no persisted pending-OTP continuation.

Frontend Auth phone-change calls are **IMPLEMENTED/CONNECTED**. `supabase/functions/send-sms/` does **not** exist; no Edge Function implementation or Bird integration was found in this checkout. Edge Function presence: **absent locally**, not proof of absence on the hosted backend. External Bird delivery/configuration and real OTP success: **UNCERTAIN / REQUIRES RUNTIME OR LIVE BACKEND VERIFICATION**. The repository cannot trace beyond Supabase Auth to a verified hook, deployed function or Bird response.

Expected Tier 1 means confirmed email plus confirmed phone. Current frontend checks email_confirmed_at separately, then trusts profiles.tier1_verified_at; it does not recompute Tier 1 or write the timestamp. A nonempty confirmed phone with no timestamp routes to verificationPending; otherwise missing Tier 1 routes to registrationPhone. A timestamp-present account passes that tier gate without a separate phone-confirmed recheck, relying on backend consistency.

`verifyPhoneOtp`, `requestPhoneOtp` and `refreshVerificationState` reload loadAccount. **No frontend call to refresh_my_tier1_verification exists.** The generated no-argument boolean RPC is unused. `sync_tier1_verification` is mentioned in docs but its definition/trigger is absent from migrations/types; its actual deployed behavior cannot be proved. Thus “successful Tier 1 refresh” currently means observing a backend-populated timestamp, not causing synchronization via RPC. An active Admin bypasses email/Tier 1/ordinary-role gates, after account-status restriction checks. Ordinary users cannot enter App's marketplace Modal until the route resolves to profile.

## Profile creation and RLS limits

The only SQL migration found is `supabase/migrations/20261020134152_get_admin_verification_queue.sql`. It defines an Admin-only queue summary, not auth.users/profile creation, profile RLS or role assignment. Its comment says profiles SELECT remains self-only, but it does not define that policy. It verifies auth.uid and calls public.is_admin inside a SECURITY DEFINER function; it does not define is_admin itself.

There is **no available migration/function/trigger definition** proving auth.users → profiles creation, the inserted fields, display-name metadata mapping or whether a default tenant role is assigned. The intended rule “automatically create profile, assign no default tenant role” cannot be confirmed or contradicted by supplied migrations. The frontend independently collects roles and can route a roleless user to selection, which does not prove backend signup behavior.

| Security contract | Repository evidence | Audit result |
|---|---|---|
| profiles self SELECT | Own-id filter + docs/queue comment; no policy definition | Required for loadAccount; enforcement unverified |
| profiles self UPDATE | Own-id filter; only display_name/bio passed; no policy/grant/guard definition | Real client update exists; permission/protected-field enforcement unverified |
| Protected profile fields | Frontend editor omits trust/tier/status/moderation fields | No frontend violation found; generated Update is not an authorization guarantee |
| Admin profile access | Queue migration returns narrowly selected other-user profile data after is_admin | Definition present; no general Admin profiles SELECT policy proved |
| user_roles self reads | SELECT role filtered by Auth user id | Live read policy unavailable |
| user_roles writes/Admin escalation | UI/TS accept tenant/landlord only; uses set_user_roles | RPC implementation/grants unavailable; malicious direct requests cannot be assessed |

**FINAL LIVE POLICY REQUIRES LIVE SUPABASE INSPECTION.** This checkout lacks the relevant policy history entirely. Do not claim ordinary users cannot self-grant Admin at the backend solely from client typing; the normal client never offers Admin, but server-side rejection remains unverified. No live access-control tests were performed.

## Profile read/edit and avatar field audit

Profile loading is part of every full account bootstrap. `loadAccount` checks getSession, then getUser, then selects `id,display_name,bio,avatar_path,tier1_verified_at,tier2_verified_at,tier3_verified_at,trust_score,account_status` from profiles by authenticated id with single(). It concurrently selects role from user_roles by user_id. Either query error rejects the entire snapshot; no mock fallback profile is created. A missing/denied profile blocks startup with the existing notice/error/Retry. Read fields populate account and editor draft state; displayName falls back to the Auth email prefix, then “RENTLEASE user”.

| Field | UI | ViewModel/service/update | Backend permits? | Runtime-tested? |
|---|---|---|---|---|
| display_name | Editable | profileName → saveProfile → updateOwnProfile → UPDATE | Generated shape yes; live permission unverified | No explicit save PASS found |
| bio | Editable | profileBio → same path | Generated shape yes; live permission unverified | No explicit save PASS found |
| avatar_path | No edit/display binding | Loaded/parsed only; no update | Generated shape/RPC argument exists; live permission unknown | No |
| email/phone | Read-only in editor/settings | Auth values; initial phone workflow is separate | Not profile UPDATE fields | Contact change not runtime-verified |
| trust_score/tier1/2/3 timestamps/account_status | Summary/gating as applicable | Read only in this feature | Backend-owned; enforcement definitions absent | No protected-field live test |
| roles | Onboarding multi-select | Separate set_user_roles RPC, never profile UPDATE | RPC authorization unknown locally | No role-save PASS found |

Save requires an account and nonempty trimmed name, trims both fields, updates by account.user.id and demands one returned id. It then reloads and routes from fresh account data; it does not blindly force profile. An update may succeed even if the subsequent account reload fails; the UI reports an error rather than proving rollback. Background same-destination loads preserve unsaved editor fields. No client profile operation writes protected fields.

Avatar layers: **UI** initials only; **ViewModel** no picker/upload state; **Service** no avatar operation; **Storage** no avatar bucket/config/policy evidenced; **profiles.avatar_path update** absent; **display** ignores avatar_path and renders initials; **delete/replace** absent; **runtime verification** absent. Static profile-cover.png and icons are presentation assets. The existing profile-avatar.png asset is not used by active ProfileView. Neither a schema field nor generic getStorageClient establishes an avatar feature.

## Role selection, loading and Admin destination

RegistrationView's independent checkbox toggles permit tenant, landlord or both. submitRoles rejects an empty selection, calls saveUserRoles, and reloads roles rather than using the RPC's returned rows as final account state. `set_user_roles` generated contract is requested_roles:string[] → {role:string}[]. Client wrapper narrows inputs to tenant/landlord; no direct user_roles INSERT/UPDATE is present in this feature.

Startup reads the complete recognized role collection, not a single active role. parseRoles retains tenant/landlord/admin and ignores unrecognized values. `isAdmin`, hasTenantRole and hasLandlordRole derive from that snapshot. Roles are independent of verification tiers: a landlord role does not require Tier 3 in routing, and ordinary roles still require Tier 1. App's preferredRole toggles presentation among already held roles and does not grant roles.

Admin membership comes from user_roles SELECT, not a direct frontend is_admin RPC. getAccountDestination checks account_status !== active first, then admin → profile. getWorkspaceDestination maps that permitted profile destination to adminModeration for Admin, discovery otherwise. routeAccount increments entryVersion upon identity/permitted-workspace change; App's effect opens the corresponding workspace. Modal visibility requires canEnterAdmin for Admin workspace, and AdminModerationFlowView rendering also checks auth.isAdmin. This proves routing, not the correctness of every Admin feature or backend authorization.

## Bootstrap, restoration, retry and synchronization

The mount effect creates `createAccountSynchronization` in `src/features/authentication/viewModels/accountSynchronization.ts`, subscribes through the service, then bootstraps. The callback is synchronous and forwards event/user id; it never awaits Supabase while holding the Auth callback path.

- INITIAL_SESSION records identity but starts no duplicate read; bootstrap owns initial loading.
- SIGNED_IN, USER_UPDATED, TOKEN_REFRESHED, MFA_CHALLENGE_VERIFIED queue/coalesce background refresh via setTimeout(...,0).
- Explicit mutations invalidate older reads and suppress their own Auth-event reloads; their workflows explicitly refresh afterward (logout clears instead).
- Active-read token/same-identity sign-in feedback is suppressed to avoid recursive reloads.
- SIGNED_OUT invalidates reads, cancels startup deadline and clears local account state immediately.
- Every refresh increments generation; superseded/disposed results/errors cannot apply. Cleanup unsubscribes, disposes and cancels scheduled timers.
- A load has a 15-second deadline; bootstrap/Retry also has a separate non-extendable 15-second startup deadline. These race results, do not abort underlying network/Auth work, and require a progressing JS event loop.
- Current apply/onError owns startup completion. Success/null immediately exits bootstrap; failures set asyncState error/notice. AuthProfilesFlowView shows Retry only when screen is bootstrap and asyncState is error. Retry calls bootstrap; there is no automatic retry/sign-out.
- Background same-account/same-destination refresh retains screen/workspace and editor drafts. Destination/identity changes apply routing anew. Background errors surface notices and may retain the prior account; they do not prove session revocation.

Launch restoration uses AsyncStorage session → getSession → getUser → profile/roles → routing. Missing session clears to welcome. Missing environment opens welcome with configuration notice; session/user/query failures follow error handling. A deadline cannot recover startup before the ViewModel mounts or while JS is stalled. No dedicated profile/user_roles Realtime subscription/polling exists: server-only changes wait for another load/Auth event/restart/manual refresh. AppState token-refresh management does not itself guarantee an immediate profile reload on every resume.

Development diagnostics remain in `src/shared/utils/authBootTrace.ts`: `[AUTH-BOOT]` captures App/View/ViewModel lifecycle, Auth subscription/events, session/getUser/profile/role stages, generations, stale outcomes, refresh suppression, deadlines, destinations and workspace visibility. traceAuthBoot emits only when __DEV__ is true. Its runtime whitelist excludes credentials, tokens, OTPs, account contents and user ids. Test fixtures containing fake secrets test omission; they are not runtime credentials.

## Logout and account switching

`signOutAccount` uses **local** scope, ending this device's session, not all devices. Successful explicit logout calls clearAccount; SIGNED_OUT also invokes it. Cleanup clears account/profile/roles through account=null, registration/phone/code/password draft, sign-in inputs, editor fields, selectedRoles, resend deadline, history, notice and confirmation Modal. Default signOut returns welcome; switchAccount returns signIn. Errors retain error state/notice rather than fabricating logout success.

App observes signedOutVersion, clears workspace and resets preferredRole. Its workspace Modal key is the Auth user id, preventing reuse of another identity's child feature state. The ViewModel immediately hides the prior snapshot on a different SIGNED_IN identity and reloads profile/roles/tiers/Admin state. Coordinator generations stop old reads from restoring the prior user. This is code support plus coordinator tests, not a complete Android account-switch acceptance test. No explicit purge of generic device caches/files is present in Auth cleanup; do not imply deletion of previously downloaded documents. No separate Auth preview-account state remains to clear.

## Route/state audit

| Account/UI state | Actual destination |
|---|---|
| Startup | bootstrap → error/Retry or resolved account/signed-out route |
| No session | welcome; signIn through Welcome; switchAccount explicitly returns signIn |
| Any account_status other than active, including null | restricted; no permitted workspace, including Admin |
| Active Admin | profile underneath auto-opened adminModeration Modal |
| Ordinary unconfirmed email | emailConfirmation |
| Ordinary missing Tier 1 + no nonempty confirmed phone | registrationPhone → mobileConfirmation on request |
| Ordinary missing Tier 1 + confirmed nonempty phone | verificationPending |
| Ordinary Tier 1 + no tenant/landlord | roleSelection |
| Ordinary complete account | profile underneath auto-opened discovery/home Modal |
| User profile navigation | editProfile/settings through ViewModel.navigate; close workspace reveals profile |

All AuthProfileScreen union members have active dispatcher paths. No obsolete declared Auth route was found. Legacy `TierOneVerificationView` under user-verification is not an active Auth route; the current UserVerificationFlowView imports TierTwoVerificationView/overview/status instead. Its legacy tier1* screens do not provide an alternative connected OTP flow.

## Auth/Profile backend contract and function inventory

| Dependency/function | Purpose/shape evidenced | Frontend caller / actually called? | Required/status |
|---|---|---|---|
| Supabase Auth/auth.users | signUp/password login/session/user/phone/signOut APIs | accountService, YES | Core client connected; hosted effects unverified |
| profiles | Own profile/tier/status data | loadAccount, updateOwnProfile, YES | SELECT + two-field UPDATE connected; policies/creation unknown |
| user_roles | Role collection | loadAccount, YES | SELECT connected; writes delegated to RPC |
| set_user_roles | requested_roles:string[] → role rows | saveUserRoles, YES | Role save required; generated contract only, definition absent |
| is_admin | optional requested_user → boolean | No direct Auth/Profile frontend call | Admin detection uses rows; queue migration calls is_admin server-side |
| has_app_role | requested_role enum, optional requested_user → boolean | No Auth/Profile caller | Generated helper only; not needed by current client routing |
| is_tier1_verified | optional requested_user → boolean | No Auth/Profile caller | Generated helper only; client reads timestamp |
| refresh_my_tier1_verification | no arguments → boolean | NO | Generated/unconnected RPC; manual UI only reloads |
| update_my_profile | new_display_name; optional new_bio/new_avatar_path → profile row | NO | Generated/unconnected RPC; direct UPDATE is active |
| sync_tier1_verification | Expected Auth-to-profile synchronization, mentioned in docs | No caller/definition found | Required backend behavior unproven locally |
| refresh_profile_verification_timestamps | Mentioned as backend Tier 2 derivation in ADMIN_VERIFICATION.md | No Auth/Profile caller/SQL definition found | Adjacent backend behavior; not a proven Auth RPC |
| Auth profile-creation trigger | Expected auth.users → profiles | No client insert; trigger absent locally | Creation/default-role semantics UNKNOWN |
| Send SMS Hook/send-sms/Bird | Expected downstream SMS delivery | No direct client invocation; local code/config absent | UNCERTAIN deployed integration |
| Avatar Storage bucket | No named/configured avatar bucket found | No caller | NOT CONNECTED; hosted existence unknown |

Only generated signatures above are structural evidence. Trigger-only functions need not appear in generated RPC types, so their absence there alone does not imply backend absence. The one available queue SQL is a relevant Admin/profile-read boundary, not a complete Auth schema export.

## Mock/hardcoded data and potential stale/dead code

Active Authentication/Profile contains no hardcoded user, role membership, fake login, mock account service or fake verification success. Runtime placeholders remain as **presentation only**: initials avatar, static cover/icons, name/email/phone unavailable fallbacks, phone/code/bio input hints. `000000` is a TextInput placeholder, never an accepted test OTP. Fixed Tenant/Landlord choices define allowed UI options, not fake loaded roles. Tests' example.com/phone/profile fixtures do not run as production account data. Development traces are separately gated.

Potential stale/dead code, retained unchanged:

- `src/shared/services/supabase/auth/authService.ts`: no active imports found; duplicates a subset of accountService, with different default sign-out scope. Do not mistake it for active logout.
- `src/features/authentication/components/OtpCodeInput.tsx`: re-export has no active importer; actual Auth OTP is AuthField, six digits. Shared OtpCodeInput is still used by the legacy verification screen, so the shared component is not globally dead.
- `src/features/user-verification/views/TierOneVerificationView.tsx` and `src/features/user-verification/viewModels/useUserVerificationViewModel.ts`: legacy local four-digit-code/tier preview implementation, including completeTierOne setting local approved state. Current UserVerificationFlowView does not import either; source search finds no active consumer of the legacy hook. These are disconnected preview remnants, not proof that active Auth fakes phone verification.
- `src/assets/authentication/profile-avatar.png` and `src/assets/authentication/google-logo.png`: not used by active Auth Views; their presence does not prove avatar/OAuth support.

## Automated coverage and documented runtime evidence

| Behavior | Automated test exists? | Test file / actual scope |
|---|---|---|
| Real signIn/signUp API and full UI workflow | NO | No accountService or mounted Auth ViewModel integration test found |
| Restored complete account destination | YES | tests/accountRouting.test.ts; supplied AccountSnapshot only |
| Role-selection prerequisite | YES | tests/accountRouting.test.ts; gate only, not role save/toggle/RPC |
| Admin bypass/restricted Admin | YES | tests/accountRouting.test.ts |
| Tier 1 missing/phone mismatch/email precedence | YES | tests/accountRouting.test.ts; not actual OTP/trigger |
| Bootstrap/deferred/coalesced events | YES | tests/accountSynchronization.test.ts; injected load callbacks |
| Stale requests/new identity/logout invalidation | YES | tests/accountSynchronization.test.ts; not full account UI cleanup |
| Deadline/Retry/startup replacement errors | YES | tests/accountSynchronization.test.ts; modeled UI callbacks/timers |
| Cleanup/background failure/refresh-loop suppression | YES | tests/accountSynchronization.test.ts |
| Trace redaction/development guard | YES | tests/authBootTrace.test.ts |
| Profile read/update persistence and live RLS | NO | No Auth/Profile integration test found |
| Signup trigger/no default role, SMS delivery/OTP, avatar | NO | No actual backend/native flow tests found |
| Full logout/second-login account switch | NO | Coordinator invalidation covered; root/native lifecycle not exercised |

There are 10 routing, 16 synchronization and 2 tracing test declarations in those files. The phase report records 27/27 passing at its earlier revision; `docs/implementation-reports/audits/RENTLEASE_PHASE_1_COLD_LAUNCH_INVESTIGATION_2.md` records a subsequent 36/36 suite pass, typecheck pass and whitespace pass. These support historical **AUTOMATED-TESTED** labels for corresponding routing/coordinator/trace behavior, not a fresh run of today's changed tree. `scripts/run-tests.cjs` is a Node/TypeScript test runner, not an Android integration runner. No suite was run during this audit, as requested.

`docs/features/AUTHENTICATION_PROFILES.md` (last verified 2026-10-18) records **user-reported** normal-user sign-in PASS, Admin sign-in PASS and session identity restoration PASS. Attribute **ANDROID RUNTIME-VERIFIED** only to those historical reported flows; the file does not establish a current revision-wide acceptance pass. The second investigation records an **agent-observed** persisted ordinary-user launch reaching Discovery. Neither establishes Bird/OTP delivery, signup/profile creation, profile edits, all role combinations, restriction policies or reliable repeated cold launches.

The same living doc says the user reproduced infinite loading around the sixth cold launch after modeled fixes. The investigation's repeat sequence included a launch with no fresh application trace and Android launcher foreground; it explicitly does not explain the user's loading screen. **Session restore connectivity exists; cold-launch reliability remains UNCERTAIN and the investigation remains open.** No Auth/Profile **BACKEND-VERIFIED** label is justified from the inspected repository alone. Adjacent Tier 2 runtime passes must not be generalized to Auth onboarding.

## Documentation conflicts and evidence boundaries

- AUTHENTICATION_PROFILES.md says Tier 3/Admin verification integration is deferred and Admin review content is preview/legacy. Current App/Profile code reaches the updated verification flow/Admin feature, and current `docs/features/ADMIN_VERIFICATION.md` describes real queue/review integration. Those broad older statements are stale; they do not make Auth routing disconnected. This audit does not certify the adjacent feature.
- That document calls avatar_path an editable backend field and the direct write “safe”. Current source proves only two submitted fields and generated update structure; this checkout cannot independently prove permission/protected-field enforcement.
- AUTH_SUPABASE_INTEGRATION.md describes trigger-created profiles and prompt Tier 1 synchronization as a backend contract/assumption. Definitions are unavailable here, so those outcomes stay UNCERTAIN rather than code-proven.
- Local config disables confirmation requirements and uses localhost redirects; it cannot confirm the hosted confirmation/SMS setup assumed by the mobile workflow.
- The living Auth doc's root-relative cold-launch report link is stale: the existing report is under docs/implementation-reports/audits/. The historical file is evidence only, not implementation authority.
- Ordinary/Admin sign-in reported passes coexist with generic RUNTIME-UNVERIFIED text and an unresolved reliability incident. Preserve the narrow passes and open issue instead of collapsing either into “everything works”.

Existing docs were left unchanged to satisfy the one-document scope.

# NOT CONNECTED / PARTIAL / DEFERRED

| Feature | Current state | Existing pieces | Missing connection | What would be required later |
|---|---|---|---|---|
| Avatar | NOT CONNECTED | avatar_path read/types; initials UI; generic Storage accessor | Picker, VM workflow, upload/bucket contract, profile save, image rendering, replace/delete | Confirm Storage/RLS contract, then View → VM → service → Storage → profile → display |
| Signup/profile creation | PARTIALLY CONNECTED / UNCERTAIN | Real signUp + metadata; automatic account reload | Local trigger/default-role evidence and actual signup runtime proof | Read-only backend trigger inspection and new-account acceptance; do not add duplicate client INSERT blindly |
| Email app callback | NOT IMPLEMENTED; manual confirmation connected | External link/resend/manual retry | Android deep-link/redirect/session callback | Confirm hosted URLs and implement approved callback flow if requested |
| SMS delivery | UNCERTAIN downstream | Real phone_change request/resend/verify | Hook/function/Bird source/config/runtime evidence | Inspect deployed hook/function/provider safely and test real/invalid/expired OTP |
| Tier 1 sync | PARTIALLY CONNECTED | Timestamp gate/read; pending recovery; generated refresh RPC | Proven backend sync; UI does not invoke RPC | Confirm trigger/RPC business contract and timing before deciding if frontend changes are needed |
| Repeated cold launch | PARTIALLY CONNECTED reliability | Persistence/bootstrap/deadlines/traces/tests | Failed-run cause and native repeated-launch acceptance | Capture failed-run trace/visible state; repeat ordinary/Admin launches and offline Retry |
| Password recovery | NOT IMPLEMENTED | Password sign-in only | Forgot-password UI/request/callback/new-password update | Full recovery View → VM → service → Auth with tested redirects |
| Authenticated password change | NOT IMPLEMENTED | Signup password input only | Settings action/validation/Auth password update | Separate authenticated change flow and required reauthentication contract |
| Email change | NOT IMPLEMENTED | Read-only email | UI/updateUser email/confirmation/profile effect handling | Separate Auth change/confirmation flow and fresh account reload |
| Post-onboarding phone change | NOT CONNECTED as setting | Reusable Auth change/request/verify methods; onboarding change-number action | Settings/profile entry and workflow ownership after Tier 1 | Reuse services with explicit re-verification/Tier 1 contract; do not assume current gate reopens |
| In-app account deletion | NOT IMPLEMENTED | account_status deleted enum only | End-user operation/confirmation/server cleanup | Approved authorized backend deletion contract plus UI/VM/service/cleanup |
| Profile edits and role saves | IMPLEMENTED client; UNCERTAIN backend acceptance | Live API builders and reloads | Explicit successful runtime saves/permission and denied-escalation evidence | Owner/non-owner/protected-field and tenant/landlord/both runtime acceptance |
| Immediate server-only account updates | NOT IMPLEMENTED as dedicated sync | Auth events/manual loads/restart | Database Realtime/polling | Establish requirement before adding a subscription; current Auth events are not DB change events |

# AUTH/PROFILE PARTS THAT SHOULD NOT BE REBUILT WITHOUT EVIDENCE

- The typed shared Supabase singleton, AsyncStorage persistence and AppState refresh boundary.
- The single root account owner and service-owned synchronous Auth subscription.
- Deferred/coalesced loads, generation invalidation, mutation-event suppression, disposal and startup deadline coordination, with identified regression tests.
- loadAccount's authenticated user/profile/complete-role loading and reuse after mutations.
- Restriction-first routing, active Admin precedence, ordinary Tier 1/role gates, and App-owned permitted workspace entry.
- Real signup/password login/manual email return/phone_change API wiring, multi-role RPC call, display-name/bio update and local logout cleanup.

These are demonstrated client connections, not a reason to ignore the unresolved cold-launch incident or unverified backend boundaries. Tier 1 backend synchronization is deliberately not listed as proven working.

## Compact file map

```text
App.tsx                                      root Auth owner/workspace composition
app.json                                     Android app config; no Auth callback scheme
src/features/authentication/
  models/AuthProfile.ts                      screen/draft/account/role contracts
  models/accountRouting.ts                   account/workspace destinations
  services/accountService.ts                 all active Auth/Profile data access
  viewModels/useAuthProfilesViewModel.ts      state and workflows
  viewModels/accountSynchronization.ts       generations/events/deadlines
  views/AuthProfilesFlowView.tsx              dispatcher/bootstrap/logout Modal
  views/WelcomeView.tsx
  views/SignInView.tsx
  views/RegistrationView.tsx                  signup/email/phone/roles
  views/ProfileView.tsx
  views/EditProfileView.tsx
  views/SettingsView.tsx
  views/RestrictedAccountView.tsx
  components/AuthField.tsx                    actual six-digit Auth OTP input
  components/OtpCodeInput.tsx                 unused feature re-export
src/shared/services/supabase/
  client.ts
  database.types.ts
  auth/authService.ts                        unused older wrappers
  storage/storageService.ts                  generic accessor; no avatar flow
src/shared/utils/authBootTrace.ts
src/features/user-verification/
  views/UserVerificationFlowView.tsx         current adjacent verification entry
  views/TierOneVerificationView.tsx           disconnected legacy preview
  viewModels/useUserVerificationViewModel.ts  disconnected legacy preview
supabase/config.toml                         local, not hosted settings
supabase/migrations/20261020134152_get_admin_verification_queue.sql
tests/accountRouting.test.ts
tests/accountSynchronization.test.ts
tests/authBootTrace.test.ts
scripts/run-tests.cjs
```

No local send-sms directory, Auth/profile-creation/RLS migration or avatar bucket definition was found. Paths above refer to existing files; missing paths discussed in prose are intentional evidence gaps.

## Audit validation

Traced View prop/callback bindings, ViewModel imports and service operations against executable source. Inspected generated signatures, the available SQL/config, test declarations, legacy references and documented runtime claims. Validation found all 31 compact-file-map paths and all 18 distinct backticked file references present, all 12 accountService exports documented, no direct backend calls in Auth Views, and the stated 10/16/2 test counts. No executable changes were needed or made.

`git diff --check` passed (exit 0), with existing LF/CRLF warnings only. Because this new document is untracked and ordinary git diff omits it, its contents were also checked directly: no trailing whitespace. Existing working-tree changes are not attributed to this audit.

## CONNECTED AND WORKING

At the client wiring level: login, manual-return email confirmation, phone-change OTP calls, profile loading, display-name/bio edits, Tenant/Landlord/both selection, Admin routing and local logout. Historical ordinary/Admin sign-in and identity restoration passes are narrowly attributed above.

## PARTIAL OR REQUIRES VERIFICATION

Signup's automatic profile creation/no-default-role semantics; hosted email/SMS/Bird delivery; backend Tier 1 synchronization; live RLS/protected-field/Admin-escalation enforcement; actual profile/role-save acceptance; repeated cold-launch reliability. No claim of a fresh full Android or backend pass is made.

## NOT IMPLEMENTED / NOT CONNECTED

Avatar upload/display, password recovery, authenticated password change, email change, dedicated post-onboarding phone change, in-app deletion, Android email callback, and dedicated database-change account synchronization. Unused generated RPCs and legacy verification previews do not count as connected features.

**AUTHENTICATION & PROFILE OVERALL STATUS: SUBSTANTIALLY CONNECTED ON THE CLIENT — TARGETED FEATURE GAPS, BACKEND EVIDENCE GAPS AND AN OPEN COLD-LAUNCH RELIABILITY ISSUE REMAIN.**
