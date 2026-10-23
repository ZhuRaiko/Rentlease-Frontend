# Phase 1 screenshot index

Collected 2026-10-23 (Asia/Singapore), branch `feature/ui-improvements`. Build source: committed baseline `0c80a48` plus the existing uncommitted condensed Profile bloom refinement. This collection changes no app source, styling, data, roles or functionality. The latest Profile gradient is included rather than the earlier linear-strip versions.

## Capture settings and evidence

All linked screen PNGs below are **actual Android runtime captures** from the existing development build on emulator-5554, full-frame 1080 x 2400, density 420dpi, font scale 1.0. No generated mockups, concept screens, stitching, screenshot retouching or cropping. Original full-resolution PNGs are retained. Scroll positions overlap where useful; sticky headers/navigation repeat naturally across separate captures.

Expo's Tools button was hidden using the development menu's own toggle so it does not cover the product. No code/configuration change was made. Display settings remain unchanged. Keyboards and notification panels are closed in the collection. Capture clock reflects the emulator's clock; this index uses the client timezone/date.

Discovery/property data includes the app's existing preview fixtures and preview map/assets. These are real captures of the running UI, not proof of live recommendation, listing or map integrations. Low-resolution source imagery is preserved. The ordinary session is dual Tenant/Landlord, with verified Account/Identity and per-property Tier 3 applicability. No credentials, private documents, access tokens or account contact fields are included.

[Open the contact sheet](phase1-final-screenshots/CONTACT_SHEET.png) for a labelled thumbnail overview; it is derived from the originals, keeps their proportions and does not replace them.

## 1. Discovery / For You

| Screen | Screenshot | Demonstrates | Actual Android evidence | Limitations |
| --- | --- | --- | --- | --- |
| Discovery landing / For You | [discovery-for-you-top.png](phase1-final-screenshots/01-discovery/discovery-for-you-top.png) | Wordmark, active For You tab, first complete feed card, price/location/match/rating, photo-first layout and navigation. | Yes, new capture | Existing preview feed; this is also the current landing screen. |
| Additional feed content | [discovery-for-you-scrolled.png](phase1-final-screenshots/01-discovery/discovery-for-you-scrolled.png) | Overlapping first-card metrics and complete second feed card. | Yes, new capture | Preview photo is low-resolution in the source asset. |
| Discover / Search Location | [discovery-search-location.png](phase1-final-screenshots/01-discovery/discovery-search-location.png) | Existing city search, popular locations and location-permission preview. | Yes, new capture | Discover opens this search flow; no GPS permission requested. |
| Search results | [discovery-search-results.png](phase1-final-screenshots/01-discovery/discovery-search-results.png) | Imus result count, list/map/filter/sort controls and full first result card. | Yes, new capture | Existing preview search data; selecting a city changed only local search presentation. |
| Filters, top | [discovery-filters-top.png](phase1-final-screenshots/01-discovery/discovery-filters-top.png) | Preferred city, rent range, property types and room controls. | Yes, new capture | Existing draft values were not edited or applied. |
| Filters, lower sections | [discovery-filters-bottom.png](phase1-final-screenshots/01-discovery/discovery-filters-bottom.png) | Room/land-area controls, furnishing, amenities and existing apply action. | Yes, new capture | Action shown but not invoked. |

## 2. Property Details

| Screen | Screenshot | Demonstrates | Actual Android evidence | Limitations |
| --- | --- | --- | --- | --- |
| Property details, top | [property-details-top.png](phase1-final-screenshots/02-property-details/property-details-top.png) | Hero image and controls, rent, title, rating, location, specifications and description. | Yes, new capture | Existing City-view Apartment preview fixture; source imagery is low-resolution. |
| Property details, middle | [property-details-middle.png](phase1-final-screenshots/02-property-details/property-details-middle.png) | Specifications, description, landlord identity and recommendation/match panel. | Yes, new capture | Preview data, not a live listing integration claim. |
| Property details, explore/location | [property-details-explore-location.png](phase1-final-screenshots/02-property-details/property-details-explore-location.png) | Match panel, amenities/nearby/map entries and location preview. | Yes, new capture | The existing map is a preview asset; precise map accuracy is not established. |
| Property details, bottom | [property-details-bottom.png](phase1-final-screenshots/02-property-details/property-details-bottom.png) | Map preview and implemented Message landlord, fair-rental-price and Save actions. | Yes, new capture | Actions were not invoked; no message/save write. |
| Property amenities | [property-details-amenities.png](phase1-final-screenshots/02-property-details/property-details-amenities.png) | Existing Wi-fi/Pet friendly detail and presentation-only disclosure. | Yes, new capture | Included as a relevant existing property section, not Phase 2 redesign evidence. |

## 3. Profile

| Screen | Screenshot | Demonstrates | Actual Android evidence | Limitations |
| --- | --- | --- | --- | --- |
| Profile, top | [profile-top.png](phase1-final-screenshots/03-profile/profile-top.png) | Header, initials/name/roles/bio, Edit entry and all three latest compact tier blooms. | Yes, new capture | Existing dual-role account; public identity presentation only, no contact/credential fields. |
| Profile, summary and settings | [profile-verification-summary.png](phase1-final-screenshots/03-profile/profile-verification-summary.png) | Latest condensed emerald/teal/amber blooms, heavy tabular numbers, exact statuses, scope, Preferences and Account & Safety. | Yes, new capture | All lower settings visible; no extra nearly-identical bottom screenshot needed. |

## 4. Verification

| Screen | Screenshot | Demonstrates | Actual Android evidence | Limitations |
| --- | --- | --- | --- | --- |
| Verification overview, top | [verification-overview-top.png](phase1-final-screenshots/04-verification/verification-overview-top.png) | Heading plus Account/Identity/Property category cards and existing Tier 1/2 statuses. | Yes, new capture | Final loaded state; Tier 3 action continues slightly below viewport. |
| Verification overview, bottom | [verification-overview-bottom.png](phase1-final-screenshots/04-verification/verification-overview-bottom.png) | All three distinctive gradient cards including complete Tier 3 action. | Yes, new capture | Slight overlap with top capture; Tier 1 status is documented here, no standalone Tier 1 result exists in this flow. |
| Tier 2 approved result | [verification-tier2-approved.png](phase1-final-screenshots/04-verification/verification-tier2-approved.png) | Actual approved status, submitted/reviewed PHT dates, Back/Close and return action. | Yes, new capture | Current record has no review note; no private ID/document opened. |
| Tier 3 entry | [verification-tier3-entry.png](phase1-final-screenshots/04-verification/verification-tier3-entry.png) | Existing ownership/authority wording, role distinction and Choose property action. | Yes, new capture | Entry screen, not a fabricated property verification status. |
| Tier 3 availability | [verification-tier3-no-properties.png](phase1-final-screenshots/04-verification/verification-tier3-no-properties.png) | Actual empty owned-property selector explaining the prerequisite. | Yes, new capture | No owned property is available, so property-specific Tier 3 result is unavailable; no record created. |

## 5. Admin Dashboard

User supplied the Admin session. These are new captures of the same current build; no historical screenshot was substituted. The dashboard pending count is live submission metadata; reports, restrictions, decisions and activity remain explicitly labelled previews.

| Screen | Screenshot | Demonstrates | Actual Android evidence | Limitations |
| --- | --- | --- | --- | --- |
| Admin dashboard, top | [admin-dashboard-top.png](phase1-final-screenshots/05-admin-dashboard/admin-dashboard-top.png) | Header, integration disclosure, overview, all four statistics, verification/reports queue summaries and bottom navigation. | Yes, new capture | One actual pending verification; other statistic values are previews. |
| Admin dashboard, bottom | [admin-dashboard-activity.png](phase1-final-screenshots/05-admin-dashboard/admin-dashboard-activity.png) | Queue summaries, complete recent preview activity and persistent navigation. | Yes, new capture | Natural scroll overlap; preview names/case references are existing sample content. |
| Admin queue overview | [admin-queue-overview.png](phase1-final-screenshots/05-admin-dashboard/admin-queue-overview.png) | Verification and report queue counts, existing entry actions, handling guidance and selected Queues tab. | Yes, new capture | Summary only; individual submissions, private documents and review decisions were not opened. |

Admin session retained on the dashboard; display settings remain unchanged.

## Coverage limits and safety

- Tier 1 status is visible in the overview; no standalone Tier 1 status destination is exposed here.
- Tier 3 entry and actual empty availability are captured. Property-specific approved/pending/rejected results are unavailable in this ordinary account without creating/changing data.
- Other verification states were not forced, mocked or seeded. No submission, review decision, account edit, preference save, message or saved-listing action was performed.
- Profile Account Settings entry is documented; the Edit/Profile Settings forms were not opened because they expose contact/account details and are outside the requested representative layout.
- Amenities is an existing detail subsection. Supplementary Phase 2 flows are not presented as newly implemented or redesigned.
- This is screenshot evidence for visual review, not user acceptance, all-state accessibility testing or security validation.

## Validation

Every screen PNG was opened and visually inspected for intended content, final styling, tool/keyboard obstruction and sensitive information. PNG decoding and 1080 x 2400 dimensions verified. Contact-sheet previews preserve full-frame originals. Application tests/typecheck are not rerun for this documentation-only collection; no source changes are made. All 21 full-resolution screenshots decode correctly at 1080 x 2400; all 22 PNG links (including the contact sheet) resolve. Final staged/unstaged Git whitespace checks pass. Existing application/source changes from the preceding refinement are preserved; this collection adds only the index and screenshot artifacts. No commit or push.
