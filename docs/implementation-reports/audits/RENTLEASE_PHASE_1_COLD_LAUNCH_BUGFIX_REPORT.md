# RENTLEASE Frontend — Phase 1 Cold-Launch Bugfix Report

Date: 2026-10-18.

## A. ROOT CAUSE

Reproduced a startup completion race:

1. An Auth event supersedes bootstrap's account request.
2. The replacement request fails and exposes Retry.
3. The original request resolves as stale.
4. Bootstrap's old completion code clears the error while leaving the bootstrap screen active, hiding Retry.

Account reads also lacked a timeout. The exact triggering sequence on the user's device remains unconfirmed.

The user reported normal-user sign-in PASS, Admin sign-in PASS, and session identity restoration PASS. Cold-launch session restoration was intermittent. These are user-reported runtime results; the regression reproduction described here exercised coordinator logic rather than live Supabase.

## B. FILES MODIFIED

```text
src/features/authentication/viewModels/accountSynchronization.ts
src/features/authentication/viewModels/useAuthProfilesViewModel.ts
tests/accountSynchronization.test.ts
docs/features/AUTHENTICATION_PROFILES.md
```

This report was subsequently created at the user's request. No additional application changes were made while saving it.

## C. FIX IMPLEMENTED

**IMPLEMENTED FIX — NEEDS RUNTIME RETEST**

- Current coordinator callbacks now own startup completion.
- Removed bootstrap's stale success/error-clearing tail.
- Added a 15-second startup recovery deadline that replacement events cannot extend.
- Added bounded account reads.
- Accepted account results always leave bootstrap.
- Preserved synchronization safeguards, routing precedence, Admin bypass, and same-account editor/OTP preservation.
- Preserved the authoritative root account owner, service-owned Auth subscription, deferred event refresh, session persistence, and AppState token refresh.

Successful loads apply immediately; no startup delay was added. No navigation redesign, exact previous-activity restoration, backend change, or Tier 2 implementation was added.

## D. WHY THE FIX CANNOT LEAVE INITIAL LOADING ORPHANED

While the JavaScript event loop is active, startup resolves through:

- An account result → derived destination.
- No session → signed-out screen.
- Failure or deadline → error with Retry.

Superseded results cannot erase errors. Sign-out and cleanup cancel deadlines and invalidate pending results. The overall startup deadline survives Auth-event replacement, so repeatedly replacing a request cannot indefinitely postpone initial recovery.

No account is fabricated and no session is forcibly discarded to dismiss loading. No noisy temporary logging was retained.

## E. TESTS ADDED / UPDATED

Seven regression tests cover:

1. Replacement error followed by stale bootstrap success.
2. Replacement success while the original request hangs.
3. Timeout, Retry, and rejection of late results.
4. Startup events attempting to extend the deadline.
5. Sign-out/cleanup deadline cancellation.
6. Initial account-load failure.
7. Signed-out startup resolution.

These exercise the real coordinator and modeled UI callbacks without pretending to run live React Native or Supabase.

## F. VALIDATION RESULTS

| Check | Result |
| --- | --- |
| npm.cmd run typecheck | Passed |
| npm.cmd test | 34 passed, 0 failed |
| git diff --check | Passed |

All 27 previous tests remain passing. Static review found no substantive issues. No commit was created automatically.

## G. RUNTIME RETEST STEPS

For both an ordinary user and Admin:

1. Sign in.
2. Fully close the app.
3. Reopen it.
4. Confirm loading resolves to the normal destination, signed-out state, or recoverable error.
5. Repeat at least 10 cold launches, including quick restarts.
6. Test without network, then reconnect and tap Retry.
7. Confirm that a stalled attempt always presents an error and Retry after the recovery deadline while JavaScript is active.

Exact previous-screen restoration remains outside scope. Returning to the normal post-login landing/workspace is acceptable.

## H. DOCUMENTATION UPDATED

Updated `docs/features/AUTHENTICATION_PROFILES.md` with:

- The reported intermittent cold-launch infinite-loading bug.
- The reproduced completion-ownership race and missing deadline.
- Implemented recovery behavior and preserved safeguards.
- Seven regression tests and current validation counts.
- User-reported normal/Admin sign-in and session restoration results.
- The explicit requirement for repeated device cold-launch retesting.

Unrelated documentation and the earlier Phase 1 report remained unchanged.

Documentation records commit baseline `cf59ffb84df3ae812d61a1afd291082f8761e8bd` plus uncommitted cold-launch bugfix changes. That baseline contains Phase 1 but does not contain this bugfix.

## I. ANY REMAINING RISK

The recovery deadline does not physically abort an underlying Auth/network operation. Persistent dependency problems may cause another recoverable timeout. Timers can also pause while JavaScript is suspended.

Repeated Android cold launches must confirm runtime reliability. The exact device-side initiating event/network condition remains unconfirmed without runtime evidence.

**Final status: IMPLEMENTED FIX — NEEDS RUNTIME RETEST.**
