# Content-based property recommendations

## Status - November 8, 2026

IMPLEMENTED / AUTOMATED-TESTED on fix/gps-nearby-results, uncommitted after checkpoint 46ad505dbb2c15cd2cb87c29cc626e00b889bce5. Deterministic content matching, not a trained machine-learning model. Independent of XGBoost, Render, and the prepared ML Edge Function, which remain untouched. Android acceptance pending. No migration, persisted recommendation records, production mutation, deployment, commit, push or build.

The property-recommendations feature directory was empty. Existing Recommended/Best Match labels were prototype vocabulary, not working live sorts. Legacy DiscoveryProperty matchScore/fixture contracts remain outside the real SearchListing flow. Matching Preferences has form defaults, but defaults do not become recommendation inputs until the user explicitly saves them. For You remains the community surface.

## Scoring specification

Central immutable configuration in `src/features/property-recommendations/models/ContentRecommendation.ts`:

`score = 0.80 * preferenceRelevance + 0.10 * verifiedOwner + 0.10 * storedCompleteness`

These are experimental design weights, not scientifically optimized weights. Each component is 0-1. Missing completeness is preserved as null and contributes no bonus; unknown verification earns no bonus. Weights are not redistributed to conceal missing quality information. No numeric match percentage, prediction confidence or model accuracy label is displayed.

Preference relevance is a weighted average of the active groups below. A group's weight is its saved factorRanking array length minus its zero-based position; a missing ranking entry has weight 1. Groups without an actual preference are excluded from the denominator. Missing property attributes score 0 for an active criterion, never an automatic match.

| Group | Exact rule |
| --- | --- |
| Location | Saved preferred city equals stored city after case/diacritic/punctuation normalization: 1; otherwise 0. No GPS or private coordinates used. |
| Budget | For a valid saved nonnegative min and positive max with min <= max: in-range rent scores 1. Outside, score is max(0, 1 - distance_to_nearest_range_edge / maxRent). Missing/invalid rent scores 0. Invalid preference ranges are not scored. |
| Unit specifications | Weighted average of selected property-type membership, requested minimum bedrooms, requested minimum bathrooms, and furnishedOnly when enabled. Each is an exact 1/0 comparison. Bedroom/bathroom weights use their saved unitSpecificationRanking priority; type/furnishing weights are 1. False furnishedOnly means no furnishing preference, not a preference for unfurnished. |
| Amenities | Weighted fraction of actually selected amenity names present in the property's authorized catalog links. Saved amenityRanking sets priority as above. Case/diacritics/punctuation normalize (Wi-fi and Wi Fi match); semantic aliases are not invented. Unknown amenity data scores 0; verified empty links are empty. |

Land Area is deliberately not matched against floor area. RentLease has no corresponding lot-area input for this preference. Kitchen/floor preference rankings have no selected thresholds; nearby-place priority, demographic renter profile and coarse stay-length preferences are also not scored. No Overpass calls or inferred demographic housing needs. Current UI explains the scored categories and land/nearby-place exclusion.

Tier 2 boost requires an authoritative approved result for the exact actual owner, active status, and unexpired approval (when an expiry exists). Pending/rejected/revoked/expired/unknown/inactive/non-authoritative or wrong-owner results earn 0; they do not exclude eligible listings. **The current public contract provides no such Tier 2 signal. Production candidates therefore carry unknown verification and receive no Tier 2 boost.** This does not label owners unverified. Tests cover the boost logic for a future authorized signal; they are not evidence of deployed public verification access.

Stored listings.completeness_score is already normalized: live database CHECK constrains it to 0-1 and the existing trusted calculation caps at 1. The app reads that value directly, never divides by 100 or recalculates completion. Invalid/out-of-scale/missing values remain unknown and earn no bonus.

Recommended sorts by the 80/10/10 blend, then relevance, publication timestamp and listing ID. Best Match sorts by preference relevance alone, then publication timestamp and ID. Exact-zero/no-scorable-preference candidates are omitted; quality alone cannot recommend an irrelevant property. Quality bonuses total at most .20, so they cannot overcome a preference-relevance advantage greater than .25. Unverified/unknown owners otherwise remain eligible. Duplicate listing IDs and the signed-in user's own properties are removed.

## Live data, visibility and bounded ranking

`recommendationService.ts` reuses the existing authorized manualSearchService.search with the exact submitted city/barangay query and SearchFilters, publishedOnly=true, recent ordering, and 20-row pages. At most 100 recent filtered results are scanned. Their real photos come from the existing batched photo loader. At most two 50-ID enrichment queries read only listing IDs/ownership/publication/completeness and authorized property amenity names. No N+1 detail calls, profile/legal-name queries, verification submissions, documents or coordinates.

Enrichment rechecks active/published/available listing status, active property, matching physical-property/listing IDs and both owner IDs. Missing/inaccessible/stale relationships are excluded. Existing Supabase RLS and Auth remain authoritative. Account identity is checked before/after reads. Completeness/amenity read failure is an error, not an empty market or a fabricated score. More than 100 amenity links/malformed joins are unknown rather than a false complete amenity list.

A full final candidate page sets limited=true; the UI explicitly says ranking covers the first 100 recent filtered listings, not the whole market. Short pages disclose the actual loaded count. This is an offset-based read snapshot, not transactionally consistent global ranking; pull to refresh to see remote changes. Recommendations are capped, not presented as exhaustive global results. Recent/price sorts retain normal server pagination independently.

## Discover, navigation and preferences

Discover contains a compact Recommended for You strip with up to three existing real SearchListingCards, reasons, Matching Preferences action, and View ranked rentals. Recommended IDs are omitted from the same page's Recently published list to avoid duplicate cards. Matching Preferences absent -> clear setup prompt; unsupported-only values -> unavailable; loading, genuine no-match, sanitized error and explicit retry states are distinct. For You is unchanged.

Search Sort now exposes Recommended and Best Match only when saved preferences exist. Both use the bounded filtered pool; they are never passed as unsupported server sort strings. Current server search filters remain authoritative. Ordinary search/filter changes restore normal search ordering; users may select a preference sort again. Both ranked and ordinary cards use the same real details/photos/OSM/inquiry flow. Existing GPS/map/radius, bottom navigation and Post are preserved.

Preference values remain session-only, in existing root account-scoped state. Unsaved draft changes do not affect recommendations. Saved changes rerank an already-loaded pool without fetching it again; hard query/filter changes cancel and replace the pool. Changing accounts creates a new workflow and masks old preferences immediately. Disposal cancels pending transport/generations; late results cannot publish. No persistent preference or recommendation storage was added.

Architecture: the recommendations feature owns pure models/scoring and its data service. Search/Discovery owns recommendationWorkflow and UI integration; no feature View or ViewModel imports another feature's View/ViewModel. Views contain no clients. No new dependencies.

## Validation and remaining acceptance

161 focused tests pass, covering scoring/weights, budget/type/missing data, authoritative/unknown/revoked Tier 2 signals, stored completeness, deterministic ranking/deduplication, visibility and ownership denial, bounded paging/batched reads, preference edits, account changes, cancellation/retry, real-card navigation, sort dispatch and Search/GPS/Map/Overpass regressions. TypeScript and whitespace pass. Unit tests do not prove hosted authorization or complete market coverage.

Physical Android: save/edit preferences; inspect real recommendations and detail/Back; compare both ranking sorts under hard filters; refresh and test genuine empty/error states; switch accounts; exercise GPS/map and For You. Small datasets may produce identical ranking orders. Public Tier 2 boost requires a separately authorized safe status contract; no migration was prepared or deployed in this task.

History: [implementation](../implementation-reports/phases/PROPERTY_RECOMMENDATIONS_IMPLEMENTATION.md). Read-only backend evidence: [ledger](../implementation-reports/database/PROPERTY_RECOMMENDATIONS_BACKEND_LEDGER.md).
