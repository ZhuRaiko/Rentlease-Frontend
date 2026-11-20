# RentLease Discover and For You redesign pack (20 Nov 2026)
Source: claude.ai Design canvas "RentLease – Discover and For You".
- screens/*.dc.html : design source for each board (inline styles, plain markup).
- png/*.png         : the same boards rendered at 411 x 891 (2x). Use these as the visual target.

| File | Canvas board | What it shows |
|---|---|---|
| DiscoverHome | 1 · Discover | Header and tabs, search, "Use my location", "Recently published", the new listing card |
| ForYouRanked | 2 · For You | "Edit preferences" pill, one info box, ranked card with "Top match" and "Why it fits" chips |
| ForYouEmpty | 3 · For You, nothing matches | Empty state. This is a guess by the designer: build the states that really exist in the code |
| ListingCardStates | 4 · Listing card states | Long title, no photo, saved, and the five property type labels |
| HeartIcon | 5 · Heart icon | One heart shape: outline (not saved), filled green (saved), header size, card size |

## Reading the boards
- Each board is one 411 x 891 viewport. The real screens scroll; only the first card is drawn.
- The grey "Existing bottom navigation · unchanged" strip is a placeholder. Do not build it.
- The "JD" circle in the header is a placeholder. Keep the app's existing profile avatar (photo or initials).
- Photos are drawn as simple placeholders. Use the real listing photo, or the "No photo" block shown on board 4.
- Hex colors are a visual reference only. The app must use its theme tokens.
- "Top match", "#2", "#3" are rank labels from the list order. The designer says to cut them if unwanted.
- "Why it fits" chips: only reasons that apply to that listing are shown.
- The whole card opens the details, as well as the "View rental details" button.

## Designer's notes from the canvas
Frontend only, same data as today.
- Header and tabs unchanged except the heart shape.
- One listing card everywhere (Discover, For You, Saved, nearby): type tag in normal capitals, 48dp heart, price, title, pin plus barangay and city, bedroom and bathroom chips ("1 bedroom", "2 bedrooms"), one "View rental details" button.
- For You: no "View ranked rentals" button. The ranked list shows straight away. The notices are one quiet info box with the same words; the number is the real count.
- Heart: one inline SVG path. react-native-svg may already be in the app; if not, it is a new dependency and needs approval first.
