# 360° room tour: design pack (T1-T8)

Visual target for the room tour screens. Suggested repo path: `docs/design/room-tour/`.

## Where it came from
- Source: the "RentLease UI refresh" design canvas, https://claude.ai/artifact/YbS9t8PPEDeSU8R1tQFJzr (version `1794992781-c57f`, read 2026-11-18), the eight published files `TourOwner`, `TourOwnerStates`, `TourOwnerMenu`, `TourOwnerRemove`, `TourDetails`, `TourViewer`, `TourHint`, `TourStates`.
- `screens/*.dc.html`: the design source for each screen (static markup, 411x891). They reference `./support.js` and Google Fonts; they are not meant to run inside the app.
- `png/*.png`: each screen rendered at 411x891 @2x with Playwright (Chromium), JavaScript off, Roboto from the `@fontsource/roboto` npm package (weights 600 and 800 render as 700 and 900 because Roboto has no 600/800 files). All eight were opened and checked.

| Screen | Files | What it shows |
| --- | --- | --- |
| T1 Owner card | `TourOwner` | "360° room tour" card in the Listing step: filled Front side tile (check badge, "⋯" button) and an empty "Add back side" tile |
| T2 Owner states | `TourOwnerStates` | Uploading (dimmed preview, "Uploading front side · 60%", progress bar, other tile disabled) and the problem tile (red) |
| T3 Owner menu | `TourOwnerMenu` | Bottom sheet from "⋯": preview, "Replace photo", "Remove" |
| T4 Owner remove | `TourOwnerRemove` | Confirm sheet: "Remove front side?", "Keep it" / "Remove" |
| T5 Renter card | `TourDetails` | Rental details with the compact "Look around the room" card (thumbnail with a "360°" badge, subtitle, chevron) |
| T6 Viewer | `TourViewer` | Full-screen viewer: X, strip, position bar, Front/Back switch |
| T7 Hint | `TourHint` | First-open "Drag to look around" overlay |
| T8 Viewer states | `TourStates` | Loading ("Loading front side...") and "Couldn't load" with one "Try again" (two states stacked on one board) |

## Rules for implementers
1. The hex colors, sizes and fonts in the sources are a VISUAL REFERENCE ONLY. The app must use its own theme tokens and shared components. Rebuild each screen from the HTML and PNG; do not copy the HTML.
2. Touch targets are at least 48dp (the app rule). The "⋯" button is a 48dp target with a smaller visible circle: keep the 48dp hit area.
3. The dashed grey boxes ("Photos card · 8 of 10 (existing, unchanged)", "Rest of rental details · unchanged") and the placeholder house/room illustrations are NOT to be built. They stand in for existing app content and for real photos. The "Save listing details" and "Request to reserve" footers already exist in the app; the bottom navigation and footer inset behavior stay untouched.
4. Verify at 411dp/100% and 320dp/150% font scale. Portrait only.
5. Colors alone never carry meaning: the problem tile has an icon and text.

## Copy to use exactly (design copy wins over earlier written specs)
- Owner card: title "360° room tour", badge "Optional", subtitle "Let renters look around. Take each side with your camera's Panorama mode." Tiles: "Front side", "Add back side" (and "Add front side" when that side is empty).
- Problem tile (tap picks another photo): "This photo isn't wide enough" / "Use Panorama mode and sweep slowly. Tap to pick another."; "This file is over 15 MB. Tap to pick a smaller one."; "Couldn't upload. Tap to try again." (A wrong-file-type message is not designed: use "Use a JPEG, PNG or WebP photo.")
- Menu: "Replace photo", "Remove". Confirm: "Remove front side?", "Renters won't see it anymore. You can add it again later.", buttons "Keep it" and "Remove".
- Renter card: "Look around the room"; subtitle "Front and back side" (or "Front side only" / "Back side only"; the one-side subtitle is not drawn). The whole card opens the tour. No card when there is no tour.
- Viewer: title "Room tour"; X labeled "Close room tour"; one Front side / Back side switch; hint "Drag to look around"; "Loading front side..."; "Couldn't load the front side", "Check your connection and try again.", button "Try again".

## Viewer geometry (T6)
At 891dp viewport height, the strip is 460dp tall (about 52% of the height), starting 160dp from the top, full width, panned horizontally only. The position bar (140dp wide) sits above the switch. Use a height fraction near 0.52 as the starting value, then tune on device.

## Items that need a decision (read before building)
- **Leave-confirmation.** The note on the canvas says "leaving mid-upload asks to confirm". We decided NOT to build that in v1 (the exit-guard area is fragile). The frontend prompt overrides the canvas note.
- **One-side viewer.** Not drawn. Rule: no switch; a small label with the side's name where the switch would be.
- **Wrong-type error message** is not designed (see above).
