# Phase 1 implementation plan

**Goal:** Stabilize root Auth/account synchronization and add local document selection plus a private upload primitive. The user's Phase 1 specification authorizes implementation; no commits or backend changes.

**Architecture:** Keep the root Authentication ViewModel as the account owner. A feature-local synchronization helper coordinates deferred, coalesced loads and invalidates stale results; the service owns the Auth subscription. Local document models and device/Storage services are shared by the future Tier 2/Tier 3 workflows. Existing verification UI remains disconnected from production navigation.

**Stack:** Existing React Native/TypeScript/Expo/Supabase. One Expo document picker, Expo FileSystem for binary reads, Expo Crypto for unique object keys; installed using Expo SDK compatibility resolution.

## Tasks

- [x] Add focused failing tests for Auth event coalescing, sign-out/unmount invalidation, explicit-operation event suppression, selected-file normalization, and safe unique Storage paths.
- [x] Add a reproducible Node test runner using the existing TypeScript compiler and Node test API; preserve current routing tests.
- [x] Implement service-owned Auth subscription and ViewModel-owned synchronization. Keep callbacks synchronous; defer account loading beyond Auth callback execution. Explicit mutations reload account once. Preserve editor/OTP state during same-destination background refreshes. Profile saves derive routing from refreshed backend state.
- [x] Install one SDK-compatible picker and required Expo binary-read/UUID support. Normalize URI/name/MIME/size, treat cancellation as normal, preserve causes behind safe error messages.
- [x] Reuse existing document picker/review UI with actual local files; disable preview submission for real selections. Do not reconnect the production verification entry or upload during selection.
- [x] Add private upload API requiring existing submission ID, safe unique path, ArrayBuffer upload, upsert false, metadata result; no metadata inserts or public URLs.
- [x] Run typecheck and all relevant tests. Inspect changed boundaries and deferred integration exclusions.
- [x] Create Auth/Profile and Verification living docs; shorten FEATURES to an index; make targeted corrections to global docs and stale route descriptions. Record commit baseline and runtime-unverified status.
- [x] Report files, exact validation, remaining contracts, and live test checklist. Do not commit.

