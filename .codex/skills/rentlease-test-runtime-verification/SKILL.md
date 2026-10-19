---
name: rentlease-test-runtime-verification
description: Use when planning meaningful RENTLEASE tests or finishing implementation/debugging work, especially before reporting completion or Android runtime results.
---

# RENTLEASE test and runtime verification

Separate code existence, automated evidence and manual Android acceptance. Verify behavior rather than increasing a test count.

## Automated evidence

Test relevant state transitions, workflow ordering, mappings, error propagation, double-submit prevention, existing-state behavior, access assumptions and actual regression conditions. MUST NOT weaken/delete previous regressions casually or add tests that merely restate TypeScript/implementation. If intended behavior changes a test, explain why and update relevant docs. Unit access tests do not establish live RLS enforcement.

Use the current package scripts. This repository's `npm test` runs `scripts/run-tests.cjs` over `tests/*.test.ts`; it is not a native integration runner.

| Check, when applicable | Evidence to report |
| --- | --- |
| `npm run typecheck` | Actual result/exit status |
| `npm test` | Exact command, total/pass/fail and skipped counts |
| `npx expo install --check` | Dependency compatibility result; especially relevant when dependencies/Expo compatibility change |
| `git diff --check` | Whitespace result; include staged changes if present |
| `git status` | Relevant modified/untracked/staged work |

Do not let validation install dependencies or apply suggested fixes automatically; report blocked checks and reasons. For skills/docs-only work, use available skill/docs validation and Git checks; do not run app-changing commands unnecessarily. Rerun failed checks after fixes; do not claim unexecuted commands passed. Never commit/push automatically.

## Exact status language

- IMPLEMENTED: code exists.
- AUTOMATED-TESTED: identified automated checks passed.
- RUNTIME-UNVERIFIED: user manual Android/app validation has not passed or has not occurred.
- RUNTIME-VERIFIED: the user actually performed and reported successful manual runtime validation for the stated flow/environment.
- DEFERRED / UNRESOLVED: outside this pass / a decision or contract remains unknown.

Agent browser/emulator observations may be reported precisely as agent-observed evidence, but MUST NOT be presented as user runtime acceptance. A user's pass applies only to the tested flow, environment and revision; unit tests never imply native, live Supabase or security success.

## Manual plan and host diagnosis

Provide a short representative Android sequence: starting account/data/network state → action → expected UI → expected backend state where relevant → negative case → retry/reopen behavior. Prioritize current-feature risks instead of dozens of redundant cases.

Distinguish app state bugs from Expo Go, Metro and emulator/native startup failures using executable/runtime evidence. Missing logs alone do not prove a host defect. MUST NOT modify business logic to compensate for a failure proven to occur before application JavaScript starts. Capture safe lifecycle evidence and actual visible state before proposing a speculative fix. Record limits using [rentlease-documentation-maintainer](../rentlease-documentation-maintainer/SKILL.md); temporary results follow [rentlease-implementation-artifact-organizer](../rentlease-implementation-artifact-organizer/SKILL.md).
