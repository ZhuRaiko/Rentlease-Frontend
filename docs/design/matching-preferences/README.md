# RentLease Matching preferences redesign pack (20 Nov 2026)
Source: claude.ai Design canvas "RentLease – Matching preferences".
- screens/*.dc.html : design source for each state (inline styles, plain markup).
- png/*.png         : the same states rendered at 411 x 891 (2x). Use these as the visual target.

| File | Canvas board | State |
|---|---|---|
| MatchingPrefsOverview | 1 · First open | About you open; Property, Budget, What matters most as closed cards; nearby-essentials switch; pinned Save |
| MatchingPrefsProperty | 2 · Property open | Property open; About you folded to one line with "Change" |
| MatchingPrefsPriorities | 3 · What matters most | One ranking card with three tabs: Factors, Unit specs, Amenities |
| MatchingPrefsBudgetError | 4 · Budget: backwards range | Two radio cards; From above To shows an error and disables Save |
| MatchingPrefsDiscard | 5 · Close with unsaved changes | Bottom sheet over the page |

## Reading the boards
- Each board is one 411 x 891 viewport. The real screen scrolls: on Overview, the Property, Budget and What matters most cards and the "Prioritize nearby essentials" switch continue below the visible area. The pinned Save sits above the bottom navigation and must not cover the last card.
- The switch row "Prioritize nearby essentials" exists on every state. It is only drawn on Overview.
- The Priorities board draws the Factors tab. The Unit specs tab (Bedrooms, Bathrooms, Land Area, Kitchen, Floors) and the Amenities tab (Wi-fi, Parking Space, Airconditioning, Pet friendly) use the same row pattern. The small grey sentence at the bottom of that card describing them is a design note, not UI text.
- On the Discard board, the grey blocks behind the sheet are placeholders for the page.
- The grey "Existing bottom navigation · unchanged" strip is a placeholder. Do not build it.
- Hex colors are a visual reference only. The app must use its theme tokens. Keep the visual distinction between single choice (filled pill) and multi-select (outlined pill with a check).

## Designer's notes from the canvas
Frontend only, same data as today. Nothing removed.
- About you (renter type, stay, city) is open first. When another section opens it folds to one line with "Change".
- Property, Budget, What matters most: closed cards with a live one-line summary. One open at a time.
- Ranking: one card, three tabs. Each row: number, drag handle, Up, Down. First Up and last Down are disabled.
- Budget: two radio cards; peso fields only for "I will enter my own". Backwards range: both fields red, message, Save disabled with a hint.
- Close with changes asks first. No changes: closes right away.
- Check at 411dp/100% and 320dp/150%: chips wrap, nothing cut off.
