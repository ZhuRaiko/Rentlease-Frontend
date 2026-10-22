# RentLease account interface design

## Scope and source of truth

Profile and Verification presentation, refined 2026-10-23. This records the implementation direction; it does not replace `docs/ARCHITECTURE.md` or prescribe changes to other features. Native visual acceptance remains Android RUNTIME-UNVERIFIED.

## Visual language

Restrained neo-brutalism expressed through firm section framing, near-square corners and confident type. Retain the circular avatar and separated settings rows. Avoid ornamental shadows, gradients, offset decoration and oversized display text.

## Tokens

Use `src/shared/theme/` exports directly. Existing `primaryAction` (#32743C) carries actions and avatar emphasis; `accountCredentialInk` (#204C34) frames identity and verification panels. Existing neutral background/surface/text tokens remain authoritative. Navigation icons use `textSecondary` (#757575).

`radius.firm` is 4dp for account panels and tier markers. It does not replace existing button radii. Borders are generally 1dp; 2–3dp rules establish section hierarchy, with a 4dp identity edge. Use existing named spacing tokens. Do not apply heavy outlines to every row or control.

## Typography

Keep the existing Roboto family. Profile name is 24dp/800 with 30dp line height; Verification page headings are 22dp/800 with 29dp line height; section headings are 18dp/800 with 25dp line height. Body remains 16dp with 24dp line height. Supporting text stays 14–15dp. Preserve default system font scaling and content-driven heights.

## Components and layout

- Profile: framed neutral identity panel, circular avatar/name/roles, bio and outlined Edit; compact framed verification summary; simple settings groups with firm top rules and thin row dividers.
- Verification overview: separated framed tier panels; outlined 01/02/03 markers; status and required/optional metadata grouped beneath each heading; concise instructions and existing outlined action buttons.
- Verification flow: shared scaffold uses a bold heading and green baseline; keep existing document selection, review, status and preview components and all Back/Close controls.
- Tier markers share a white surface and green ink independent of status. Preserve explicit success, warning, error and informational labels/colors in the existing status component.
- Buttons retain existing filled-green primary and outlined-secondary styles, disabled feedback and action guards. Ordinary navigation icons remain neutral gray.

No decorative motion is added. Keep existing press feedback, 48dp action targets, wrapping layout, scroll containers and ViewModel callbacks. Android review must cover narrow widths, increased fonts, long names/reasons, account roles, actual verification states and document-preview/Back behavior.
