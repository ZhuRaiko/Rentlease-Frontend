# Phase 1 — Cold-launch investigation 2

Date: 2026-10-18. Baseline: `cf59ffb84df3ae812d61a1afd291082f8761e8bd` plus existing uncommitted first bugfix. **Investigation open; no second behavioral fix established.**

## A. WHICH UI STATE ACTUALLY PRODUCED THE INFINITE LOADING SCREEN

The user's failed screen has not been conclusively identified. “Infinitely loading” alone does not distinguish Expo/native startup from RENTLEASE's Auth presentation.

RENTLEASE renders “Connecting to RENTLEASE” when `AuthProfilesFlowView` receives `screen === 'bootstrap'`. Its Retry control requires `asyncState === 'error'`. There is no separate root workspace startup loader. The rental-estimation loading screen is a later, user-triggered flow.

## B. RUNTIME TRACE / SOURCE FINDINGS

### Render and completion ownership

| State/gate | Owner and initial value | Progress/completion | Error/deadline effect |
| --- | --- | --- | --- |
| Native Expo startup/module evaluation | Expo/native host; precedes App | Loads bundle and evaluates imports before `APP_MODULE_READY` | Account timer does not yet exist |
| Native insets | Root SafeAreaProvider; without initialMetrics, context may initially be null | Native inset event allows children to mount | Auth timer cannot force native insets; candidate gate, not proven culprit |
| Auth screen | Root Auth ViewModel; bootstrap | Accepted snapshot routes away; signed-out result clears to welcome | Error intentionally retains bootstrap with Retry |
| Async state | Root Auth ViewModel; idle, then loading | Current result sets success; current error sets error | Both startup and request deadlines invoke error callback |
| Account | Root Auth ViewModel; null | Current result applies snapshot; sign-out clears it | Generations invalidate stale results; error does not fabricate a session |
| Request generation | Coordinator; zero | Each replacement invalidates preceding generation | Startup deadline invalidates pending work; stale callbacks cannot own completion |
| Workspace | App; null | Effect uses entryVersion and derived permitted destination to select Discovery/Admin | No awaited workspace initialization; a null workspace leaves Auth visible |
| Workspace Modal visibility | Derived by App | Workspace exists and account permits its destination | Not an independent loading flag |

The ViewModel runs in App, outside the SafeAreaProvider's child gate. Consequently, VM progress alone does not prove that the Auth View mounted; separate mount traces now distinguish this.

### Deadline chain

`bootstrap()` creates the non-extendable 15-second timer → callback invalidates old reads → `options.onError` → ViewModel sets error notice and asyncState error → bootstrap View renders notice and Retry. Successful current results cancel startup timing and route immediately. Superseded caller promises have no UI-completion tail.

This proves the executable state path, not a guarantee that native UI or a suspended JavaScript thread will execute/render it on time.

### Awaited account operations

`getSession()` → `getUser()` → parallel own-profile and user_roles queries all execute inside the coordinator's outer `Promise.race`. They have no individual cancellation/timeout here. The outer request deadline and independent startup deadline can resolve UI ownership without waiting for those promises. Late work may continue but is rejected by generation checks. There is no subsequent awaited workspace initializer.

### Lifecycle audit

The service owns the Auth subscription; the root ViewModel creates it on mount before bootstrap and unsubscribes on cleanup. Coordinator disposal cancels queued refresh/deadline timers and invalidates in-flight work. Auth callbacks remain synchronous, with deferred/coalesced reads and explicit-operation suppression. The existing singleton AppState auto-refresh listener is unchanged; it is not a ViewModel subscription. No evidence establishes it as the remaining cause. Native mount/reload behavior and a stalled JS event loop remain distinct runtime questions.

### Actual emulator observations

An isolated Expo server used port 8082. Existing persisted session data was preserved; no credentials were entered or storage cleared.

- An ordinary-user session restored and reached Discovery in a directly observed launch.
- In a subsequent monitored repeat sequence, launch 1 reached Discovery. Logs showed bootstrap generation 1 superseded by a deferred SIGNED_IN refresh, generation 3 accepted, startup deadline cleared, profile state successful, then Discovery Modal visible. This demonstrates that replacement path succeeding against live Supabase.
- Launch 2 produced no new `[AUTH-BOOT]` log during 24 seconds. Follow-up Android inspection showed the launcher in the foreground. No retained diagnostic establishes why this launch failed to enter the app. This is not proof of the user's infinite-loading path, Expo fault, or an Auth deadlock.
- Earlier exploratory restarts were not a complete controlled reliability test and are not counted as a repeated-launch pass. No Admin repeated-launch test or live stalled-request Retry test passed in this investigation.

## C. PREVIOUS FIX LIMITATION

The previous 34-test validation modeled coordinator races and timeout callbacks. It did not establish native rendering, pre-JavaScript startup, event-loop availability, or repeated Expo launch reliability. The user subsequently reproduced loading around the sixth launch. The previous changes must not be described as resolving the runtime incident.

## D. ACTUAL REMAINING ROOT CAUSE

**Unresolved.** No captured failed-run trace yet connects the user's visible loading screen to a specific state or blocked operation. Native-inset gating, host/bundle startup and JS suspension are investigation branches, not diagnoses.

## E. SECOND FIX IMPLEMENTED

No second behavior change was made without identifying its failure path. Development-only diagnostic coverage was added across module/App/View mounts, Auth subscription/events, account stages, generations, deadlines, VM state, AppState and destination/Modal decisions.

The logger serializes only whitelisted state fields and uses presence flags instead of identifiers. It emits nothing outside development. No new timeout, backend change, navigation redesign, session reset or Tier 2 integration was introduced.

## F. FILES MODIFIED

Investigation additions:

- `App.tsx`
- `src/features/authentication/services/accountService.ts`
- `src/features/authentication/viewModels/accountSynchronization.ts`
- `src/features/authentication/viewModels/useAuthProfilesViewModel.ts`
- `src/features/authentication/views/AuthProfilesFlowView.tsx`
- `src/shared/services/supabase/client.ts`
- `docs/features/AUTHENTICATION_PROFILES.md`

Created: `src/shared/utils/authBootTrace.ts`, `tests/authBootTrace.test.ts`, and this report.

Existing uncommitted first-pass work also includes `tests/accountSynchronization.test.ts` and `RENTLEASE_PHASE_1_COLD_LAUNCH_BUGFIX_REPORT.md`; this report does not attribute those changes to investigation 2. No commit was created.

## G. TESTS ADDED/UPDATED

Two tracing tests: sensitive/unrecognized extra properties are omitted, and production mode emits no trace. All previous 34 tests remain. No invented failure-path regression was added while the runtime cause remains unknown.

## H. VALIDATION RESULTS

- `npm.cmd run typecheck`: PASS, exit 0.
- `npm.cmd test`: PASS, 36 total, 36 passed, 0 failed, 0 skipped/cancelled.
- `git diff --check`: PASS, exit 0; line-ending warnings only.
- Independent tracing review: no substantive findings; current call sites contain only safe state fields and query callbacks preserve their results.
- Runtime reliability: NOT VERIFIED; observations and limits are recorded in B.

## I. EXACT RUNTIME RETEST STEPS

1. Run the development build with Metro visible. Preserve the persisted session and use the same device and launch method that exhibited the issue.
2. Test an ordinary account and Admin separately, at least 10 full close/reopen attempts each. Record launch time, visible text and whether the result is workspace, welcome or error with Retry. Do not count a returned Android launcher as an Auth loading state.
3. On a failure, leave it open beyond 20 seconds. Preserve `[AUTH-BOOT]` lines from that launch before restarting; capture what is visibly displayed. Do not share raw unfiltered logs or credentials.
4. Interpret the last stage: no APP_MODULE_READY means no evidence of app-module execution; VM_MOUNT without AUTH_VIEW_MOUNT distinguishes native child mounting; a last SESSION/AUTH_USER/PROFILE/ROLES request identifies a pending stage; STARTUP_DEADLINE_FIRED plus error/retryVisible distinguishes state recovery from a rendering problem. Missing logs alone do not prove a cause.
5. Test offline launch, wait for error/Retry, reconnect and Retry. Confirm actual rendered controls, not just logged state. Test sign-out/account switch and quick restarts.
6. Verify token refresh preserves editors/OTP and Admin bypass/restricted precedence remain intact. Repeat in the target Android development/release environment to distinguish Expo-host behavior.

For an adb-connected device, a safe filter is `adb logcat -d -s ReactNativeJS` followed by filtering to `[AUTH-BOOT]` only. Preserve the failing launch's timestamps. Development traces are temporary diagnostic infrastructure to revisit after diagnosis.

## J. DOCUMENTATION UPDATED

Updated `docs/features/AUTHENTICATION_PROFILES.md` to record recurrence, tracing, observed emulator results and unresolved cause. Created this second report; retained the historical first report. Unrelated feature/global/route docs remain unchanged because behavior and routing did not change.

## K. REMAINING RISKS

The reported infinite-loading issue remains open. A failed-run trace and visible-screen evidence are needed before a targeted second fix. Timers cannot run while JavaScript is stalled and cannot recover an app that has not executed its module. SafeAreaProvider gating is source-visible but not implicated by runtime evidence. The emulator's missing-trace/launcher result is unexplained. Instrumentation can affect timing; successful traced launches do not establish absence of a race.
