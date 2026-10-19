---
name: rentlease-frontend-mvvm-guard
description: Use whenever RENTLEASE React Native Views, components, ViewModels, models, services, state ownership or navigation are changed or reviewed.
---

# RENTLEASE frontend MVVM guard

Preserve `docs/ARCHITECTURE.md` and the dependency direction View → ViewModel → service/data access → backend/device/external service. Inspect the existing feature and shared implementations first.

| Layer | MUST own | MUST NOT contain |
| --- | --- | --- |
| Views/components (`.tsx`) | Rendering, props, input, visual formatting/UI-only state, invoking ViewModel actions | Supabase queries/Auth calls/Storage uploads, external-service clients, authorization decisions or complex workflow orchestration |
| ViewModels (`.ts`) | Screen/derived state, workflows, service calls, loading/error/success, lifecycle cleanup and double-action prevention where needed | Raw query-builder/upload code that belongs in services, TSX |
| Services (`.ts`) | Focused typed Supabase/API/Storage/device operations and domain-appropriate results | UI imports, navigation or feature ViewModel dependencies |
| Models (`.ts`) | Framework-independent contracts, constants and domain values | Hooks, UI, navigation or data access |

Use `src/features/<feature>/{models,viewModels,views}` and feature-local services where appropriate. Reuse `src/shared/components`, `src/shared/theme`, models and service boundaries before creating duplicates. Move code into shared only for genuine cross-feature reuse; do not import another feature's View/ViewModel into a feature. Root composition may wire feature flows.

MUST preserve the existing navigation approach: `App.tsx` owns workspace state/Modal; features own screen state. Do not introduce a second navigation framework. Modify routing only when the requested feature requires it. Navigation/role gates control presentation, never backend authorization.

Use existing React/ViewModel state patterns with clear authoritative ownership and cleanup of timers/subscriptions/stale requests. Do not add Redux, Zustand, MobX or another state abstraction without explicit authorization and demonstrated need. Keep integration work focused: reuse screens, preserve working behavior/design, and add only necessary loading, error, empty, disabled, status and retry/refresh presentation. A backend connection is not permission to redesign UI. Follow Figma MCP when a link is supplied and reuse existing design tokens/assets.

MUST use `.tsx` for UI and `.ts` for ViewModels/models/services/hooks/utilities/configuration; no `.jsx` application files. Keep the Android-first Expo/TypeScript stack. Apply [rentlease-supabase-contract-guard](../rentlease-supabase-contract-guard/SKILL.md) for backend calls and [rentlease-test-runtime-verification](../rentlease-test-runtime-verification/SKILL.md) for behavior/lifecycle evidence.
