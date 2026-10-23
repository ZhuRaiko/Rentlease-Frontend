# Verification overview corner-wash experiment

2026-10-23, Asia/Singapore. Branch `feature/ui-improvements`, baseline `6f004eb` plus uncommitted changes. IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED.

## Treatment and boundary

The existing VerificationTierCard now uses a single native elliptical radial background at the top-left: Account green (92,148,99), Identity teal (68,143,139), Property muted amber (164,151,76). Peak opacity is 12%, reducing to 3.6% halfway and zero at the 260 x 170dp extent. White remains dominant. Borders, padding, typography, content, statuses, eligibility and actions are unchanged. The wash is tier identity, independent of status. No shared card, Profile, status page, ViewModel, service, backend, dependency or asset changed.

React Native 0.86 already supports `experimental_backgroundImage`; it rendered in the connected Android development client. This API remains experimental. The white base is preserved. Only `src/features/user-verification/components/VerificationTierCard.tsx` changes app code. `cardWash.opacity` controls all three strengths (try 0.08 to tone down, 0 to remove); `cardWash.radius` controls reach without affecting card dimensions. DESIGN.md and the living User Verification document record the scoped exception.

## Actual Android comparison

Same ordinary dual-role session, overview and scroll position at physical 1080x2400 / 420dpi / font scale 1.0 (approximately 411dp). These are actual emulator captures, not mockups. The account has verified Account/Identity; Property remains checked per property.

| Before | After |
| --- | --- |
| [White cards](verification-wash-screenshots/overview-before.png) | [Corner washes](verification-wash-screenshots/overview-after.png) |

The after image preserves card/text/button positions. Color is confined to the upper-left and fades into the white body/action region. The tint is deliberately faint rather than a full card fill. Enlarged inspection at 320dp/150%: [Account and Identity](verification-wash-screenshots/overview-narrow-large-after.png), [Property and actions](verification-wash-screenshots/property-narrow-large-after.png). Cards grow with text and scroll; the fixed wash extent prevents enlarged cards from becoming more fully colored.

## Validation

- `npm.cmd run typecheck`: PASS.
- `npm.cmd test`: 288 passed; zero failed/skipped/cancelled. No additional implementation-mirroring test for this reversible style change.
- Staged and unstaged `git diff --check`: PASS.
- Calculated contrast on each maximum-opacity composite over white: main ink minimum 12.88:1, secondary text minimum 4.91:1, green status minimum 4.97:1. Existing foreground colors remain. This is a color calculation, not a full accessibility audit.
- Agent inspected default and narrow/enlarged Android rendering. No document/submission/moderation write was performed. Original physical 1080x2400, density 420, font scale 1.0 restored and confirmed; session and existing Metro retained.

User acceptance, other Android versions/devices and all status/role/TalkBack paths remain unverified. No automatic commit or push for this experiment.
