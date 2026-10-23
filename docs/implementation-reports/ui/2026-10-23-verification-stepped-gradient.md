# Verification overview stepped right-side gradient

2026-10-23, Asia/Singapore. Branch `feature/ui-improvements`, baseline `6f004eb` plus uncommitted experiment. IMPLEMENTED / AUTOMATED-TESTED / user Android RUNTIME-UNVERIFIED.

## Treatment

Refines the preceding smooth corner wash into a light horizontal, quantized gradient: Account green (98,172,93), Identity teal (55,170,164), Property warm olive (176,174,68). Only VerificationTierCard changes application code. White remains the base. The first quarter has only 0.56% tint; presence begins gently at 28%, becomes meaningful around 42%, and grows through seven broad plateaus to 28% opacity from 87% to the right edge. Three-percentage-point joins soften the band boundaries without erasing their stepping. No diagonal, noise, texture, shadow or animation.

`cardWash.opacity` scales every band (0.20 quiets it, 0 removes it); `bands` holds position/strength. Existing React Native `experimental_backgroundImage` renders the gradient without a dependency. The API remains experimental; the white base is retained. Supporting text becomes #4C5A51 for contrast. Status indicators sit on white so warning/error/info/success inks remain readable regardless of label length; buttons and tier marks also stay white. Existing card padding, hierarchy, type sizes, borders, content, status mapping, callbacks and guards remain. No backend or business/navigation logic changed.

## Native comparison

Actual same-session Android screenshots at physical 1080x2400, density 420, font scale 1.0 (approximately 411dp), matching overview scroll position. Before is the prior corner-wash experiment, not the original white-card design. A small header portion is above the scroll viewport in both captures.

| Before | After |
| --- | --- |
| [Corner wash](verification-stepped-screenshots/overview-before.png) | [Stepped right-side color](verification-stepped-screenshots/overview-after.png) |

At 320dp/150% text: [Account and Identity](verification-stepped-screenshots/overview-narrow-large-after.png), [Identity action and Property](verification-stepped-screenshots/property-narrow-large-after.png). Agent observed readable wrapping/scrolling; proportional horizontal stops keep the white/color composition at different widths. Current ordinary session is dual-role with verified Account/Identity and per-property status. This is not all-state coverage or user acceptance.

## Validation and limits

- `npm.cmd run typecheck`: PASS.
- `npm.cmd test`: 288 passed, zero failed/skipped/cancelled. No new implementation-mirroring tests for this reversible presentation change.
- Staged/unstaged `git diff --check`: PASS.
- Calculated maximum-band contrast: main ink minimum 11.23:1; supporting text minimum 5.55:1. Existing status foregrounds retain white backing. Calculations do not establish a full accessibility audit.
- Agent-observed native default and narrow/enlarged layout. Original physical 1080x2400, density 420, font scale 1.0 restored and confirmed. User session and existing Metro retained; no private document opening, submission or moderation write.

USER_VERIFICATION.md and DESIGN.md describe the current scoped treatment. The preceding corner-wash report and images remain historical comparison evidence. Other Android versions/devices, role/status variants, TalkBack and user acceptance remain unverified. No automatic commit or push; other application surfaces are unchanged.

## Lighter follow-up

User requested lighter colors while retaining the accepted direction. Peak `cardWash.opacity` is now 0.20 (about 29% less color contribution than 0.28); hues, seven bands, left/right composition, text, white status/button surfaces and all layout/actions remain unchanged. Impeccable restraint, Hallmark component-scope consistency and UI/UX Pro Max contrast/color-not-only guidance informed the adjustment. No page restructure or additional effects. Hallmark self-review (1-5): philosophy 4, hierarchy 4, execution 4, specificity 4, restraint 5, variety 3; this is intentionally a small refinement of one component.

[Previous 28%](verification-stepped-screenshots/overview-after.png) versus [lighter 20%](verification-stepped-screenshots/overview-lighter-after.png): actual matching default-size Android captures. Agent inspected all three lighter cards; thin borders, readable text and white controls remain. Narrow/enlarged captures above document the preceding 28% treatment, not a fresh enlarged-font check of 20%; geometry is unchanged and lowering alpha increases contrast. No display settings were changed in this follow-up. Typecheck and 288/288 tests PASS; staged/unstaged whitespace PASS. Remains uncommitted; user acceptance of the lighter treatment is pending.

## Right-shifted 25% follow-up

Latest user direction supersedes the 20% variant: peak opacity is 25%, with the near-white plateau extended to 42%, meaningful tint beginning at 57%, and maximum tint confined to the final 6%. Intermediate plateaus shift right proportionally. Hues, text, white status/button surfaces, layout and behavior remain unchanged. [Previous 20% placement](verification-stepped-screenshots/overview-lighter-after.png) versus [right-shifted 25%](verification-stepped-screenshots/overview-right-shifted-after.png), matching default Android captures. Agent inspected all three; more of the text region remains near-white. No display settings changed. Typecheck, 288/288 tests and staged/unstaged whitespace checks PASS. This follow-up has no new narrow/enlarged capture; earlier ones remain historical. Uncommitted, pending user inspection.

## Rich curved distribution, current review revision

User requested recognizable rich endpoints rather than another alpha increase. The prior low-opacity linear wash is replaced by a right-origin ellipse (100% horizontal radius, 180% vertical radius, origin at right/35% height). Radial stops retain five plateaus: 100% endpoint at 0-22% radius, 65% at 29-39%, 30% at 46-54%, 8% at 61-66%, white beyond 73%. Four softened joins create curved, non-vertical boundaries. This is a controlled curved exploration, not noise or irregular pixel art. White occupies the left quarter; rich color occupies the right portion, varying gently with height.

Endpoints: Account #45AC67, Identity #32AAB5, Property #E6AC37. Supporting copy now uses existing shared ink #172C27; all type sizes/spacing/content/actions remain. Calculated minimum text contrast against the full endpoints: emerald 5.15:1, cyan-teal 5.30:1, amber 7.24:1. Intermediate blends toward white are lighter. Status text and buttons stay on white. No global gradient or logic/backend/navigation change.

[Previous pale right-shifted wash](verification-stepped-screenshots/overview-right-shifted-after.png) versus [new rich curved Android capture](verification-stepped-screenshots/overview-rich-curved-after.png). Agent observed default approximately 411dp/100% text on the same overview/account/scroll position. This revision was not freshly checked at narrow/large-font settings; earlier captures depict historical versions. No display setting, account, private document or backend write was changed in this revision.

Impeccable product guidance informed hierarchy and task clarity; frontend-design guidance informed committed color identity and precise curved composition within the existing marketplace language. Final typecheck PASS, 288/288 tests PASS (zero failures/skips/cancellations), staged/unstaged whitespace PASS. User acceptance and broader native/accessibility/state coverage remain unverified. Stop here for visual review; uncommitted and unpushed.

## Tinted left and inset peak, latest review revision

Two targeted optical adjustments preserve the rich emerald/teal/amber endpoints and existing card design. The outermost plateau now retains 7% of the tier color instead of zero, creating a visible near-white left tint. The ellipse origin moves from the right edge to 80% width (height origin remains 35%). Full-color core spans 0-5% radius, placing the strongest point near 75-85% width at the origin height. An 82% shoulder spans 15-23% radius, so the far-right edge softens. Existing 65% and 30% plateaus remain; the light shoulder is 12%. This retains curved posterization with soft joins and avoids a flat pastel fill. No other component styling, type, dimensions, padding, borders, buttons, content, statuses or behavior changed.

[Before: rich edge-origin](verification-stepped-screenshots/overview-rich-curved-after.png) versus [after: tinted floor and inset peak](verification-stepped-screenshots/overview-inset-tinted-after.png), actual default Android captures at the same overview scroll position. Agent observed all three cards. Endpoint colors and foreground ink remain unchanged, so the previously calculated minimum 5.15:1 ink contrast remains applicable. Impeccable product guidance informed optical balance and retaining task hierarchy. Typecheck, 288/288 tests and staged/unstaged whitespace checks PASS. No fresh narrow/enlarged or full-state acceptance was performed; no emulator settings changed. Uncommitted, stopped for visual review.

## Restored right-heavy composition, current revision

User rejected the full-card tinted floor. Restore the rich edge-origin direction and tighten it: origin at 104% width/35% height, full color out to 24% radius, 65% at 30-35%, 30% at 41-46%, 8% at 52-55%, transparent beyond 61%. The left reading region remains white; richest energy is near the rightmost 20%, with only a limited soft lead-in. Emerald/teal/amber endpoints, foreground ink, typography, dimensions, borders, buttons, spacing, content and logic are unchanged.

[Earlier rich composition](verification-stepped-screenshots/overview-rich-curved-after.png) and [current refined right bloom](verification-stepped-screenshots/overview-right-bloom-refined-after.png). Actual default Android captures; the latest capture is at the top of the overview while the earlier one is slightly scrolled. Agent observed all three cards. No new narrow/enlarged check; earlier captures remain historical. Typecheck and 288/288 tests PASS, zero failures/skips/cancellations; staged/unstaged whitespace PASS. Endpoint contrast remains at least 5.15:1 for foreground ink. No display settings changed. Remains uncommitted and stopped for visual review.
