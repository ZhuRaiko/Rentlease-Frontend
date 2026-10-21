# Tier 2 identity verification implementation plan

Scope: normal-user Tier 2 only; no Auth startup, role, Admin review, Tier 3, backend or dependency changes. User's Phase 2 prompt supplies the workflow and document/Storage policy. Android runtime acceptance remains for the user.

- [x] Add failing behavioral tests for four supported ID mappings, exact inserts/latest lookup, authenticated namespace, existing statuses, double-submit, cancellation and partial failures.
- [x] Add generated-type-backed `models/TierTwoVerification.ts` and feature-local `services/tierTwoVerificationService.ts`. Query latest by submitted_at then id descending with limit one; include document-presence evidence. Insert only user_id/tier and document metadata. Backend policies are not present locally; live RLS remains unverified.
- [x] Add testable `viewModels/tierTwoVerificationWorkflow.ts` and thin `useTierTwoVerificationViewModel.ts` hook. Own load/picker/submit/error state, synchronous action exclusion, stale-result disposal and conservative post-write failure recovery. Reuse existing picker/uploader. No automatic retry, deletion or resubmission.
- [x] Reconnect Profile through root workspace/Modal into `UserVerificationFlowView`; reuse overview/Tier 2/status/scaffold components. Leave legacy Tier 1/Tier 3 ViewModel/views disconnected. No preview decision or actor-promotion path enters production.
- [x] Run typecheck, tests, Expo compatibility check and Git checks. Update USER_VERIFICATION, concise FEATURES, changed ROUTES and directly stale global statements; record partial-state/race limitations and exact manual runtime plan.

Validation commands: `npm run typecheck`, `npm test`, `npx expo install --check`, `git diff --check`, `git status`. No commit or push. New tests use the existing Node runner; injected service/Storage/picker boundaries avoid pretending to test a native device or live RLS.
