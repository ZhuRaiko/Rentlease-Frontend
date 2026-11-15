# Admin Phase 1: design skill passes and Android evidence

Scope: `src/features/admin-moderation/`. Presentation and wiring only; no backend, RLS, migration or deploy changes.

## Evidence

Captured on emulator-5554 (1080x2400, density 420, font scale 1.0) and again at density 540 with font scale 1.5 (about 320dp/150%). Settings were restored afterwards. Signed in as the Admin account against live data (0 verification, 1 report, 0 reviews).

Screenshots are in `admin-phase1-screenshots/`: `before-polish-*` (first Phase 1 build), `after-polish-*` (after this pass), `320dp-150pct-*`.

Not captured, because the live account has no such data: verification review (and its Approve sheet), a review in the Reviews tab, and the new review moderation screen. Those were checked from source and unit tests only.

## Skills loaded and commands run

| Skill | What was run |
|---|---|
| RentLease UI/UX (primary) | Loaded; authority order, token and 48dp rules applied |
| Impeccable | `impeccable context --target src/features/admin-moderation`; references read: `audit.native.md`, `critique.md` (native: Assessment A only), `layout.md`, `typeset.md`, `polish.md`, `craft-floor.md`, `android.md`. `impeccable detect` was not run (web-only; the skill says not to use it on native source). Critique snapshot was not persisted: `.impeccable/` is off-limits without approval. |
| UI/UX Pro Max | Loaded; `python scripts/search.py --domain ux` for touch targets and disabled states; contrast ratios computed for the token pairs in use. No `--persist`, no palette or font output used. |
| Frontend Design | Loaded; used only for the spacing, contrast and touch-target checks. Its palette, typography and creative-direction guidance was not applied. |
| Hallmark | Not used. |

## Findings and changes

| Source | Finding (evidence) | Change |
|---|---|---|
| Critique (screenshot) | Sticky action bar used 16dp side gutters while content uses 24dp, so the button was visibly wider than the cards | Footer gutter now `spacing.lg` |
| Critique / UI/UX Pro Max | Disabled "Uphold" option used 60% opacity; its explanation text measured about 2.5:1 | Disabled state now uses the `surface` background and full-strength secondary text (5.15:1); no opacity |
| Critique | "Save decision" was disabled with no hint why | One-line hint under the note field while Save is unavailable |
| Layout (Reviews tab screenshot) | Four status pills wrapped to a second row with an orphan "Hidden" | Pill padding `spacing.md` to `spacing.sm`; all four fit on one row at 411dp |
| Polish (Dashboard screenshot) | A count of 0 was tinted amber/red/blue like real work | Zero or unknown counts use the neutral surface and ink |
| UI/UX Pro Max (contrast) | Unselected pill and selected-tab borders used the decorative outline color (1.29:1) | Now `controlBorder` (3.30:1, meets the 3:1 control-boundary guidance) |
| Typeset | Roles hold: page title 22/28, card title 15/600, supporting 13/20, chip 13/700; no text below 13dp in the new code (the existing nav label is 12dp and was not changed). Uppercase 13dp section labels follow the approved wireframe rather than DESIGN.md's 17dp/600 section heading | None; noted |
| Layout (320dp/150%) | Nothing clips; tabs stack, attention cards wrap, nav reflows to two rows (existing). Stacked tabs plus the two-row nav use a lot of the screen | None; noted (P3) |
| Touch targets | Pills, tabs, options, disclosures, header actions and footer buttons are 48dp or more; gaps are 8dp except the 2dp seam between segmented tabs | None; noted (P3) |
| Contrast (all token pairs used) | Text pairs measure 4.63 to 17.3:1 | None needed |

## Not changed

- The pre-existing 12dp nav label and the existing hardware-Back wiring in other features.
- The "Pull down to refresh" helper line repeats on every tab (polish candidate).
- `PRODUCT.md`, `DESIGN.md`, `design-system/` and `.impeccable/` were not created or modified.

## Verification status

Verified: typecheck, `git diff --check`, focused tests, emulator captures listed above, hardware Back from the report review (returns to the queue, and shows the leave guard when a draft exists).
Not verified: TalkBack, dark theme, tablet, verification review screens, review moderation screen on live data.
