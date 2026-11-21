# Review word cloud (Themes tab) — design pack

Source: Claude Design canvas "RentLease – Review word cloud"
(https://claude.ai/artifact/CMjZxGVLjUiqr2tcvB98dN), exported 2026-11-21.
Boards are 411 x 891. Each starts at "Ratings and reviews"; the photo, title, owner card and bottom nav are the existing app and are unchanged.

| Board | File | PNG |
|---|---|---|
| 1 Themes, ready | screens/Main.dc.html | png/1-themes-ready.png |
| 2 A word is selected | screens/Selected.dc.html | png/2-word-selected.png |
| 3 Loading | screens/Loading.dc.html | png/3-loading.png |
| 4 Not enough shared words yet | screens/NotEnough.dc.html | png/4-not-enough-shared-words.png |
| 5 Could not load | screens/Error.dc.html | png/5-could-not-load.png |

## Must keep
- Two tabs only: Themes and Reviews. No third tab.
- On Themes the card of words tenants wrote comes FIRST: tappable pills, each with a count; size follows how many reviews use the word.
- Tapping a pill selects it (dark fill + check icon, other pills fade), and a card under the cloud shows "N of M reviews mention "word"", a Clear button, the matching reviews with the word highlighted, and "Show N more". Tapping the pill again, another pill, or Clear changes/clears.
- Under it, a smaller secondary card "Tags tenants picked": chips with the number of reviews that chose each tag. Tags always visible in every state.
- States: ready, selected, loading (spinner, "up to a minute", skeleton pills), not enough shared words (note card), could not load (message + Try again).
- Fewer than 2 reviews on the property: no tabs, as before.

## Behavior notes (from the service handoff)
- Words come from the review-wordcloud edge function: terms[] {text, review_count, color, font_size_rem, matches[{id, spans[{start,end}]}]}. Spans are end-exclusive Unicode code point offsets, NOT UTF-16: convert before slicing (test with emoji, accents, combining marks).
- font_size_rem (about 1.0 to 2.3) maps to 4 fixed size steps so nothing overflows at large text. Each pill touch area is 48 dp.
- The service's 5 colours (blue, green, orange, purple, pink) carry no meaning: use soft tints from theme tokens, no red or amber.
- Loading can last about a minute (cold start); retry a 429 once automatically, then show Try again.
- Highlight exactly the spans the service sends; a phrase like "room clean" can highlight "Room was very clean".
