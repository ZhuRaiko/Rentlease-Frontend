# Admin Actions and Audit: design passes and Android evidence

Scope: the Actions tab, restriction detail and sheets, the report-review "Take action" entry point, the Audit tab and the dashboard's Recent decisions (`src/features/admin-moderation/`). Presentation and wiring only; the backend change is a separate prepared migration (see the backend ledger).

## What was and was not observable

The hosted project does not have the new RPCs yet, so the real app shows a plain "Backend update needed" message on these screens. Two kinds of screenshots are therefore kept, and they are labeled by filename:

- `live-*`: the real, unpatched app against the hosted project (error state only).
- `sample-data-*`: the real screens rendered with a **temporary, local, in-memory sample service** (invented accounts and entries) so the layout, sheets, keyboard behavior and the restore flow could be seen. That service and its demo buttons were removed afterwards; the three patched files were restored byte for byte (same md5 as before the patch) and a regression test now fails if any demo or sample code is present in these sources.

Emulator: emulator-5554, 1080x2400. 100% is density 420 at font scale 1.0; "320dp/150%" is density 540 at font scale 1.5. Settings were restored afterwards. These are agent observations, not user acceptance, and do not cover TalkBack.

Screenshots: `admin-actions-audit-screenshots/`.

## Skills used

| Skill | What was done |
| --- | --- |
| RentLease UI/UX design (primary) | Authority order, tokens only (no new colors or fonts), one primary action per screen, sticky action bars, 48dp targets, progressive disclosure (IDs collapsed), honest states |
| Impeccable (native/android; critique, layout, polish) | The reference method was applied by hand to the screenshots above: a design-director review of hierarchy, grouping, rhythm and states (critique), structure and spacing at both text scales (layout), then fixes and re-capture (polish). Its references were read in the previous Admin pass; no `impeccable` CLI command was run in this pass, and `impeccable detect` does not apply to native source |
| UI/UX Pro Max | `python .claude/skills/ui-ux-pro-max/scripts/search.py "bottom sheet modal dismiss unsaved" --domain ux` (returned only a generic focus-state rule); its Quick Reference rules `sheet-dismiss-confirm`, `touch-target-size`, `touch-spacing`, `color-accessible-pairs` and `truncation-strategy` were applied. No `--persist`, no palette or font output used |
| Frontend Design | Loaded in the previous pass and applied to spacing, contrast and touch targets only; its palette, type and layout direction were not used |
| Hallmark | Not used |

## Findings and changes

| Source | Finding (evidence) | Change |
| --- | --- | --- |
| Critique, live screenshot | The five Audit filter pills wrapped, orphaning "Reviews" on a second row at 411dp | Pill padding `spacing.sm` to `spacing.xs`, `minWidth` 48dp, label 14 to 13dp; all five now fit one row, and they still wrap cleanly at 150% |
| Layout, sample-data dashboard | "Newest first." sat flush against the last timeline entry | Recent-decisions block wrapped in a container with `spacing.sm` gap |
| Layout/polish, 150% audit | Timestamps with seconds ("12:01:09 PM PHT") wrapped awkwardly | Minute-precision `formatAdminDateTime` for audit rows |
| UI/UX Pro Max `sheet-dismiss-confirm` | Tapping the backdrop, Back or Cancel silently discarded a typed reason of up to 500 characters | One discard confirmation ("Discard this reason?") on all three paths when a reason has been typed; nothing can dismiss the sheet while a decision is being saved |
| Critique, keyboard | With the keyboard open the sheet moves above it and the reason box, effect text and both buttons stay visible (pass) | None |
| Layout, 150% | Nothing clips: lists wrap, chips wrap, the nav reflows to two rows (existing), sheets scroll with the title pinned | None. P3 noted: at large text the confirm buttons sit at the end of the sheet's scrolled content |
| Touch targets | Cards, pills (48dp minimum), footer buttons and disclosure rows are 48dp or more with 8dp between wrapped rows | None |
| Contrast | Only existing token pairs are used (chips 4.63 to 7.94:1, secondary text 5.15 to 5.62:1, control borders 3.30:1 against white) | None |
| Anomaly | Two taps on the footer "Restore account" button did not register at 150% while Fast Refresh was re-rendering after an edit; five later taps from y=2060 to 2215 all registered | Not reproduced; recorded |
| Test-automation note | `adb input text` types fast enough that two "r" key events within 200ms trigger the React Native dev client's reload-on-double-R shortcut for text typed in a Modal. Real soft-keyboard typing does not | None; use text with a single "r" when scripting |

## Verified vs not

Verified (agent-observed): live error states; populated screens, restore flow (open, type, confirm, success notice, list updates), keyboard behavior and 150% layouts using the sample service.
Not verified: the hosted RPCs, anything on a real upheld report, TalkBack, dark theme, tablet, the discard confirmation on a device (covered by a source test only).
