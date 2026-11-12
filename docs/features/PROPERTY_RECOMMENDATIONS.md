# Content-based property recommendations

Current backend status (November 10, 2026): Phase 2C deployed as 20261110053904, Tier 2 RPC deployed as 20261110053950, rental-price-estimate ACTIVE v5 with JWT verification enabled. Earlier prepared/undeployed statements below are historical. No owner was automatically opted in. Frontend release and authenticated end-to-end/manual acceptance remain pending; catalog/source and limited no-identity denial checks passed. See the latest backend ledger for exact receipts and deployment scope.


Checkpoint: `6d716d13c2c93537b331e29a2e91d87ddd0b4f8d`, pushed and remote SHA verified November 8. The implementation status below records the pre-checkpoint phase. A subsequent [read-only Tier 2 contract audit](../implementation-reports/audits/PROPERTY_RECOMMENDATIONS_TIER2_CONTRACT_AUDIT_2026-11-08.md) confirmed a new narrow public read contract was needed. It is now prepared and locally validated as described below; production remains unchanged until separately authorized deployment.

## Status - November 8, 2026

IMPLEMENTED / AUTOMATED-TESTED on fix/gps-nearby-results. Initial implementation is checkpointed as 6d716d13c2c93537b331e29a2e91d87ddd0b4f8d; the Tier 2 integration below is uncommitted. Deterministic content matching, not a trained machine-learning model. Independent of XGBoost, Render, and the prepared ML Edge Function, which remain untouched. Android acceptance pending. No persisted recommendation records or production mutation. The new Tier 2 migration is prepared only; no deployment, commit, push or build occurred in this follow-up.

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

Tier 2 boost requires an authoritative approved result for the exact actual owner, active status, and unexpired approval (when an expiry exists). Pending/rejected/revoked/expired/unknown/inactive/non-authoritative or wrong-owner results earn 0; they do not exclude eligible listings. **The new RPC is prepared only. Until it is deployed, failed/missing status reads remain unknown and receive no Tier 2 boost.** This never labels owners unverified. Only an exact, unique listing/owner-bound true response supplies the existing approved scoring input; false/null/omitted/malformed/error results stay neutral. There is no backend Tier 2 expiry field; the adapter invents no expiration date.

Stored listings.completeness_score is already normalized: live database CHECK constrains it to 0-1 and the existing trusted calculation caps at 1. The app reads that value directly, never divides by 100 or recalculates completion. Invalid/out-of-scale/missing values remain unknown and earn no bonus.

Recommended sorts by the 80/10/10 blend, then relevance, publication timestamp and listing ID. Best Match sorts by preference relevance alone, then publication timestamp and ID. Exact-zero/no-scorable-preference candidates are omitted; quality alone cannot recommend an irrelevant property. Quality bonuses total at most .20, so they cannot overcome a preference-relevance advantage greater than .25. Unverified/unknown owners otherwise remain eligible. Duplicate listing IDs and the signed-in user's own properties are removed.

## Live data, visibility and bounded ranking

`recommendationService.ts` reuses the existing authorized manualSearchService.search with the exact submitted city/barangay query and SearchFilters, publishedOnly=true, recent ordering, and 20-row pages. At most 100 recent filtered results are scanned. Their real photos come from the existing batched photo loader. At most two 50-ID enrichment queries read only listing IDs/ownership/publication/completeness and authorized property amenity names. No N+1 detail calls or direct frontend profile/legal-name/submission/document/coordinate queries. Up to two additional 50-ID RPC reads supply only the listing-bound Tier 2 signal; no persistent status cache or automatic retry is added.

Enrichment rechecks active/published/available listing status, active property, matching physical-property/listing IDs and both owner IDs. Missing/inaccessible/stale relationships are excluded. Existing Supabase RLS and Auth remain authoritative. Account identity is checked before/after reads. Completeness/amenity read failure is an error, not an empty market or a fabricated score. More than 100 amenity links/malformed joins are unknown rather than a false complete amenity list.

A full final candidate page sets limited=true; the UI explicitly says ranking covers the first 100 recent filtered listings, not the whole market. Short pages disclose the actual loaded count. This is an offset-based read snapshot, not transactionally consistent global ranking; pull to refresh to see remote changes. Recommendations are capped, not presented as exhaustive global results. Recent/price sorts retain normal server pagination independently.

## Discover, navigation and preferences

Discover contains a compact Recommended for You strip with up to three existing real SearchListingCards, reasons, Matching Preferences action, and View ranked rentals. Recommended IDs are omitted from the same page's Recently published list to avoid duplicate cards. Matching Preferences absent -> clear setup prompt; unsupported-only values -> unavailable; loading, genuine no-match, sanitized error and explicit retry states are distinct. For You is unchanged.

Search Sort now exposes Recommended and Best Match only when saved preferences exist. Both use the bounded filtered pool; they are never passed as unsupported server sort strings. Current server search filters remain authoritative. Ordinary search/filter changes restore normal search ordering; users may select a preference sort again. Both ranked and ordinary cards use the same real details/photos/OSM/inquiry flow. Existing GPS/map/radius, bottom navigation and Post are preserved.

Preference values remain session-only, in existing root account-scoped state. Unsaved draft changes do not affect recommendations. Saved changes rerank an already-loaded pool without fetching it again; hard query/filter changes cancel and replace the pool. Changing accounts creates a new workflow and masks old preferences immediately. Disposal cancels pending transport/generations; late results cannot publish. No persistent preference or recommendation storage was added.

Architecture: the recommendations feature owns pure models/scoring and its data service. Search/Discovery owns recommendationWorkflow and UI integration; no feature View or ViewModel imports another feature's View/ViewModel. Views contain no clients. No new dependencies.

## Validation and remaining acceptance

175 focused tests pass, covering scoring/weights, budget/type/missing data, authoritative/unknown/revoked Tier 2 signals, stored completeness, deterministic ranking/deduplication, visibility and ownership denial, bounded paging/batched reads, preference edits, account changes, cancellation/retry, real-card navigation, sort dispatch and Search/GPS/Map/Overpass regressions. TypeScript and whitespace pass. Unit tests do not prove hosted authorization or complete market coverage.

Physical Android: save/edit preferences; inspect real recommendations and detail/Back; compare both ranking sorts under hard filters; refresh and test genuine empty/error states; switch accounts; exercise GPS/map and For You. Small datasets may produce identical ranking orders. Hosted Tier 2 boost requires separate deployment authorization and privacy-notice review. No migration was deployed.

History: [implementation](../implementation-reports/phases/PROPERTY_RECOMMENDATIONS_IMPLEMENTATION.md). Read-only backend evidence: [ledger](../implementation-reports/database/PROPERTY_RECOMMENDATIONS_BACKEND_LEDGER.md).

## Prepared Tier 2 read contract - November 8, 2026

Migration: `supabase/migrations/20261108041628_recommendation_owner_tier2_status.sql`. RPC: `public.get_recommendation_owner_verification(p_listing_ids uuid[])` -> rows of listing_id, listing_owner_id, owner_tier2_verified (nullable boolean). Rollback: `supabase/test-support/recommendation_owner_tier2_status_rollback.sql`.

Active Tier 1 callers only, with 1-50 supplied nonnull UUIDs checked before deduplication. Public discovery eligibility and matching actual property/listing ownership are explicit; owner/Admin/tenancy access cannot expose private listing status. Omitted IDs reveal no inaccessible/nonexistent distinction. A stable definer with empty search_path and authenticated-only EXECUTE reads current approved Tier 2 evidence and the protected refreshed timestamp; it does not grant verification-table access or change existing policies. Invalid provenance/cache is unknown, and Tier 3 never substitutes. Historical approval is not invalidated when a reviewer later loses Admin membership. Source/policy/trigger/index guards stop unexpected drift.

Local synthetic PostgreSQL: 79 passed / 0 failed, including rollback/reapplication, record preservation and unchanged existing function/grant/RLS snapshots. Frontend: 175 focused checks, TypeScript, whitespace and credential/artifact scan pass. Hosted RPC/Android acceptance remains pending; local fixtures are not hosted RLS acceptance.

**Deployment blocked pending privacy review:** reviewed product/authentication/verification sources describe private document handling and consented public identity, but do not supply an explicit privacy notice covering an owner Tier 2 boolean used for ranking. Confirm the notice/lawful disclosure basis and intended visibility before deployment. No new badge/profile disclosure is implemented. Backend-first deployment also requires fresh source-drift review, backup and separate authorization. Without the RPC, eligible recommendations continue with a neutral verification component.

The [predeployment disclosure review and proposed wording](../implementation-reports/audits/PROPERTY_RECOMMENDATIONS_TIER2_PRIVACY_REVIEW_2026-11-08.md) distinguish internal ranking from disclosure through the authenticated RPC. Existing Trusted-badge wording and public-name/photo acknowledgement do not establish coverage for this use. The draft is for research-team/adviser/ethics review only; no approved notice or study consent was rewritten. Technical checkpoint review found no material defect; privacy approval remains unresolved.


## Compact Discover preferences and matches - November 8, 2026

Frontend redesign: Search / Nearby rentals / Matching Preferences / Matches for you / Recently published. Unsaved quick controls start with no city, no budget, and no type selected; nothing ranks until explicit Save and show matches. Blank budget remains unscored, not a fabricated default. Shared quick-preference builder validates budget and available choices. It preserves existing advanced saved preferences and ranking priorities; new quick-only saves neutralize unsaved room/amenity/furnishing defaults. Full More preferences editor remains accessible. Saved state uses compact city/budget/type summary chips, More preferences saved indicator and Edit. Saves go through existing ViewModel commit/session callback and recommendation workflow; no preference persistence contract added.

Homepage preview now contains at most two vertical real-listing rows, 64x76dp photos, title, asking rent, stored location/specifications and first match reason. Header has one See all matches action opening existing Recommended results. No horizontal carousel or clipped fixed-width card. Recently published omits only the two displayed recommendation IDs. No ranking weights, verification logic, filters, server sort, service queries, RLS or backend contracts changed. Optional info disclosure retains bounded-pool and unknown-verification qualification; no fabricated boost/score. For You remains community.

184 focused tests pass: no-preference/quick-save validation, saved advanced-field preservation, editing/reranking, account switching, at-most-two preview, real navigation, empty/error/loading plus recommendation/Search/GPS regressions. TypeScript and whitespace pass. Existing render harnesses were updated to supply React state/new setup component; old carousel assertions now verify intentional compact rows and hidden qualifications.

Agent-observed Android emulator-5554, Android 17/API37, 360dp width: no-preferences quick controls, explicit session-only Imus/Apartment save, real match loading and compact rows; row tap opens real Rental details and Back returns home. Visual iteration fixed low-contrast budget placeholders, reduced type wrapping and tightened match typography. Before/after PNGs outside Git: local Temp/rentlease-discover-before.png, rentlease-discover-after-setup.png, rentlease-discover-after-matches.png. Before screenshot used a temporary committed-homepage preview, restored immediately; unrelated edits retained. Density temporarily 480 then restored to 420; diagnostic UI-tree removed. Existing authenticated session used, no credentials requested, no production record mutation. Existing listing/recommendation reads occur through unchanged authorized services. Physical Android, larger-font layout and two-account manual acceptance remain pending; account switching/empty/error behavior has automated evidence only.

No deployment, backend-service/schema/model/ML proxy modification, commit, push or build. No permanent live backend mutation was performed in this phase. Skills applied/read in this session: feature implementation, MVVM, Supabase contract guard, security review, UI/UX, test/runtime verification, documentation maintainer, implementation ledger and artifact organizer.


## Original Discover carousel restored - November 9, 2026

Supersedes the November 8 quick-form/compact-row redesign at the user's direction. TenantDiscoveryView was compared with the committed original: restored horizontal swipeable ScrollView, original 280dp SearchListingCard wrappers, up to three real recommendations, full photography/prices/titles/specifications, match reasons and existing View ranked rentals action. Original tabs, search, Nearby rentals and regular Recently published feed remain. No thumbnail rows, grid, new homepage filter form, or summary-chip dashboard remains.

Precisely scoped refinements: compact Set matching preferences / Edit preferences text action opens the unchanged detailed editor; technical paragraphs are hidden behind a 44dp optional info disclosure (no modal/card); recommendation heading spacing tightened slightly. The ViewModel quick-save extension and two-result dedup change were removed, restoring the original save handler/session notice and three-preview dedup behavior. Removed only the two new untracked quick-form component/model files created by the rejected redesign. Unrelated source, migration reconciliation, Tier 2, ML and workspace edits were preserved. No broad reset or index changes.

183 focused tests passed, covering restored original cards/navigation and compact preference entry, no unsaved fabricated matches, saved editing/reranking, account switches, Search/GPS and error/empty behavior. TypeScript and whitespace pass. No scoring/weight/verification/service-query/RLS/backend-contract changes. No production writes, deployment, commit, push or Android binary build. No permanent live backend mutation was performed in this phase. Skills reused: RentLease feature implementation, MVVM, UI/UX, test/runtime verification, documentation maintainer and implementation ledger.


Android evidence (November 9): emulator-5554, Android 17/API37. The cached LAN Metro address initially showed yesterday's quick form; reconnected the installed client through adb reverse to localhost:8081 and explicitly reloaded. Observed restored no-preference entry opening the existing editor, then saved displayed choices for this session and observed real carousel photography, original 280dp cards and compact Edit preferences entry. Actual rendered screenshot: local Temp/rentlease-restored-carousel.png. Original no-preferences design screenshot from the earlier baseline: Temp/rentlease-discover-before.png. Compared baseline layout/source and restored native rendering; photos/card proportions remain original, with technical copy removed. Additional attempted temporary-original/reloaded comparison captures showed loading rather than a stable original UI and are NOT validation evidence. No claim of a fresh same-state pixel-perfect original/restored comparison; physical-device, larger-font and two-account manual acceptance remain pending.

An automatic approval review initially rejected the editor Save tap as a possible production mutation. Verified App.tsx state/callback and normal editor save path prove session-only state outside onboarding; the subsequent approved check permitted the same bounded action. No preference DB persistence was added or used. Existing authorized listing reads only; no records created or changed. Temporary source preview was restored in finally; current source and whitespace rechecked.


Final visual comparison completed: held the original View until its native bundle and real recommendations finished loading, explicitly saved the same displayed session preferences, then restored/reloaded the current View and repeated. Stable screenshots outside Git: Temp/rentlease-carousel-original.png and Temp/rentlease-carousel-restored.png; heading view: Temp/rentlease-carousel-restored-top.png. These replace the earlier inconclusive loading captures. Compared actual cards: same large photographs, 280dp wrappers, prices/titles/specifications and horizontal layout; restored version removes technical text and brings ranked-results/Recently published closer. Horizontal swipe changed visible card positions on the emulator. Density was not changed in this phase. Diagnostic UI-tree removed. Current source restored, no broad Git operation, backend mutation or publishing. Physical-device and large-font checks remain pending.


## Tenant audit cross-check ? November 10, 2026

Read-only live metadata confirms get_recommendation_owner_verification remains absent. Existing content-only ranking still works within the 100-recent-filtered pool with neutral unknown Tier 2 bonus; the prepared signal stays blocked by its unresolved privacy review. Session-only preferences and bounded ranking are intentional current limits, not global/server matching. Shared listing-search photo enrichment now degrades to real text cards on photo-only failure while preserving identity/cancellation; scoring/weights/enrichment policy are unchanged. Focused content recommendation tests passed within the tenant audit; no provider/device/hosted RLS acceptance, backend writes/deployment or commit/push. See [tenant audit](../implementation-reports/audits/TENANT_SEARCH_DISCOVERY_AUDIT_2026-11-10.md).


## Tier 2 backend readiness review - November 10, 2026

Reviewed the existing prepared migration and recommendation service without changing either. No narrowly scoped code correction was necessary: the bounded caller-authorized listing-owner projection, exact minimal response adapter, neutral missing/error behavior and existing 10% component remain intact. Generated RPC types do not establish deployment; absence is the prior recorded live observation, not a new live check. Next required decision is approval of the actual ranking/disclosure basis, notice version/placement and treatment of already-verified owners, as specified in the existing privacy review. Then separately authorize fresh source-drift/backup preflight, isolated migration deployment and hosted positive/negative acceptance. Do not read private submissions from the app, change live verification infrastructure or add approval expiry unsupported by storage. No tests repeated because executable code is unchanged.


## Approved Tier 2 disclosure implementation - November 10, 2026

The developer explicitly approved local implementation of the supplied Tier 2 ranking/disclosure policy, superseding the previous unresolved-policy gate for this scope. This records developer authorization, not independent legal/ethics certification. TenantDiscoveryView now shows a concise always-visible explanation of 80% preferences, 10% confirmed owner Tier 2 and 10% completeness, continued eligibility without verification, and no property ownership/safety guarantee. Existing optional matching information remains. No private evidence, new badge, scorer/adapter or verification workflow changes.

Prepared 20261108041628_recommendation_owner_tier2_status.sql is unchanged and NOT DEPLOYED. Missing/failed RPC remains neutral; actual host status was not rechecked here. Backend-first release still requires fresh source-drift/ACL checks, backup and separate deployment authorization, then hosted approved/revoked/unknown/denied acceptance. The existing privacy review is retained as historical decision context; developer-approved notice is now implemented locally. Scorer/adapter regressions passed in the 61-case focused run, TypeScript passed. No device/production action or commit/push.


## Narrow predeployment disclosure check - November 10, 2026

Existing always-visible Discover recommendation disclosure remains connected to the real interface and accurately describes the preserved 80/10/10 score and continued eligibility without verification. No Tier 2 source/migration/adapter/scorer changes in this review. Fresh metadata-only pg_proc lookup reconfirmed the prepared RPC remains absent. Five targeted coordinate/disclosure tests and TypeScript passed; the earlier full recommendation test evidence was not rerun. Separate Tier 2 deployment authorization and hosted acceptance remain required.


## Production preflight / backup completed - November 10, 2026

BACKUP VERIFIED; NO DEPLOYMENT AUTHORIZED. Fresh production baseline: 29 migrations through 20261109181552_unfinished_property_deletion; proposed coordinate and Tier 2 contracts absent. Relevant guard sources/policies/types/RLS/triggers compatible; named rental-price-estimate remains ACTIVE v4 with JWT verification. Restricted recovery backup C:/RentLease-Backups/phase2c-tier2-predeploy-20261110-050404 verified (28 artifacts, 114 function definitions, 18 COPY sections, deployed/proposed Edge sources and reread hashes/ACLs). Catalog unchanged across backup; profiles changed but dump eligibility matches current and other selected records stayed unchanged. Prior 28 history payloads unchanged, only known deletion additions versus older baseline. Recovery is selective, preserves existing Auth/Storage dependencies and has not been hosted-restore tested. No technical preflight blocker; immediate baseline/freeze and separate isolated schema/Edge/frontend authorization still required. Exact hashes, operations and limitations are recorded in this feature's backend ledger and protected receipt. No permanent live backend mutation was performed in this phase. No phone/ADB/Expo/build, tests, commit or push.


### T8-D1 surface update - November 11, 2026

Local frontend supersedes the earlier Discover-carousel/For You community presentation: For You now shows the same actual bounded recommendation feed with preference editing and contextual How it works. Discover shows its full recent feed separately. Existing 80/10/10 scorer, candidate retrieval, session preferences, authorization and Tier 2 handling are unchanged. No Community Posting, backend change or deployment. See the continuous Search Discovery history for focused validation and native acceptance limits.
