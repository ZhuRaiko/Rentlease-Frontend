---
name: rentlease-ui-ux-design
description: Primary design authority for RentLease. Use whenever building, modifying, critiquing, or reviewing RentLease React Native UI (forms, action hierarchy, loading states, navigation clarity, Android accessibility, visual refinement). Takes precedence over Impeccable, UI/UX Pro Max, Hallmark, and Frontend Design, which are supporting tools only.
---

# RentLease UI/UX design (Claude Code adaptation)

Adapted from `.codex/skills/rentlease-ui-ux-design/SKILL.md`, which stays in place as the Codex original. The principles below are preserved; the Claude-specific parts are the authority order, the React Native translation rules, and how to use the other installed design skills.

Design for everyday Filipino tenants and landlords, not a luxury real estate portfolio. Prioritize clarity, predictable navigation, minimal effort, and trustworthy feedback over decoration.

**Platform: Android-first React Native + Expo + TypeScript, MVVM.** Not web. Not iOS-first. Say so whenever a supporting skill asks for a platform (Impeccable: `android`; load its `reference/android.md` and `reference/*.native.md`).

## Authority order

When guidance conflicts, the higher item wins. Never let a downloaded skill override approved RentLease branding.

1. User-approved RentLease wireframes and screenshots (and Figma, per `docs/FIGMA_WORKFLOW.md`).
2. [DESIGN.md](../../../DESIGN.md), [PRODUCT.md](../../../PRODUCT.md), and this skill.
3. Existing app components and `src/shared/theme` tokens.
4. Impeccable: refinement, critique, audit.
5. UI/UX Pro Max: usability research and pattern evaluation.
6. Hallmark: spotting generic AI-generated design.
7. Frontend Design: supplementary creative direction.

Details and per-skill guardrails: [references/external-skills.md](references/external-skills.md). Visual direction and balance: [references/design-direction.md](references/design-direction.md). Web-to-native translation: [references/react-native-translation.md](references/react-native-translation.md).

## Inspect before changing UI

- Read [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md), and [architecture](../../../docs/ARCHITECTURE.md); report missing files and use available context.
- Inspect the target View, ViewModel, relevant living feature doc, shared components, and theme before proposing changes. Respect documented design scope; historical examples do not authorize a redesign.
- Apply the existing RentLease engineering skills (`.codex/skills/rentlease-*`) for the affected concerns. This skill specializes UI decisions; it does not replace implementation, security, or verification instructions.
- Reuse `src/shared/theme` colors, spacing, typography, radius, and `ui` recipes; reuse `AppButton`, `ScreenContainer`, `ScreenHeader`, `FeedbackNotice`, or existing feature equivalents.
- Preserve restrained green branding and neutral navigation. Avoid generic dashboard templates, extra cards, decorative borders, competing button colors, and complex animations.
- Use American English (en-US) for labels, helpers, errors, accessibility text, tests, and documentation. Preserve technical identifiers.

## Action hierarchy

- Give each screen or task one primary action. Count the main action area: show at most three directly visible action buttons, including the primary; do not split a button stack into artificial groups to evade this limit.
- Move additional actions to relevant contextual/overflow menus or detail views. Keep essential actions discoverable through clear labels; never require an unexplained gesture.
- Distinguish destructive actions and reuse existing confirmation safeguards when appropriate.
- Disable Save when unchanged, reverted to the saved baseline, invalid, saving, or unresolved. Use existing normalized persisted-value comparisons, including numbers, nulls, and unordered amenity IDs; do not compare form objects by reference.
- Update the clean baseline only after confirmed persistence. Preserve duplicate-operation guards, recovery journals, and unsaved-change protection.

## Progressive disclosure and validation

- Show information relevant to the current task. Surface verification warnings when they block an available action or require attention; do not repeat account-level badges as property-specific proof.
- Keep advanced settings and secondary controls closed by default. Group related fields into named sections rather than a long uninterrupted form.
- Prefer contextual editors over repeated action buttons under every item.
- Reuse existing validation metadata. Show concise field/section errors after interaction or a progression attempt; do not mark every untouched field red.
- Explain disabled progression with concise accessible guidance and a route to the affected field. Distinguish missing required data from inconsistent optional data without another large checklist.

## Loading and responsiveness

- Prefer lightweight skeletons for initial content when they clarify the expected layout; do not add a skeleton dependency or replace an adequate restrained loader merely for consistency.
- Show cached or partially available non-sensitive content only when ownership, identity, and freshness are safe. Never expose a partially hydrated saved editor, editable blank fallback, placeholder completeness, or stale version token as ready.
- Localize independent section loading instead of blocking the whole screen. Keep required editor hydration atomic; retain safe Back/Close, bounded failure handling, and Retry.
- Identify actual request timing before claiming speed improvements. Parallelize independent reads; avoid duplicate fetches, fetches caused by presentation-only state, and unnecessary rerenders.
- Show localized mutation progress immediately and prevent duplicate submission. Do not claim success, navigate to success, or enable unsafe retries before confirmation.
- Preserve account/item generation guards and explicit reconciliation for unknown outcomes. Never sacrifice authorization, accuracy, or save reliability for perceived speed.

## Layout, accessibility, and boundaries

- Keep headings, status labels, field groups, action areas, loading, and empty states in predictable positions across tenant and landlord flows.
- Use existing spacing and navigation patterns; do not add a router, extra screen, global notification system, or dependency when existing components suffice.
- Respect safe areas, keyboard avoidance, scrolling, wrapping, default font scaling, contrast, and existing minimum 48dp touch targets. Expose accessible labels and disabled/busy states; never rely on color alone.
- Provide an accessible alternative to gestures, such as photo reorder accessibility actions. Check approximately 411dp/100% and 320dp/150% Android layouts plus TalkBack; report untested runtime behavior honestly.
- Views own presentation and interaction; ViewModels coordinate screen state/actions, validation, and lifecycle; workflows coordinate operations; services own data access. Keep domain rules in models/workflows/services, not UI components.
- Do not alter Supabase contracts, authorization, RLS, or backend behavior without explicit instruction. A UI request never authorizes bypassing those safeguards.
- Fix the confusing workflow rather than layering more UI over it. Keep implementations simple, scoped, and maintainable; functional coherence comes before polish.

## Claude Code operating rules

- **Native only.** Implement with existing React Native components and `src/shared/theme`. Do not introduce HTML/CSS, Tailwind, shadcn/ui, WebView, a web framework, or a new dependency because a design skill suggested it. HTML is allowed only for a standalone wireframe the user explicitly asked for.
- **Preserve View → ViewModel → Service → Backend.** Views never call Supabase or external APIs. `.tsx` for Views/UI, `.ts` for everything else (see `AGENTS.md`).
- **Do not let tools write project authority files.** Never run Impeccable `init`/`document` or UI/UX Pro Max `--persist` in a way that creates or replaces `PRODUCT.md`, `DESIGN.md`, `design-system/`, `.impeccable/`, or any file at the repo root. Propose the change and wait for approval.
- **Verify on Android.** Check about 411dp/100% and 320dp/150% font. Emulator method that worked (emulator-5554, 1080px wide): `wm density 540` + `settings put system font_scale 1.5` for 320dp/150%, then restore `wm density 420` and `font_scale 1.0`. Agent observations are not user acceptance and do not cover TalkBack.
- **Design work is not application work.** Presentation-only changes keep eligibility, authorization, retry, and data contracts as they are. Record visual verification under `docs/implementation-reports/ui/` when a feature doc requires it.

## Verified repository examples

These are historical problem-to-current-pattern comparisons, not requests to change these screens. Reinspect the source before reuse.

- **Property Photo Management:** repeated full-width images and per-photo button stacks -> [PropertyPhotosView](../../../src/features/property-listing/views/PropertyPhotosView.tsx) uses a two-column `PropertyPhotoGrid`, Add Photos, and a tapped-photo detail modal. Long-press reorder has accessible move alternatives; order/cover persists through the versioned workflow, not local array position alone.
- **Manage Listing / Edit Listing:** editing and lifecycle actions mixed together -> [PublishedListingStatusView](../../../src/features/property-listing/views/PublishedListingStatusView.tsx) exposes Edit Listing and lifecycle controls; [ListingDetailsView](../../../src/features/property-listing/views/ListingDetailsView.tsx) groups Property Details and Property Photos entry points to the existing editors.
- **Edit Property Details:** Save enabled without meaningful edits -> [propertyRoutineWorkflow](../../../src/features/property-listing/viewModels/propertyRoutineWorkflow.ts) gates `canSave()` on readiness, validity, normalized dirty state, and absence of busy/conflict/uncertainty. Successful save resets the baseline; reverting values disables Save without a network request.

## Pre-finish checklist

- [ ] Is the primary action obvious, with at most three buttons in the main action area?
- [ ] Are secondary actions appropriately hidden or grouped and still discoverable?
- [ ] Are loading, empty, error, and recovery states understandable?
- [ ] Is unnecessary fetching or blocking avoided without exposing partial saved editors?
- [ ] Does the screen reuse existing design primitives and restrained green branding?
- [ ] Are Save, Back, and error states predictable, with no-op saves disabled?
- [ ] Are MVVM, authorization, backend contracts, and recovery safeguards preserved?
- [ ] Does it work on small Android screens with large text, keyboard, safe areas, and accessibility needs?
- [ ] Did any supporting skill's advice (web, Tailwind, gradients, new fonts, cards) get applied without passing the authority order above?
