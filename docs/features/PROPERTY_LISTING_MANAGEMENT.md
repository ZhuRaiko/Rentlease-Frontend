# Property & Listing Management

## Purpose

Manage landlord-owned physical properties, ordinary property media, later listing drafts/publication/lifecycle, and their integration boundaries. A physical property is distinct from a marketplace listing. Creating a property does not create a listing, publish it or submit Tier 3 verification.

## Scope and actor ownership

Phases 1-5 were implemented on feature/property-listing-management. Exact-location/composer work was completed on feature/maptiler-property-location and is contained in baseline 7eb361b. The current local navigation refinement is on feature/search-discovery-backend-integration with existing uncommitted Search & Discovery work preserved. Active Tier 1 Landlords may use physical-property setup; Tier 3 is not a creation prerequisite. The ordinary-photo frontend exposes signed-in owner management only. Backend policies also recognize Admin management, but this feature adds no Admin interface. Authentication owns the account/session snapshot; this feature revalidates identity/ownership and owns its local form/media workflows.

Phases 1-5 are **IMPLEMENTED / AUTOMATED-TESTED**. The pre-map Phase 1 blocked-location Android path was **RUNTIME-VERIFIED** as user-reported; map rendering/style/pin/review is now user-reported **Android PARTIALLY RUNTIME-VERIFIED**; physical-property creation is now **Android RUNTIME-VERIFIED (user-reported 2026-10-31)**; ordinary-photo and listing-draft persistence remain **RUNTIME-UNVERIFIED**. The approved public-location rule and complete Phase 1 handoff are implemented/automated-tested; successful Android creation with a real UUID is user-reported; subsequent photo/draft workflow repairs below still require Android retesting. Phase 3 listing draft saves/loads are implemented behind the persisted-property prerequisite. Normal My Listings now uses the owned-property portfolio. Explicit sample publication/lifecycle paths remain PREVIEW and do not power the portfolio. Real saved drafts have explicit RPC publication and a separate backend-confirmed status screen with landlord pause/reactivate/archive controls.

## Architecture

```text
View
?
ViewModel
?
feature service/workflow
?
typed Supabase client / approved backend
```

`App.tsx` remains the root workspace/Modal composition. No navigation/state framework or duplicate client was added. Views render form/photo state and invoke ViewModel actions; no direct Supabase, Storage or MapTiler calls occur in Views. `usePropertyListingViewModel` composes the pure creation/photo workflows, owns feature navigation and retains existing Stay/Leave guards. Services own authenticated Supabase calls and device integration. Models define pure domain values, validation and mappings. The singleton is `SupabaseClient<Database>` and generated `database.types.ts` is the structural contract; business/security rules require backend evidence.

### Frontend source locations

All feature paths below are under `src/features/property-listing/`:

| Layer | Relevant source |
| --- | --- |
| Models | `models/LandlordPortfolio.ts`, `models/PropertyPhotoSelection.ts`, `models/DraftProperty.ts`, `models/PropertyPhoto.ts`, `models/PersistedListingDraft.ts`, preview `models/PropertyListing.ts`, `models/listingNavigation.ts` |
| ViewModel/workflows | `viewModels/landlordPortfolioWorkflow.ts`, `viewModels/usePropertyListingViewModel.ts`, `viewModels/propertyCreationWorkflow.ts`, `viewModels/propertyPhotoWorkflow.ts`, `viewModels/listingDraftWorkflow.ts` |
| Creation service/composition | `services/propertyCreationService.ts`, `services/propertyCreationDependencies.ts` |
| Listing draft service/composition | `services/listingDraftService.ts`, `services/listingDraftDependencies.ts` |
| Photo service/device composition | `services/propertyPhotoService.ts`, `services/propertyPhotoDependencies.ts` |
| Portfolio service/composition | `services/landlordPortfolioService.ts`, `services/landlordPortfolioDependencies.ts` |
| Views | `views/ListingComposerView.tsx`, `views/PropertySetupView.tsx`, `views/PropertyPhotosView.tsx`, `views/CreateListingView.tsx`, `views/PropertyListingFlowView.tsx`, `views/ListingManagementView.tsx`, `views/ListingPreviewView.tsx`, `views/PropertyDashboardView.tsx` |
| Presentation reuse | `components/ListingWizardScaffold.tsx`, `components/ListingControls.tsx`, `components/ListingButton.tsx` and shared theme/feedback/navigation confirmation |

Tests: `tests/propertyCreation.test.ts`, `tests/propertyPhotos.test.ts`, `tests/listingDraftPersistence.test.ts`, `tests/propertyExitGuard.test.ts`, `tests/marketplaceWiring.test.ts` plus existing navigation/verification regressions. Shared backend entry: `src/shared/services/supabase/client.ts`; structural types: `src/shared/services/supabase/database.types.ts`.

## Phase 1 - Physical Property Creation

**IMPLEMENTED / AUTOMATED-TESTED**. Blocked-location Android path: **RUNTIME-VERIFIED**. Successful physical-property persistence: **RUNTIME-UNVERIFIED**. The approved public-point policy and complete location handoff now make normal creation eligible when other fields are valid. MapTiler/MapLibre rendering and exact-pin review are user-reported partially runtime-verified; the new save path still needs Android acceptance.

Root Post opens the existing postingType chooser; selecting Property Listing opens ListingComposerView before any property UUID. Physical/address fields are on Property; listing terms are on Listing Details. Next changes pages without persisting. PropertySetupView details/address/review/created steps remain legacy/recovery presentation, not the default Post path. It collects physical type, structured city/barangay/address, private access instructions, bedrooms, bathrooms, optional floor area/floor number/total floors/max occupants and furnishing. Floor area is not automatically land area. Display labels are separate from backend identifiers:

| Domain | Backend values |
| --- | --- |
| property_type | apartment, boarding_house, bedspace, room, studio, condominium, house, dormitory, other |
| cavite_city | imus, dasmarinas, tagaytay |
| furnishing_status | unfurnished, semi_furnished, furnished |

Creation uses **`public.create_property_setup(...)` only**. Required generated arguments are `p_property_type`, `p_city`, `p_barangay`, `p_address_line_1`, `p_public_lat`, `p_public_lng`, `p_exact_lat`, `p_exact_lng`. Optional physical/text fields are explicitly mapped, blank optionals omitted and `p_amenity_ids` contains selected real active catalogue IDs (or `[]` when unset). The controlled catalogue is connected through the feature amenity service; no guessed IDs are sent. No direct INSERT into `properties`, `property_private_locations` or `property_amenities` is used. The RPC derives landlord identity and creates those records transactionally; validated JSON `{property_id: UUID, status: 'created'}` becomes ViewModel `propertyId`.

The backend requires authenticated/active/Landlord/Tier 1, **not Tier 3**. An external backend test confirmed creation by a Tier 1 landlord without Tier 3; that is not Android acceptance. Attribution, the remaining inactive test fixture and cleanup limits are in [ledger P1-01 through P1-03](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#p1-01-codex-physical-property-contract-inspection).

### Complete location confirmation and save eligibility

The service contract requires four distinct numbers: `exactLatitude`, `exactLongitude`, `publicLatitude`, `publicLongitude`. Incomplete local drafts retain null values. The dedicated location workflow supplies confirmed exact and approved generalized public points through `provideConfirmedLocation(location, expectedAddressRevision)`. Address edits clear all four values and increment `locationRevision`; stale confirmations are ignored.

The dedicated location workflow validates the explicit map-confirmed exact point and derives the public point using the approved deterministic 300-meter Web Mercator grid rule. The composed ViewModel rechecks the captured revision, calls provideConfirmedLocation and verifies all four accepted values. The exact input is preserved; the public point is a cell center, never a direct copy/fallback. No GPS or manual coordinate input is used. Save remains disabled only while location/other form requirements are incomplete; the old privacy-policy blocker is resolved. Previous user acceptance of the disabled-save path is historical evidence, not proof of the newly enabled Android save.


### UUID, uncertainty and navigation

Successful creation retains the real UUID for photo management/later listing work. The unchanged Tier 3 owned-property query can later find the property without cross-feature ViewModel coupling; no automatic Tier 3 submission occurs. My Listings loads all owned properties, including properties without listings, from the read-only portfolio service. Normal confirmed creation binds the UUID internally while staying on Listing Details; creation uncertainty stays inline with recovery actions and local state intact.

A synchronous guard, identity/generation checks and account-scoped AsyncStorage receipt journal protect against duplicate local attempts/stale results. Pending is recorded before the RPC; confirmed receipts retain only UUID/status, not address/coordinates/tokens. Restore rechecks ownership. Unknown network/result outcomes block blind retries across restart; users can check at most ten recent owned properties and explicitly recognize a record, followed by an ownership recheck. Absence is not proof that creation failed. No backend idempotency key or cross-device exactly-once guarantee exists. Starting another property clears only a confirmed receipt, not an uncertain one.

Ordinary internal Back retains local progress; existing Stay/Leave protects draft exits. Busy operations block guarded exits. Keep local progress does not claim Supabase persistence and is not a durable full-form draft save.

## Phase 2 - Ordinary Property Photos

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**.

Property Listing selection opens `listingComposer` before property creation; root Post first opens the postingType chooser; successful property persistence does not change screens. Its large active preview and thumbnail gallery are the primary photo surface; `photoManager` is secondary for ordering, descriptions and recovery. Both legacy `photoUpload` and `photoManager` render `PropertyPhotosView`. Gallery selection can queue local photos without a UUID. Only backend upload requires a real workspace property UUID, supplied by confirmed creation or an owner-authorized portfolio selection, never a preview ID. The legacy advanced manager still requires a saved property. Android upload still requires a successfully persisted property UUID; public-location policy is now implemented, but Android creation/upload acceptance remains unverified.

### Picker, limits and Storage contract

The composer uses SDK-compatible `expo-image-picker` ~57.0.20: images only, multiple selection, remaining-slot selection limit and no editing. Its media adapter preserves each returned URI and validates every item before queueing; unsupported types reject the batch without writes. Adding photos shows local thumbnails. Before a UUID exists they remain local; explicit Save creates the property, then uploads queued photos sequentially. Existing persisted-property additions retain their sequential upload behavior. The advanced manager retains the existing single cached DocumentPicker (`multiple:false`, `copyToCacheDirectory:true`) and explicit Upload photo action. Verification selection is unchanged. MIME/reported size are validated; Expo `File.arrayBuffer()` provides binary data whose actual size is rechecked. Maximum file size is **10,485,760 bytes (10 MB)**; at most **10 ordinary photos** per property. The persisted count drives the integrated UI and disables further selection/upload at ten; the backend serialized limit trigger remains authoritative.

Bucket: **`property-media`**, currently public. Object key:

```text
<owner_uuid>/<property_uuid>/<photo_uuid>.<extension>
```

Expo Crypto generates photo UUIDs before upload. New extensions are jpg/png/webp; reading also accepts existing .jpeg paths. Uploads use `upsert:false`. Photos must not contain verification documents, private access instructions or sensitive data.

Metadata table: **`property_photos`**, with id, property_id, storage_path, nullable alt_text, sort_order, is_cover and created_at. Existing metadata uses `property-media/<owner>/<property>/<photo>.<extension>`; new metadata deliberately preserves that convention. Storage methods receive the normalized bucket-relative object key, never a doubled bucket prefix. Reads accept prefixed/relative paths only after namespace validation. Display URLs are derived through Storage `getPublicUrl`; they are not persisted in storage_path or logged. Verification's private bucket/signed URLs remain unchanged.

### Upload, cover, ordering and alt text

Upload rechecks owner/count, journals a unique operation ID/path, uploads binary data, registers metadata, then reloads authoritative photos. The old sample action assigning photoCount=4 is removed; integrated counts are derived from persisted rows. When a real workspace property is bound, listing preview displays its ordered saved photos in a horizontal strip, with local pending items labeled not saved, rather than Figma samples. Separate listing fixtures remain explicit previews.

The first upload, when the pre-upload list is empty, attempts cover assignment through **`set_property_cover_photo(p_photo_id UUID)`**, returning void. Subsequent uploads do not automatically replace the cover. Cover changes are reflected only after backend confirmation/reload. Failure requires a status check; missing cover can be selected explicitly. The backend's unique partial index permits only one cover per property.

Reads order by `sort_order ASC`, `created_at ASC`, then `id ASC` for deterministic ties. Accessible Move earlier/later actions reassign dense sort_order values sequentially; this is not an atomic reorder across devices. Partial failure can leave duplicate sort values, reconciled through deterministic reload. Optional descriptions update only alt_text; ordering updates only sort_order. The client changes cover through the RPC, not a multi-step is_cover update.

### Deletion and non-atomic recovery

Removal requires inline confirmation. Metadata is deleted first and absence checked before removing the known Storage object. A failed/uncertain metadata deletion leaves the image intact; Storage cleanup failures remain visible and journaled for Check photo status to resume. Deleting a cover does not silently assign a replacement. A temporary orphan can remain after failure/crash; no automatic orphan sweeper is implemented.

Storage upload plus metadata INSERT is non-atomic. A known metadata rejection triggers cleanup of only the just-uploaded, namespace-validated object. Unknown upload/metadata outcomes retain an account/property-scoped AsyncStorage operation record and block new mutations across reopen. No blind duplicate upload or speculative deletion is performed. Check photo status reconciles by generated photo ID; a registered row resolves the upload, while continued absence remains uncertain and can require backend/manual investigation. Refresh failure after registration also requires reconciliation without fake success/re-upload. Reinstall/journal loss or independent devices are not exactly-once protection.

Workflow guards and a per-owner/property service lock prevent simultaneous local mutations. Generations, identity checks and root account-scoped remounts invalidate stale results and clear prior-owner photo state. Picker/mutations block guarded exits while busy. Local selection and unsaved alt text participate in Stay/Leave; Android Back dismisses removal confirmation first.

## Phase 3 - Listing Draft Persistence (2026-10-24)

**IMPLEMENTED / AUTOMATED-TESTED / RUNTIME-UNVERIFIED - blocked by persisted-property prerequisite**.

The Property ViewModel composes listingDraftWorkflow and listingDraftDependencies beside the existing creation/photo workflows. Form state remains in the existing ViewModel; the persistence workflow owns listingId, loaded/busy/error/uncertain, last confirmed backend row and generation/context checks. No second client, global state manager or navigation library is added.

### Local progress versus account draft

A real workspacePropertyId, nonblank title, nonblank description and positive monthly asking rent are required before account persistence. In retained legacy/sample paths before that boundary, Keep local progress retains session-local form fields and explicitly says it is not saved to the account. It does not update the confirmed savedDraft baseline; unsaved listing changes remain dirty on the dashboard and participate in the workspace exit guard. No placeholder title/description/rent/UUID is sent. In the unified composer the action is Save draft; once listing minimum fields exist it validates the remaining supported fields before using the RPC. Invalid optional values block the save rather than silently claiming local/backend success. Success wording follows the confirmed response and authoritative reload, not optimistic local status changes.

A real saved-property UUID remains the prerequisite: normal property creation now receives confirmed exact/derived public points, but Android persistence acceptance is still required. Phase 3 does not implement Maps/GPS or add manual property-ID entry. No real app persistence is claimed from tests. Confirmed creation or an owner-authorized portfolio selection supplies the workspace UUID. My Listings lists all owned properties and opens the selected current draft in the composer, with histories retained in the portfolio model. No manual property-ID entry is added.

### Exact contract and mappings

Writes use only **save_listing_draft**. The generated contract was missing locally; only its exact user-supplied generated function definition was added and cross-checked against a read-only live function inspection. This was not a full schema regeneration and no backend function was created by Codex.

| Form input | RPC argument | Mapping |
| --- | --- | --- |
| Current persisted property UUID | p_property_id | Required, no preview ID |
| Title/description | p_title / p_description | Trimmed, nonblank |
| Monthly asking rent | p_asking_rent_monthly | Positive finite numeric; valid comma grouping accepted |
| House rules | p_house_rules | Optional free text, trimmed; blank omitted for NULL default |
| Rental term | p_rental_term | short_term / long_term / either; explicit labels |
| Security deposit months | p_security_deposit_months | Numeric, zero or greater |
| Advance rent months | p_advance_rent_months | Separate numeric, zero or greater |
| Minimum stay months | p_minimum_stay_months | Optional positive smallint, 1..32767 |
| Available date | p_available_from | Optional calendar-valid YYYY-MM-DD |

Legacy free-text advancePayment/securityDeposit are not parsed into numeric fields or sent to the RPC. Physical-property fields remain distinct and are not mapped from listing rows. Payment terms now have explicit numeric controls and rental-term choices; house rules can be edited as text with existing quick selections. The static suggested-rent controls were removed from this payment step; users enter their own price, with no price-estimation integration.

The RPC returns an array with one row: listing_id, listing_status, completeness_score, created_at and updated_at. The service validates UUID/status/timestamps/score, reloads the own draft and verifies the returned ID before exposing confirmation. The backend derives landlord identity and forces draft, computes completeness/timestamps and serializes same-property create/update. The client sends no landlord_id, status, completeness, lifecycle timestamps or removal fields. Repeated saves retain the same draft UUID through backend reuse; Tier 3 is not required to save a draft.

### Existing draft load and uncertain outcomes

On a workspace property UUID, the service loads only property_id=current UUID, landlord_id=authenticated owner and status=draft. Portfolio selection additionally supplies the chosen listing ID; a missing selected draft blocks saving rather than becoming a new empty draft. Without a selected listing, the existing latest-draft lookup remains ordered created_at DESC then id DESC, limited to one. RLS remains authoritative. It confirms active ownership and current identity; authoritative listing fields populate the existing form without changing physical-property details or reference. Backend-loaded values become the confirmed form snapshot. Saves and loads use busy/generation/account guards; field edits and workspace exits are blocked during these operations. The prior unsaved-exit fix remains in place.

A per-account/property AsyncStorage pending marker is written before the RPC, storing no title/description/credentials. Workflow and service guards prevent rapid duplicate saves. Unknown RPC result, invalid result or post-save reload failure leaves the marker, uncertain state and last-confirmed data intact, blocks another save and exposes Load current backend draft to reconcile. Reconciliation reads rather than automatically writing: it loads CURRENT backend state, which may not contain the attempted changes, and explicitly asks the user to review before another save. A missing row leaves the outcome uncertain; it does not trigger a blind create. Markers survive reopen; journal loss/reinstall and cross-device edits are not exactly-once or conflict-resolution guarantees. Known SQL validation/authorization failures permit explicit correction after safe marker cleanup. Account/property changes/disposal ignore late responses.

### Draft-only and authorization boundary

Authenticated listings table privileges are SELECT only; the frontend performs no direct INSERT/UPDATE/DELETE and asks for no broad grants. Existing RLS permits own-draft reads. The RPC requires authenticated active Tier 1 Landlord membership and an active owned property. Its SECURITY DEFINER/search_path/EXECUTE contract and external tests are recorded in [Phase 3 backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#phase-3---listing-draft-persistence-recorded-2026-10-24). External function creation is not attributed to Codex. The advisor's authenticated SECURITY DEFINER finding is expected for this controlled entry point and is not a reason to expose table writes.

Phase 3 saves retain backend draft status. Phase 4 publication is now connected as documented below; sample published/unavailable labels remain local previews. Phase 5 pause/reactivate/archive is connected as documented below. Moderation and the separately owned GPS/OSM/ML/recommendation/NLP/360 integrations remain deferred; the explicitly authorized property-location integration is documented below.

Validation: npm run typecheck PASS; npm test **373 passed / 0 failed / 0 skipped / 0 cancelled**, including 19 new listing service/workflow/domain tests and three additional actual ViewModel integration tests, plus the preserved 351-test baseline. git diff --check PASS. Unit/mocked integration evidence is not Android/live persistence. Manual testing after location integration must verify first save/repeated same-ID save, restart/reload, numeric/date/rental-term inputs, local-progress boundary, rejected ownership/inactive access, interrupted saves/reconciliation and account switching. Confirm no publication/lifecycle write occurs.

## Current Backend Authorization

RLS remains authoritative; frontend gates are UX/defense in depth. Existing live photo management policy **`property_photos_manage_owner_admin`** uses **`can_manage_property(property_id)`**. Read policy uses **`can_view_property(property_id)`**. Storage policies require authenticated-owner/property namespacing. The owner-only frontend does not expose all backend Admin capabilities.

Authenticated photo UPDATE is intentionally column-scoped to **alt_text, sort_order, is_cover**. Authenticated DELETE is available at table privilege level but remains protected by RLS. No broad table-level UPDATE grant was added. The permanent DELETE grant and externally reported owner/unrelated-user rollback results are documented in [ledger P2-03 through P2-06](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#p2-03-external-permanent-delete-privilege-grant), rather than treated as Codex-performed work.

Structural generated types do not prove grants/RLS or runtime authorization. Prior Codex read-only observations and user-confirmed external tests are distinguished in the ledger. Pre-existing advisor warnings about exposed SECURITY DEFINER functions and mutable set_updated_at search path remain external backend follow-up; this governance pass does not fix them. No live inspection was performed during this documentation pass.

## Teammate-owned integrations - deferred from this branch

1. XGBoost Rental Price Estimation.
2. GPS-Based Property Proximity Searching.
3. MapTiler Maps and Geocoding.
4. OpenStreetMap Nearby Places Searching.
5. Content-Based Property Recommendation System.
6. NLP Review Word Cloud Summarizer.
7. 360 feature.

These feature boundaries remain in place. The explicit 2026-10-26 integration request authorizes only MapTiler property-address search and MapLibre exact-pin confirmation in this feature. It does not implement device GPS/discovery, nearby places, ML/recommendation/NLP/360 or another MapTiler client. Ordinary photos do not constitute 360 support.

## Planned Property & Listing phases

| Phase | Current boundary |
| --- | --- |
| Phase 1 - physical property creation foundation | Implemented/automated-tested; Approved public-point handoff implemented; Android persistence unverified |
| Phase 2 - ordinary property photos | Implemented/automated-tested; runtime requires saved UUID |
| Phase 3 - listing draft persistence | Implemented/automated-tested; Android runtime blocked by persisted-property prerequisite |
| Phase 4 - publication workflow | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED |
| Phase 5 - listing lifecycle | IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED |
| Later integration with separately owned features | DEFERRED |

Listing draft writes use save_listing_draft; publication uses publish_listing only. Direct listings writes remain unavailable; real lifecycle uses only the three Phase 5 RPCs. The external publication RPC now enforces property-specific Tier 3 approval; account-wide Tier 3 timestamps are not a substitute. Phase 5 is integrated as documented below.

## Runtime unsaved-exit correction (2026-10-24)

The user reports that the initial Android blocked-save flow passed, but the dirty Property Setup unsaved-exit dialog initially failed to appear. That failure supersedes earlier broad source/unit-test assumptions about runtime exit protection. Blocked-save acceptance is limited to that tested behavior; full property/photo persistence remains location-gated.

This pass corrected reproducible navigation defects: the guard previously received a render-time boolean and could see the previous clean snapshot when a workflow changed before React committed; confirmed Listings-root exit retained the dirty physical draft; retained exit callbacks could run after workspace/account unmount. The guard now accepts a live predicate for property/photo workflow state (while retaining boolean compatibility elsewhere), and the Property ViewModel funnels real exits through one mounted/busy-checked request function. Confirmed discard clears only local property/photo edits and restores the legacy draft snapshot; it does not clear durable operation journals, forget a confirmed property UUID, create a property or upload photos. Unmount cancels pending intent and stale callbacks cannot navigate.

Exit-path audit: Discover, Chat, Tenancy and explicit Close already called the ViewModel request wrapper; Listings/root Back used the shared guard directly and now use the same feature wrapper for discard/lifecycle semantics. There was no unconditional direct bottom-tab bypass to replace. The reproduced clean-snapshot branch could execute an exit immediately without a prompt. Review -> address -> details remains internal and unprompted. Details -> posting type retains the physical draft; the next posting-type/root exit is guarded. Stay/cancel preserves inputs and never navigates; Leave executes the first requested destination once. Shared NavigationConfirmation still maps Android Back to cancel. No screen redesign or new native navigation mechanism is introduced.

Automated evidence: npm run typecheck PASS; npm test **351/351 PASS**, 0 failed/skipped/cancelled; git diff --check PASS. Eleven new integration-style tests execute the actual PropertyListingFlowView callbacks, Property ViewModel, creation/photo workflows and shared guard with controlled hook scheduling and replaced native/backend dependencies. They reproduce the pre-render dirty-state gap, exercise internal/root Back, Stay/Leave, duplicate requests, Listings discard, clean exit and stale unmounted intents. These are not native React/Android rendering tests. The earlier source assertion was updated to recognize the guarded feature wrapper; behavioral coverage replaces reliance on that regex alone.

Corrected behavior: **RUNTIME-UNVERIFIED AFTER FIX** until the user retests Android. Retest dirty details -> posting type -> hardware Back; Discover/Listings/Chat/Tenancy/Close; Stay, Leave, repeated taps and Android Back on the dialog. Verify internal review/address Back preserves values without prompting, no immediate re-prompt after confirmed Listings discard, and account/workspace replacement cannot execute an old pending destination. The agent did not reproduce the native dialog visually, so Android acceptance is not claimed.

No live backend action was performed and no ledger change was needed for that bugfix. Phase 3 was NOT STARTED at that point; its later implementation is documented above. See the [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#runtime-bugfix---unsaved-workspace-exit-2026-10-24).

## Phase 3 local-progress correction (2026-10-25)

Keep local progress no longer marks the current listing fields as a confirmed saved baseline. Listing dirty state is computed from draft-versus-confirmed-baseline differences across the whole workspace, including the dashboard; no second draft store was added. Internal state-preserving transitions retain fields. An external exit after local progress now opens Stay/Leave: Stay keeps all local inputs and the current workspace; Leave runs the first requested destination once and restores the last confirmed baseline. Authoritative backend load/save still updates that baseline, so a newly confirmed listing is clean until edited again. No incomplete progress is automatically persisted.

NavigationConfirmation accepts optional title/body, with existing shared defaults unchanged for other features. PropertyListingFlowView supplies "Leave Property & Listing Management?" and "You have unsaved property, photo, or listing changes. Stay to continue editing, or leave without saving." Buttons and Android Back-as-cancel behavior are unchanged.

Three regression tests exercise the actual ViewModel/Flow: local progress -> dashboard -> external exit -> Stay/preserved fields -> Leave/one destination/baseline restoration; backend-confirmed clean state and a subsequent dirty edit; contextual copy plus shared defaults and Android cancellation. They initially failed before correction. Typecheck and full automated suite pass: **376 total / 376 passed / 0 failed / 0 skipped / 0 cancelled**; whitespace and documentation links pass. Corrected exit behavior is **RUNTIME-UNVERIFIED AFTER FIX** until Android retesting.

The ledger now preserves the exact user-supplied historical save_listing_draft CREATE/REVOKE/GRANT SQL as external ChatGPT/Supabase evidence. Codex did not execute it or perform any live backend action. No Phase 4/lifecycle or teammate-owned feature was implemented.

## Runtime verification and known limitations

Last documentation/source review: **2026-10-28**. The following earlier phase counts are historical; current privacy/handoff evidence appears below. Current bugfix validation is recorded above; historical phase evidence follows: Phase 1 typecheck and 310/310 tests passed; Phase 2 typecheck and 340/340 tests passed (30 new photo tests), zero failures/skips/cancellations; whitespace passed. These are prior implementation-run results, **not rerun in this documentation-only pass**. Baseline `a827827` plus uncommitted Phase 2 work is not a verified Phase 2 commit. The Phase 1 blocked-location Android path is **RUNTIME-VERIFIED**; successful property persistence, ordinary-photo workflow and listing-draft persistence remain **RUNTIME-UNVERIFIED** for the reasons below. The unsaved-exit correction still requires user Android re-verification. Full app creation/photo persistence still needs runtime acceptance; approved location handoff is now implemented.

Current user-reported runtime scope:

| Flow | Android status | Limit/reason |
| --- | --- | --- |
| Phase 1 blocked-location path | RUNTIME-VERIFIED | Property form/review reachable; exact/public points await confirmation; save disabled without coordinates |
| Phase 1 successful property persistence | RUNTIME-UNVERIFIED | Approved exact/public handoff implemented; actual Android save pending |
| Phase 2 successful ordinary-photo workflow | RUNTIME-UNVERIFIED | Requires a real persisted property UUID; no upload/cover/order/delete acceptance claimed |
| Phase 3 successful listing draft persistence | RUNTIME-UNVERIFIED | Requires a real persisted property UUID; no Android RPC-save acceptance claimed |
| Corrected unsaved-exit behavior | RUNTIME-UNVERIFIED AFTER FIX | User Android re-verification required |

Existing Expo compatibility drift remains: expo 57.0.30 expects ~57.0.31, expo-location 57.0.21 expects ~57.0.22, expo-notifications 57.0.23 expects ~57.0.24. At the original Phase 2 checkpoint no dependencies or native rebuild were added. The later 2026-10-29 composer gallery adds expo-image-picker and requires rebuilding clients that lack it. Historical pre-final-refactor Android JavaScript/Hermes export (940 modules) was bundle validation only, not a final device/runtime test.

Manual Android checks: confirm the new map handoff enables a valid review save, then verify Tier 1/non-Tier 3 creation yields one real owned UUID, no listing, and visibility in unchanged Tier 3 selection. Then test picker cancellation, explicit upload/reopen, supported/oversized/unsupported files, ten-photo limit, cover/order/alt text, cover deletion and both metadata/Storage cleanup. Exercise network loss at each non-atomic stage, status reconciliation without duplicates, remount/account switching/non-owner denial, Back/Stay/Leave, narrow Android screens and font scaling. Use separately authorized new fixtures; do not alter existing verification test records.

Known evidence gaps include incomplete external test transcripts, the inactive Phase 1 fixture awaiting optional cleanup, non-atomic create/upload/order/delete outcomes and untested live client/RLS/Storage paths. See the ledger for ownership, external provenance and outstanding cleanup rather than inferring backend success from unit mocks.

## Evidence and reports

- [Property & Listing continuous implementation history and roadmap](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md).
- [Property & Listing backend interaction ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md).
- [Routes/feature entry points](../ROUTES.md#property--listing-management-feature-states).

The continuous implementation history preserves Phase 1/2 evidence. Maintain one living feature document (this file), one continuously updated implementation history/roadmap and one continuously updated backend ledger. Future phases become sections in the existing files; do not create separate Phase 3/4/5 implementation reports or per-phase ledgers. Separate reports are appropriate only for genuinely separate audits/investigations explicitly requiring their own artifact. Existing historical reports remain preserved.

All future phases must update:

- `docs/features/PROPERTY_LISTING_MANAGEMENT.md`
- `docs/implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md`
- `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`

## Implementation PDF Traceability

Markdown is the traceable source material for later thesis implementation PDFs; no PDF is generated here. For **every phase**, maintain a concise record of frontend files added/modified; backend tables/RPCs/Storage used; exact permanent SQL/backend changes (or an explicit no-permanent-mutation statement); tests performed; truthful runtime status; unresolved/deferred dependencies; security/RLS validation with actor/provenance; and links to the phase section in the continuous implementation history and relevant backend-ledger entries.

Keep behavior current here, phase evidence in the [implementation history/roadmap](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#implementation-pdf-traceability), and exact backend actions/effects in the linked ledger. Missing historical SQL/receipts must stay explicitly unavailable until originals are supplied; do not fabricate evidence for a PDF. External backend tests are not Codex or Android runtime success.


### Final Phase 3 baseline correction (2026-10-25)

The supplied phase3_final_correction.patch was applied semantically: confirmPublish and finishEdit no longer assign current local listing fields to savedDraft.current. Publication preview and Save local changes remain local presentation actions, so edited fields must still prompt on a later external workspace exit. Stay retains edits; Leave restores the last confirmed listing values and executes the requested destination once. Neither action creates a backend confirmation or adds a save/publication RPC call.

Two additional actual ViewModel/Flow regressions initially failed and now pass: unsaved edits after publication preview and after local management edits remain guarded, and confirmed Leave restores the backend-saved title without another backend save. Validation: npm run typecheck PASS; npm test **378 passed, 0 failed, 0 skipped, 0 cancelled**; git diff --check PASS; documentation links PASS. Corrected behavior remains **RUNTIME-UNVERIFIED AFTER FIX** pending user Android re-verification. No live backend action, ledger change or Phase 4/lifecycle implementation occurred.


## Phase 4 - Listing publication (2026-10-25)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. Reviewed against baseline fbb0878 plus these uncommitted changes; the baseline does not contain this implementation.

The existing saved draft enters an explicit Review publication / Publish listing confirmation. Real property/listing UUIDs, a confirmed backend draft, no uncertain draft save and unchanged persisted listing fields are required. Publication never auto-saves. The legacy requiredListingFields checklist is only for the Figma sample; cached completeness, landArea and local pin/photo flags do not decide real eligibility.

The service calls publish_listing with only p_listing_id. Backend authorization checks active Tier 1 Landlord ownership, an active owned property, approved tier_3_property verification for that particular property, no other active/paused/rented listing for it and server-recomputed weighted completeness >= 0.80. Frontend account Tier 3 timestamps are not a gate. Known errors show safe Tier 3, completeness, duplicate or ownership messages. Supabase remains authoritative.

A one-row receipt must match the listing UUID, active status, finite score >= 0.80 and valid published_at/updated_at timestamps; an owner-and-ID-scoped reload must confirm publication. Only then is active shown as Published, with the same ID, score and Philippine-time publication timestamp. Property/photo state is retained. Draft saving is blocked; restoring an active listing does not run a draft-only absence query or create a replacement. The original Phase 4 Published screen is extended by the Phase 5 controls documented below. Fixtures remain sample-only; normal My Listings is the real property-centered portfolio described below.

The ViewModel composes listingPublicationWorkflow; listingPublicationService owns authenticated RPC/read calls and an account/property/listing-scoped AsyncStorage pointer plus pending marker, written before the RPC. Busy and generation guards prevent rapid duplicate calls and stale account/workspace results. Unknown network outcomes, invalid receipts and failed confirmation reloads keep publication uncertain and block another attempt. Check publication status reads the known owned listing without publishing: active confirms success; draft explicitly says publication is not confirmed and requires a fresh user confirmation; other statuses remain blocked. No automatic retry or rollback occurs. On reopening a saved property, restoration checks its pointer (or a narrowly scoped latest owner/property read if absent) before Phase 3 draft loading. Draft-save reconciliation remains a separate operation.

Source: models/ListingPublication.ts; services/listingPublicationService.ts and listingPublicationDependencies.ts; viewModels/listingPublicationWorkflow.ts, listingDraftWorkflow.ts and usePropertyListingViewModel.ts; views/ListingPreviewView.tsx, PublishedListingStatusView.tsx, PropertyDashboardView.tsx and PropertyListingFlowView.tsx. Views contain no backend clients; models are pure; workflow/ViewModel own async state/navigation. No new dependency or rebuild is required.

Tests: listingPublication.test.ts plus actual-hook/Flow regressions in propertyExitGuard.test.ts and the existing marketplace wiring guard. Current validation: typecheck PASS; full suite **408 total / 408 passed / 0 failed / 0 skipped / 0 cancelled**. Automated tests do not establish Android, live client permissions or Storage success.

Android checks after the separate location integration supplies a real owned property: save an unchanged draft, confirm publish once, inspect same-ID Published/status/score/time and retained photos; reopen and confirm no replacement draft. Test pending/rejected Tier 3, low completeness, another live listing, unsaved changes, rapid taps, network loss before/after RPC, Check status returning active/draft, restart with a pending marker, account switch and Stay/Leave/Back. No IDs/debug bypasses were added. New-property successful publication remains blocked by the externally owned MapTiler/location prerequisite. At the Phase 4 checkpoint, Phase 5 and all seven teammate-owned features remained untouched. Phase 5 is now documented below.

Backend evidence, including external rollback tests, controlled EXECUTE grants, canonical function definition and Codex's read-only inspection, is in the [backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#phase-4---publication-contract-and-external-evidence-2026-10-25). No permanent live backend mutation was performed in this phase by Codex. The externally created RPC is a permanent external change, separately attributed there.


## Phase 5 - Listing lifecycle (2026-10-26)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. Last source/document review: 2026-10-26. Baseline 7ae983f contains Phase 4, not this uncommitted Phase 5 implementation. No dependencies or native rebuild requirement added.

| Backend status | Display | Landlord actions |
| --- | --- | --- |
| active | Published | Pause listing, Archive listing |
| paused | Paused | Reactivate listing, Archive listing |
| rented | Rented | None; tenancy controlled |
| archived | Archived | None; terminal in this workflow |
| removed | Removed | None; moderation/Admin controlled |
| draft | Draft | Phase 3 save and Phase 4 publication only |

All three typed RPCs accept only p_listing_id: pause_listing, reactivate_listing and archive_listing. Return rows contain listing_id, listing_status, completeness_score, nullable published_at/paused_at/archived_at and updated_at. No landlord/property/status/timestamp/score payload, generic status RPC or direct listing UPDATE is used. Exact structural signatures were added only; no full schema regeneration is claimed.

Backend authority: active Tier 1 Landlord identity, owned listing, permitted current status and no active tenancy are checked by every lifecycle RPC. Reactivation additionally checks an active owned property, qualifying approved Tier 3 for that exact property, no competing active/paused/rented listing and trigger-recomputed 80% completeness. At the Phase 5 checkpoint no TypeScript completeness formula or account-wide Tier 3 gate was added. The 2026-10-31 display estimate below mirrors the existing trigger without changing its authority. Errors are normalized to safe transition, tenancy, Tier 3, completeness, duplicate or access messages.

The existing real PublishedListingStatusView now renders current backend status and Philippine-time published/paused/archived/updated timestamps. Each action first opens an inline confirmation; Cancel and Android Back cancel without writing. Archive explains that it is final in this workflow and retains listing/property/photos. Rented explains tenancy ownership; removed says it is no longer active. No unarchive, clone, manual rented/removed action, or real post-publication content editing exists. Sample Mark unavailable and sample editing remain explicitly local-only and do not invoke a backend action.

MVVM: ListingLifecycle.ts owns pure mappings/validation; listingLifecycleService.ts and listingLifecycleDependencies.ts own authenticated owner/property/listing-scoped reads and RPC access; listingLifecycleWorkflow.ts owns confirmation, busy/error/uncertain state and request generations. The existing composed ViewModel coordinates other workflow guards and navigation. Views invoke ViewModel actions; no View backend access, new client, cross-feature ViewModel import or navigation/state framework was introduced.

Mutation sequence: fresh known-owner/listing read and expected-status check -> durable pending marker -> exact RPC -> same-ID/expected-status/timestamp receipt validation -> authoritative same-owner/listing reload -> accept status. Pause requires paused_at; reactivate requires paused_at null and score >= .80; archive requires archived_at. Original published_at must remain the same instant. A receipt alone never produces success.

Pending journal key: rentlease:listing-lifecycle:<userId>:<propertyId>:<listingId>:<operation>; value is only an operation marker, with no listing content or credentials. Unknown network outcomes, invalid receipts or failed/disagreeing reloads retain uncertainty and block another mutation. Check listing status reads authoritative state, clears lifecycle markers only after a successful explicit reconciliation and never replays an action. It accepts an already-applied target, unchanged source or tenancy/moderation-driven state; unchanged source requires a fresh confirmation. Module-level in-flight guards plus synchronous workflow guards prevent duplicate operations. Account/property/listing changes and disposal reject late results.

Cross-workflow boundaries: lifecycle mutations are blocked while property creation, photos, draft saving, publication or another lifecycle operation is busy, and while draft/publication outcomes are uncertain. Draft/publication mutation guards also block while lifecycle state is unresolved. Durable draft/publication markers are rechecked by the lifecycle service before mutation. Navigation busy guards remain intact.

Restoration now accepts active/paused/rented/archived/removed as existing records before draft-only loading. Non-draft records remain adopted/read-only in draft persistence and cannot be mistaken for an absent draft or create a replacement. Pending lifecycle markers are inspected on reopen and require explicit reconciliation. Restoration uses the existing saved-property identity boundary; no unrestricted listing browser or ID bypass was added.

Automated evidence: npm run typecheck PASS; npm test **480 total / 480 passed / 0 failed / 0 skipped / 0 cancelled**. Four restoration regressions first failed on the old restriction; 72 new cases cover lifecycle service/workflow, transition matrix, receipts/reloads, journals, safe errors, concurrency, identity/generations, actual ViewModel/Flow presentation and existing draft/publication/sample regressions. One earlier Phase 4 test intentionally now expects authoritative paused reconciliation rather than treating a supported lifecycle status as unknown. Whitespace/link validation is recorded in the implementation history.

Android checks after the separately owned location integration permits normal saved-property/listing creation: publish -> request Pause -> Cancel/Back (no write) -> confirm Paused -> Reactivate (Published, original publication time retained, paused time cleared) -> Archive (retained record/photos, no further controls). Reopen paused/rented/archived/removed and confirm no replacement draft. Test active-tenancy and other backend denials, unsaved/uncertain draft/publication exclusion, rapid taps, network interruption before/after RPC, explicit reconciliation/restart, account switching, Back/Stay/Leave and large text on narrow screens. No actual Android lifecycle success is claimed.

Backend evidence is in the [Phase 5 ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#phase-5---listing-lifecycle-2026-10-26). External SQL Editor changes and rollback/denial tests are attributed separately from Codex's read-only definition/privilege inspection. Active-tenancy denial is **CONTRACT-VERIFIED / NOT INDEPENDENTLY ROLLBACK-TESTED**. No permanent live backend mutation was performed in this phase by Codex. At the Phase 5 checkpoint, all seven teammate-owned integrations were untouched and normal new-property runtime was location-gated; the later authorized location/privacy integration is documented below.


## MapTiler and MapLibre exact property confirmation (2026-10-26)

Current status updated 2026-10-28: MapTiler search and MapLibre exact pin are **IMPLEMENTED / AUTOMATED-TESTED / Android PARTIALLY RUNTIME-VERIFIED**. The user reports that the map/style render, confirmation map opens, pin displays and reaches Property Review with exact-confirmed copy. This does not establish every search/drag/error/cancellation path or successful persistence. The approved public-point rule and complete handoff below supersede the original exact-only blocker.

The existing geocoder/service/workflow and native renderer remain unchanged except for confirmation handoff. Search is Philippine-scoped with finite/range/response validation and AbortSignal support; candidate choice stays explicit. MapLibre uses v11 Map/Camera/ViewAnnotation, longitude-first tap/drag events, visible credits and native attribution. The map stays outside the wizard ScrollView. No device GPS or duplicate MapTiler provider/config exists.

Location work captures address revision and setup context. The synchronous property-creation subscription invalidates address changes before React renders; search and native callback generation tokens reject stale results. Cancel preserves previous confirmation only for the same address context; setup close/account-keyed unmount disposes location work. Existing Back/Stay/Leave and form preservation are retained. Native map appearance/controls were not redesigned.

Historical automated evidence: the 2026-10-26 exact-only implementation passed typecheck and 536/536 tests, zero failures/skips/cancellations; plugin introspection passed with owner/EAS ID preserved and no generated native directories. The previous note about a differently named local key was an observation from that date, not a current missing-key finding. No env value was read or changed in this pass. Use a MapLibre-capable development build; stock Expo Go is insufficient. This JS-only privacy pass adds no native rebuild requirement or dependency.

Source: views/PropertyLocationToolView.tsx (shared composer/legacy tool presentation), models/PropertyLocationConfirmation.ts, services/propertyLocationService.ts and propertyLocationDependencies.ts, viewModels/propertyLocationWorkflow.ts, views/PropertyLocationMapView.tsx and PropertySetupView.tsx, plus existing shared geocoding/map-style configuration. Earlier implementation evidence is retained in the [continuous history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#maptiler-property-location-integration-2026-10-26).

## Public location privacy and complete Phase 1 handoff (2026-10-28)

**Public-location privacy: IMPLEMENTED / AUTOMATED-TESTED.**
**Complete Phase 1 location handoff: IMPLEMENTED / AUTOMATED-TESTED.**
**Successful Android property persistence: RUNTIME-UNVERIFIED.**
Baseline 6199094 plus this uncommitted work is not a runtime-verified revision. No package, native config, geocoder, map rendering, persistence service/RPC or generated schema contract changed.

Public property coordinates are generated by projecting the landlord-confirmed exact coordinate into Web Mercator, assigning it to a fixed 300-meter grid cell, and exposing the center of that cell as the discovery-safe public coordinate.

Policy details: pure models/PropertyLocationPrivacy.ts uses radius 6378137, clamps projection latitude to +/-85.05112878, computes EPSG:3857 x/y and snaps each axis using (floor(value / 300) + 0.5) * 300 before inverse projection. The asinh(tan(latitude)) forward expression is equivalent to the standard logarithmic Mercator form and preserves exact zero at the origin. Inputs/outputs must be finite and geographically valid. Exact input objects are never mutated. Negative cells use floor, not truncation. No projection/GIS dependency was added. See [PROJ Web Mercator](https://proj.org/en/stable/operations/projections/webmerc.html).

This is deterministic 300-meter grid generalization: the same cell maps to the same public point. Grid units are projected meters; ground scale varies with latitude. Within a cell, maximum projected displacement to its center is half the diagonal (about 212m), not an exactly 300m offset. A point already at a grid center may numerically equal its derived point; the guarantee is use of the approved transformation, not universal numeric inequality. This is location generalization, not differential privacy, anonymization or guaranteed identity protection.

The exact coordinate remains private. The public coordinate is an approximate area representation under the approved policy. Future GPS-based tenant proximity searching MUST consume public property coordinates, not the exact/private point. Intended future contract is tenant GPS -> authorized PostGIS proximity RPC -> public property coordinates -> distance-ranked listings. That GPS/PostGIS/discovery/OSM work is not implemented here.

Confirmation flow: propertyLocationWorkflow validates a loaded map's exact point, derives/validates its public point and passes exactLatitude/exactLongitude/publicLatitude/publicLongitude with the captured confirmedRevision to the composed ViewModel. Before provideConfirmedLocation(location, confirmedRevision), the ViewModel checks current address revision, mounted/loaded state, no busy/uncertain creation and no existing property. It verifies all four accepted values afterward. Stale/rejected/invalid derivations fail safely without a successful handoff. Reentrant context changes cannot restore old confirmation state. No View writes the draft or calls Supabase.

Address edits to city, barangay, addressLine1, addressLine2 or postalCode still clear all four values and invalidate the local exact/public confirmation. Reconfirmation derives a fresh point for the new revision. Cancellation/map/search failures issue no new handoff. Other form fields remain preserved; no raw exact/public coordinates appear in notices, error text, logs or UI. Legacy sample confirmPin remains separate.

Legacy Property Setup and Review both show Exact location: Not confirmed yet / Public map point: Waiting for location confirmation until the four-coordinate handoff has been accepted. After acceptance they show Exact location: Confirmed on map / Public map point: Approximate discovery location ready. hasConfirmedPropertyLocation and draftPropertyError are unchanged; Confirm and save property naturally becomes enabled when all ordinary inputs are valid. Saving remains an explicit separate action through unchanged create_property_setup; map confirmation does not write remotely or create a listing/Tier 3 submission.

Current automated checks: typecheck PASS; 575 tests / 575 passed / 0 failed / 0 skipped / 0 cancelled. Focused coverage includes projection benchmarks/roundtrips, same/adjacent/negative cells, poles/bounds, grid centers, deterministic nonmutation, invalid points, callback failures, stale/reentrant revision guards, actual ViewModel address clearing/reconfirmation, Setup/Review readiness and the unchanged mocked creation RPC/payload/UUID path. Existing exact-map tests are retained; assertions intentionally forbidding a complete handoff were revised for this approved behavior, with the disconnected-workflow no-hidden-write case preserved.

Manual Android sequence using the existing compatible development build after reload: Add Property -> valid physical details/address -> Find and confirm location -> select MapTiler candidate -> adjust exact pin -> Confirm exact location. Verify exact-confirmed/public-ready labels on address and review, no raw coordinates and enabled Confirm and save property when other inputs are valid. Edit each address field: labels/readiness must reset and save become disabled until reconfirmed. Cancel/fail a new search/map confirmation and preserve form values without a new handoff. Then explicitly save once and verify a real owned property UUID and normal transition to the composer, without listing or Tier 3 submission. Check network uncertainty/reconciliation, account/workspace switch and existing exit guards. No Android save success is claimed in this pass.

Known Expo patch drift remains unchanged. No backend mutation, schema/RLS/RPC/type/migration change or live Supabase test occurred. Phases 2-5 behavior and GPS/OSM/ML/recommendation/NLP/360 features remain unchanged. Current evidence is in the [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#public-location-privacy-and-complete-phase-1-handoff-2026-10-28) and existing backend ledger.


## Streamlined composer and real landlord portfolio (2026-10-29)

Navigation descriptions in this dated checkpoint are superseded by Current default Post below; portfolio/service boundaries remain current.

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Last source/document review: 2026-10-29. Commit context: ab15285 is the baseline, not a verified commit containing this uncommitted work.

### Post and selected-item ownership

Post immediately opens the unified new-property/listing composer; My Listings remains the persisted portfolio hub. The composed ViewModel owns explicit `workspacePropertyId`, `workspaceListingId` and mode (`none`, `create`, `compose`, `manage`). `propertyCreation.propertyId` remains only the Phase 1 result, not the selected portfolio record. Choosing a property without a listing binds its real ID and opens the composer without calling property creation or needing a creation receipt. Draft selection reloads the selected authoritative draft. Active/paused/rented/archived/removed selections open real status/lifecycle presentation; post-publication content editing remains unavailable.

Post detaches item-specific photo/draft/publication/lifecycle state, invalidates late results and clears transient form/media state. It does not remove existing listing/photo/publication/lifecycle journals or backend data. Another item's Tier 3 pending/rejected state or publication/lifecycle uncertainty does not block a new Post. Unsaved active composer/queue changes still require Stay/Leave. In-flight physical-property creation remains protected; an unknown physical creation outcome still requires its existing recovery path because its account-scoped creation journal is not an idempotent multi-property API. Only a confirmed creation receipt is cleared when deliberately beginning a new property.

### Property-centered reads and cards

`landlordPortfolioService` authenticates and repeatedly rechecks identity. It reads narrow owner-scoped `properties` and `listings`, own `verification_submissions` filtered to `tier_3_property`, and cover-only `property_photos` for already confirmed owned property IDs. Main reads paginate in deterministic 200-row pages; cover queries chunk 100 owned IDs. No private location, exact coordinates, access instructions, tenancy/obligation or rating queries are added. RLS remains authoritative; the supplied external audit is recorded in the [backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#portfolio-read-contract-and-local-ux-integration-2026-10-29), not independently rerun here.

Every owned property stays visible even without listings, photos or Tier 3. Listing histories remain attached to each property. Current listing priority is active/paused/rented, then draft, then archived/removed; each category uses updated timestamp, creation timestamp and descending ID ties. Tier 3 uses latest submitted_at, then updated_at and ID for that property; not_submitted is frontend presentation only, not a database enum. Account-wide profile Tier 3 is never used.

Cards use real validated cover paths/public Storage URLs or a restrained placeholder. They show title/property type, barangay/city, actual rent where present, exact listing and property-specific verification labels. Normal cards contain no Figma crops, fake unit codes, views, inquiries, overdue or ratings. Search uses listing titles, property labels, barangay and city. Statistics are owned properties and counts of active/draft/rented listing rows in the loaded histories. Empty means a successful read returned zero owned properties. Pull-to-refresh/contextual Retry reloads the portfolio. Entry to My Listings reloads; confirmed property/draft/publication/lifecycle adoption invalidates cached portfolio data so the next entry reloads it.

### Composer and ordinary photos

ListingComposerView is the single vertical property/listing creation surface before and after persistence. Normal Post skips postingType and PropertySetupView. Successful creation binds the real UUID without leaving or replacing the mounted composer. Unknown creation outcomes remain inline and block duplicate creation. The exceptional receipt/recovery screen remains available. All supported listing fields remain: title, monthly rent, description, rental term, security deposit months, advance rent months, minimum stay, house rules and availability date. Before persistence, ComposerPropertyFields binds the existing physical-property draft, including all numeric/furnishing and address/private instruction fields. After a new property saves, those same entered controls remain mounted read-only; an existing portfolio property uses its safe read-only summary. No private coordinates appear and no unsupported physical-property UPDATE is invented. Composer Save coordinates property creation if needed, safe sequential media processing and the existing save_listing_draft payload/journal/baseline. It remains on the composer and reports each confirmed boundary; publication remains a separate explicit operation with property-specific Tier 3/server completeness checks.

The horizontal media strip distinguishes saved/cover, local waiting/uploading and uncertain media. Gallery capacity is ten minus saved and pending selections; the full returned selection is validated before writes. Per-photo upload is the existing propertyPhotoService.upload primitive, sequentially awaited with authoritative refresh and identity checks. No parallel upload loop or combined backend transaction is introduced. First-photo cover, set_property_cover_photo, object namespace, upsert:false, limits and metadata operations are unchanged. Cover selection/removal are available in the composer; deletion still requires confirmation and Android Back dismisses it first. Manage media retains descriptions, compactly linked advanced ordering and detailed recovery; no drag dependency was added.

On uncertainty the attempted item is isolated, the batch stops, and unattempted selections remain local. Check photo status uses the existing journal reconciliation and never automatically resumes uploads; explicit Continue remaining uploads is required after successful reconciliation. If metadata is absent and the service cannot resolve the attempted upload, the queue remains blocked. Successful operations cannot be repeated merely because a refresh failed. Queued files are memory-only and need reselection after process death; existing durable operation markers remain. Progress counts definite successful upload returns conservatively and does not claim every reconciled upload succeeded. No speculative Storage cleanup was added.

360 property view remains an explicitly unavailable future capability, with no capture/upload/rendering/ordinary-photo record. Existing verification DocumentPicker/upload behavior is unchanged. The new native expo-image-picker dependency requires rebuilding a development client that lacks it; no build was run. Its gallery-only plugin disables camera/microphone permission contributions; the portfolio itself adds no dependency or permission change. The independently edited eas.json simulator profile is preserved, not authored by this pass.

### Scoped feedback, verification and limits

Property setup/map render only creation/location feedback. ListingWorkspaceFeedback lives inside the composer/preview/status surfaces and requires matching workspace property/listing IDs. Drafts show their own save/load feedback; matching uncertain publication can be checked contextually; lifecycle feedback exists only in management. My Listings shows portfolio load errors. No listing-management banners remain globally above every Post screen.

MVVM is preserved: domain models are pure; portfolio reads/URL validation and gallery integration are service-owned; queues, selection, guards and reconciliation are workflow/ViewModel-owned; Views bind state/actions. No new Supabase client, navigation library, state manager, RPC, schema, generated contract, RLS, grant or Storage policy was changed. No live Supabase action was performed. No permanent live backend mutation was performed in this phase.

Automated evidence and exact totals are maintained in the [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#streamlined-composer-and-real-portfolio-2026-10-29). Existing historical phase evidence remains intact. Android acceptance remains required for actual photo-picker permissions/selection/file reads, long batches and network uncertainty, native Back/text scaling, portfolio live reads and opening/switching multiple properties. MapTiler/privacy behavior, Phase 4/5 RPC mutation contracts, verification, GPS/OSM/ML/recommendation/NLP and the unfinished 360 feature are preserved.

Manual Android acceptance: use a rebuilt MapLibre-capable development client; open My Listings and confirm real property/cover/status/Tier 3, then Post and verify blank new creation with no prior-item banners. Post immediately shows the composer. Select photos locally before a UUID, fill property/address/listing details, confirm the map and return to the same scroll/form. Save once and inspect property -> sequential photos -> listing draft without a created/photo-manager transition; then preview. Return to My Listings and verify both properties; reopen each draft/status and check IDs/content/photos do not bleed. Repeat with property A Tier 3 pending/rejected or publication uncertain, retaining A's recovery when posting B. Interrupt a batch and reconcile explicitly before resuming. Test Stay/Leave, nested Back, account switch, inactive/denied property and narrow large-text screens. No Android success is claimed from automated tests.


## Unified default Post composer (2026-10-29)

**Historical same-day checkpoint, superseded by the two-page refinement below.** This supersedes the earlier same-day UX checkpoint that opened the composer only after physical-property creation. Existing phase evidence is historical, not the current user-facing navigation.

Post now opens ListingComposerView immediately. At this historical checkpoint, its one vertical scroll contained media first, an explicitly unavailable 360 entry, physical property details, structured address/private access instructions, map confirmation, listing title/rent/description, local-only amenity choices, rental terms, rules and availability. No supported fields or RPC mappings were removed. The unsupported backend amenity catalogue remains clearly labeled local-only, with no guessed IDs. PostingType and PropertySetupView remain explicit legacy/sample/recovery surfaces; choosing the physical-property option there also routes into the unified composer.

The existing photo workflow permits local gallery selection before a UUID, validates the same type/size/count limits, shows thumbnails and makes no photo-service calls. A narrowly explicit null-to-confirmed-property binding preserves that local queue; ordinary property switching still discards it. Account/workspace disposal rejects late local picker results. No public URL, fake UUID or premature Storage write is generated. The same native picker dependency/rebuild requirement from the previous composer pass remains; this refactor adds no dependency, permission or build.

Save draft is ViewModel-owned and synchronously guarded. For a new property it uses unchanged physical/location validation and creation service/RPC, accepts a real UUID, binds photo/draft/publication contexts, checks current state, processes queued photos sequentially, then calls the existing draft workflow when listing minimums exist. Pre-UUID listing fields survive binding. A valid property can save even with incomplete listing fields: the UI explicitly says listing details remain local, not backend-saved. Save stays on the composer. Existing properties skip physical creation entirely. Subsequent saves reuse the confirmed property; no combined backend transaction, auto-publication or user-wide Tier 3 lock was added.

Each failure preserves its true boundary: rejected/uncertain property creation retains local form/media, with inline recent-owned-property reconciliation and no duplicate create; uncertain photo upload retains the saved property and confirmed photos, stops the queue and prevents draft save; uncertain draft save retains property/photos and uses existing scoped draft reconciliation. A successful stage is not reported as rolled back merely because a later stage fails. A photo status check never blindly replays an attempted item. Existing durable journals are preserved. A known physical creation error may be corrected explicitly; unknown outcomes remain blocked.

PropertyLocationToolView reuses the original MapTiler search/candidates and MapLibre exact-pin renderer. A temporary React Native Modal overlays the still-mounted composer; confirm/cancel/Android Back return to the same composer without a leave prompt. Native scroll retention is intended through mounting continuity but still requires Android acceptance. No search/provider/renderer/privacy rule changed. Address edits synchronously invalidate exact/public points and captured revisions exactly as before. The deterministic 300m Web Mercator policy remains unchanged and coordinates are never displayed. Property details lock after confirmed creation; editing saved physical details remains outside this backend contract.

Preview works with local pending images before persistence, clearly labeled not saved; it never uses Figma crops or sample ratings for the unified flow. It returns to the composer to save. Publication/sample actions cannot simulate publication for an unsaved real composer. Explicit legacy sample paths remain available for regression compatibility. My Listings remains the owner-backend-backed property portfolio; existing drafts/property-only items open the same composer, and non-draft records keep real management/status surfaces. Active workspace dirty detection covers physical/address/location, local media and listing state. Same-item save prevents competing picker/submit actions; another persisted item's journals remain isolated from Post.

Source additions: components/ComposerPropertyFields.tsx and views/PropertyLocationToolView.tsx. Updated existing composition/workflows/Views and ListingControls; no new model, client, navigation framework or duplicated location/creation service. MVVM review found no View backend calls or service orchestration in UI. No live Supabase action, backend mutation/schema/RPC/RLS/Storage/generated-type change, GPS/OSM/ML/NLP/recommendation/360 implementation, commit/push/merge/deploy or EAS build occurred.

Validation: typecheck PASS; **632 total / 632 passed / 0 failed / 0 skipped / 0 cancelled**. Eleven cases were added over the previous 621, including local gallery binding/disposal, default Post, physical/address section coverage/media-first layout/modal continuity, map state preservation/revision invalidation, ordered Save, rapid duplicate/competing picker exclusion, physical/photo/draft failure boundaries, incomplete listing and safe local preview. Existing portfolio, Tier 2/Tier 3/Admin, privacy/location and publication/lifecycle regressions remain. Expo check still exits 1 for the same three pre-existing patch mismatches; no fixes were installed. Link/whitespace evidence is in the [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#unified-default-post-composer-2026-10-29); backend no-action evidence is in the [ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#unified-composer-local-orchestration-2026-10-29).

Android acceptance: tap Post and immediately see Photos/Property/Location/Listing fields; select several images before saving and verify local thumbnails; fill all fields, map search/adjust/confirm and verify return/scroll/field preservation; edit address and reconfirm; Save once, expect property -> ordered photos -> draft, remaining on composer without Property confirmed/Manage photos/Continue screens. Test incomplete listing wording, property rejection/uncertainty, interrupted photo/draft save and explicit reconciliation without duplicate property, Back/Stay/Leave, native modal Back, larger text, account switching and portfolio reopening. These flows remain RUNTIME-UNVERIFIED.


## Current default Post: Property then Listing Details (2026-10-29)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** The current root flow is Post -> Create (`postingType`) -> Property Listing -> Property (`listingComposer`) -> Listing Details (`listingDetails`) -> Preview. Earlier same-day single-page descriptions are historical. Property contains media first, physical type/details, active backend amenity choices and structured address/location. Listing Details contains a compact property summary, Edit property, title/rent/description, rental terms, deposits/advance/minimum stay, rules and availability. The postingType chooser is active; legacy multi-step property wizard screens remain bypassed after Property Listing selection. Next only navigates; no RPC, upload or metadata write occurs.

Save draft on Listing Details retains the existing ViewModel-owned sequence: validate/create physical property, retain real UUID, sequentially upload selected photos, then save listing draft. Local photos work before UUID; uploads require the confirmed UUID. Existing draft selection opens Listing Details; property-only selection opens Property; non-draft records retain lifecycle/status management. My Listings remains backend-backed. Physical property details remain read-only after persistence. The owner portfolio reads floor number, total floors and maximum occupants alongside its existing safe physical summary, without private coordinates.

Media uses a large 4:3 active image and horizontal thumbnails. Tapping an image/thumbnail opens the shared fullscreen viewer with pinch zoom, panning, double-tap, bounded previous/next buttons and fitted-image horizontal swipes. Active image selection does not change cover or order; Set as cover remains explicit. Closing or Android Back closes the gallery first, preserving files and both-page form state. Image changes reset zoom. The disabled Add 360° interior control is inside Media; 360 is not implemented. Unsupported/non-image verification handling and Admin private signed-URL lifecycle are unchanged.

The map remains a temporary modal over Property and returns there on confirm/cancel/Back. Address revision/privacy policy, dirty state spanning both pages, Stay/Leave and account/workspace invalidation remain. No new dependency was added by this refinement. Existing development clients must already contain the earlier image-picker/MapLibre/gesture dependencies; no rebuild or EAS build was run. No schema, RLS, RPC, Storage configuration or Tier 3 behavior changed.

Android checks: Post opens the chooser, then Property Listing opens Property/media first; choose local photos, open/zoom/pan/swipe/close gallery and use hardware Back; switch thumbnails without changing cover; check long labels/large text. Complete location, Next with no writes, Edit property/Back preserving both pages, Preview then Back to Listing Details. Save once and check property -> photos -> draft, failure reconciliation and duplicate exclusion. Reopen property-only/draft/non-draft portfolio items; test account change, unsaved Stay/Leave and existing verification previews. All new native interactions remain runtime-unverified.

Evidence: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#two-page-post-refinement-2026-10-29) and [backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#two-page-post-local-presentation-2026-10-29).


## Root Post chooser refinement (2026-10-30)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Bottom Post no longer resolves directly to the composer. The retained postingType screen in CreateListingView now shows Create / What would you like to post?, Property Listing / List a property for rent, and disabled Community Post / Share with the RentLease community / Coming soon. It uses the existing shared header/theme and toolbar design. No duplicate chooser, navigation framework or community form/service was added.

The existing root propertiesWorkspace/App role gate is unchanged: only permitted Landlord members reach this property-posting workspace. Tenant-only Post remains restricted by that existing behavior. No Community Post role policy is invented; that option is unavailable for everyone. Tier 3 does not grant Landlord.

Selecting Property Listing navigates into the unchanged Property -> Listing Details -> Preview flow, with the same local media, location confirmation, creation/draft/publication/lifecycle services and validation. The feature toolbar uses a dedicated openPostingType action; direct dashboard Post a property/new property actions retain their previous direct-composer behavior. Existing portfolio/draft restoration and per-item journals remain intact.

For a new creation session, internal Back from Property returns to the chooser and preserves local inputs/media; selecting Property Listing again resumes them. Back/Close out of the chooser uses the existing workspace exit policy and unsaved Stay/Leave guard. Clean root hardware Back uses its existing Discovery return callback; explicit Close uses its existing designated destination. Persisted-property/portfolio and nested listing navigation retain their established behavior. No automatic submission/upload occurs from either choice or Back.

Community Posts remain DEFERRED: no tables/media uploads/likes/comments/follows/ranking/notifications/moderation/persistence. This aligns with For You's future community/feed ownership without connecting posting to that surface. Recommendations/GPS and other separately owned features are unchanged.

Manual Android retest: Landlord bottom Post -> chooser -> Property Listing -> Property -> Listing Details/Preview; Back to Property/chooser, resume dirty fields and photo selections, then test Stay/Leave on actual exit. Test clean chooser Back/Close, disabled Community Post and Tenant-only role restriction. No Android acceptance is claimed from unit tests. Evidence is recorded in the existing continuous implementation history and backend ledger; no new standalone report. Last verified date 2026-10-30; revision baseline 7eb361b plus uncommitted work, not a runtime-verified commit.

## Publication classification and native availability date (2026-10-30)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Publication uncertainty is reserved for an operation that may have crossed the mutation boundary (or an existing unresolved durable journal), not ordinary preflight listing-read failures. A failed preflight SELECT now reports a safe listing/access error and does not send publish_listing or create a pending marker. Known backend validation/authorization rejections retain actionable messages. Transport/invalid receipt and successful RPC followed by failed authoritative reload retain uncertainty and the durable marker. Development-only PUBLICATION-DIAG records stage, sanitized error code, category and rpcSent only; no IDs, raw backend objects, credentials, documents or coordinates.

Check publication status performs an owner/property/listing-scoped read only. It never replays publish_listing. Successful authoritative reconciliation clears the pending marker and recognizes draft, active, paused, rented, archived and removed under existing lifecycle rules. Draft requires a later explicit publish confirmation; active adopts the real Published state. Failed reconciliation retains the marker and unresolved state, with a safe read/access error. Existing duplicate exclusion, account/property identity and stale-response guards remain intact.

The source misclassification and missing authenticated tenancy SELECT grant were confirmed, but the exact stage of the user's Android failure has not been captured. The listings policy references tenancies; tenancy RLS remains enabled with party/Admin-only reads. The narrow SELECT migration is **PREPARED / NOT APPLIED**; no live privilege, RLS or backend definition was changed. Publication may remain blocked until the responsible operator authorizes/applies that correction. See the [backend evidence](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#publication-access-inspection-and-prepared-select-grant-2026-10-30).

AvailabilityDateField replaces raw date typing in ListingDetailsView and the retained legacy CreateListingView availability route. Tapping the restrained outlined control opens the native Android date picker; cancellation leaves state unchanged. Users can select/change a date or Clear date. Availability remains optional; no minimum/maximum or past-date restriction was introduced. Pure AvailabilityDate helpers use local year/month/day and local-noon parsing for display, retaining YYYY-MM-DD in draft.availableDate. Existing p_available_from payload/default-null handling and invalid-string validation are unchanged; localized labels are never persisted.

Dependency: Expo-selected @react-native-community/datetimepicker 9.1.0, package lock and Expo config plugin. Rebuild a development client that lacks this native module before testing. No EAS build was run. MVVM remains View -> existing ViewModel -> service; the date control owns presentation only and has no backend access.

Android acceptance: Listing Details -> calendar -> select/change -> formatted date -> save/reload same calendar date -> clear/save/reload unset; dismiss calendar and test hardware Back, narrow screens and large text. Then test known publication denial, confirmed publication, interrupted post-send response and read-only Check publication status. Inspect PUBLICATION-DIAG if it fails. No Android success is inferred from automated tests. Evidence: [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#publication-runtime-correction-and-native-availability-2026-10-30).


## Required fields, property diagnostics, amenities and completeness (2026-10-31)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Current branch feature/search-discovery-backend-integration, baseline 7eb361b plus preserved uncommitted work in C:/dev/RentLease-Frontend. Historical local-only amenity descriptions above describe earlier checkpoints, not current physical-property creation.

### Required to save

Physical property: supported property type, supported city, barangay, address line 1 and confirmed map location. Listing draft: nonblank title, nonblank description and positive monthly rent. FieldLabel supplies a restrained red asterisk and accessible required wording. The first property/listing validation issue is shown beside its field/section; the disabled Save remains accompanied by visible requirements, including the summary and Edit property action on Listing Details. Numeric/default fields retain valid defaults; optional floor area, occupants, additional address fields, rules and availability remain optional. A short nonblank description can save a draft; 30 or more trimmed Unicode characters earns its completeness contribution, not a new save prerequisite.

### Property creation errors

PropertyCreationError maps only confirmed known backend messages to safe actionable account/role/Tier 1/text/location/amenity guidance. Unknown backend messages are never shown raw. The workflow preserves these messages instead of replacing them all with the old generic fallback. Development-only PROPERTY-CREATE-DIAG contains stage (eligibility/validation/journal/rpc/receipt), sanitized code, classification and rpcSent, without IDs, addresses, coordinates, documents, tokens or raw objects. Preflight/local validation failures send no RPC. Known database rejection is not uncertain. Transport/invalid receipt/unconfirmed post-send result retains the durable journal, duplicate guard, identity/generation checks and explicit reconciliation. No automatic resend or journal removal workaround was added.

The original Android failure was not reproduced by Codex; its exact stage/code still requires the next Android diagnostic attempt. Do not infer a missing text field, MapLibre cause or successful live save from the automated tests.

### Controlled amenities

PropertyAmenityService reads the active amenities catalogue using authenticated SELECT. PropertyAmenityWorkflow owns loading/error/retry, account checks and stale-generation disposal. The ViewModel writes selected unique numeric IDs into DraftProperty.amenityIds; create_property_setup receives those IDs and transactionally creates property_amenities. Empty selection sends []. No guessed IDs, schema changes or direct association writes. Failed catalogue loading shows a retry state and creates no fabricated values.

After property persistence, amenities are read-only in this creation surface: the existing association query returns saved IDs, and RLS remains authoritative. No unsupported property/amenity editing workflow was invented for previously saved properties. Some historical saved associations may no longer be in the active catalogue. For local completeness on a reopened property without a listing row, an owner-scoped SELECT of property_private_locations.property_id checks existence only; no private address/coordinates are returned to the ViewModel or View. Legacy Figma amenity choices remain explicitly sample-local and do not represent backend selection or listing completeness.

### Listing completeness

ListingCompleteness is a pure mirror of the inspected validate_listing_owner trigger, separate from tenant-property recommendation matching. Its current weights are:

| Contribution | Percentage |
| --- | ---: |
| Nonblank listing title | 10% |
| Trimmed description at least 30 characters | 15% |
| Positive monthly rent | 10% |
| Available-from date | 5% |
| Floor area present | 10% |
| Maximum occupants present | 5% |
| Private property location exists | 15% |
| At least one property photo | 20% |
| At least one persisted property amenity | 10% |

Before a matching persisted listing exists, the compact Property/Listing Details/Preview progress is explicitly a local estimate. Local queued photos/selections must actually persist to earn server credit. Once a matching listing is saved/reloaded, its authoritative completeness_score wins, even if the local form differs. Read/reopen the listing to display the latest authoritative stored score; unsaved listing-text changes are not included. Multiple photos/amenities earn their category once. Integer local contributions avoid accumulation errors; authoritative decimal scores display as percentages and the threshold compares raw score >= 0.80. No fake score is written.

80% meets the completeness publication requirement; it does not bypass Tier 1, ownership, property-specific Tier 3, active-property, duplicate listing or other backend checks. Below 80% the server blocks publication; the listing therefore cannot become publicly discoverable through publication. No search boost, recommendation score, ranking multiplier or new authorization gate was added. The future recommendation prototype's safety_rating signal has no landlord-entered create_property_setup field; its trusted source/methodology remains a separate integration decision.

### MapTiler warning

The shared default changes from streets-v2 to streets-v4 through the same encoded style/key URL mechanism. Official MapTiler guidance confirms the replacement: https://docs.maptiler.com/sdk-js/api-reference/variables/Externals.MAP_STYLE_CONFIG/ . The map still receives its style URL and preserves attribution, pin handling and private/public coordinate confirmation.

Safe read-only inspection of the fetched streets-v4 style found version 8, main maptiler_planet_v4 vector source with a TileJSON URL, and maptiler_attribution vector source with neither URL nor tiles. This attribution-only source is a plausible origin of the reported source-must-have-tiles warning; Android correlation is NOT established. Attribution was not removed, style sources were not rewritten and the warning was not suppressed. Native warning disappearance remains UNVERIFIED and may require a provider/native compatibility follow-up. Treat map rendering and create_property_setup failure independently; the existing four-coordinate handoff regressions remain passing.

### Verification and Android acceptance

Typecheck PASS; full automated suite 793 total / 793 passed / 0 failed / 0 skipped / 0 cancelled, 37 added over 756. Android/Hermes export PASS, 1107 modules and .hbc output; this is not a native device test. Expo compatibility check still reports the three existing Expo/location/notifications patch mismatches. No new dependency or native rebuild is required by this pass (the prior date-picker addition may still require a compatible development client).

Android: open Post -> Property Listing, inspect required stars and optional defaults, leave barangay empty and check its inline message, select real amenities, confirm map and all four-coordinate readiness, then Save once. If creation fails, capture PROPERTY-CREATE-DIAG stage/code and safe displayed error. Check description under/over 30 characters, photo +20 and availability +5 in local estimates; save/reload and verify server score wins, then test normal publication and denials. Verify rapid taps, unknown response/restart/reconciliation, account changes, Stay/Leave and existing date picker behavior. Reopen map, move/confirm pin, preserve attribution and inspect Android ParseStyle logs. No Android runtime acceptance is claimed.

Evidence: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#required-fields-amenities-completeness-and-property-diagnostics-2026-10-31) and [backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#property-creation-and-completeness-contract-inspection-2026-10-31).


## Completeness freshness migration - user-reported deployed (2026-10-31)

At the preceding read-only inspection, completeness recalculated only on listing writes. The user now reports that 20261031072616_optimize_listing_completeness_refresh.sql is deployed live. This is external deployment evidence; Codex did not apply or independently re-inspect it in this presentation-only pass. Prior local-test evidence remains historical. The behavior below describes the reviewed migration contract; it does not establish Android runtime acceptance.

Migration: [20261031072616_optimize_listing_completeness_refresh.sql](../../supabase/migrations/20261031072616_optimize_listing_completeness_refresh.sql). It moves the unchanged nine-weight formula into rentlease_completeness.calculate_listing_completeness. The existing listing trigger calls it while retaining ownership, draft-first activation, active score >=0.80 and published_at rules. Internal schema/function access is revoked from PUBLIC/anon/authenticated; no client score or new public refresh RPC exists. Trusted trigger helpers need SECURITY DEFINER because authenticated related-row writers intentionally lack listings UPDATE; calculation itself is invoker-only under the trusted caller. All paths are explicitly qualified with pg_catalog search_path. No RLS or table privilege changes.

The user-reported deployed migration defines row-level AFTER triggers that refresh affected property listings for photo/amenity/private-location INSERT/DELETE and actual parent reassignment; property UPDATE refreshes only changed floor_area_sqm/max_occupants. Address/coordinate edits, photo captions/cover/order and unrelated property updates do not refresh. One helper updates only scores IS DISTINCT FROM the calculation, preserving no-op row/updated_at/WAL behavior. All lifecycle rows use current property completeness, consistent with the old trigger; statuses/history/published_at are not reset or resurrected.

BEFORE triggers serialize completeness-affecting writes using the existing per-property advisory-lock namespace; old/new property keys and listing rows are processed in stable order. Refresh -> listing validation -> read-only calculator has no path back to related writes. The normal live default is READ COMMITTED. Related mutations using old-snapshot REPEATABLE READ/SERIALIZABLE isolation are explicitly rejected rather than claiming advisory locks can refresh their snapshot.

Active invariant: losing critical related data that would lower an active listing below 80% makes normal listing validation raise; PostgreSQL rolls back the entire related mutation. No silent stale/high score, invalid active score or automatic lifecycle change. The existing photo service deletes metadata before its Storage object, so a denied metadata deletion retains the object. The operator/user must use existing lifecycle actions before intentionally removing critical data. This pass does not redesign photo error/recovery UI.

A one-time backfill refreshes existing scores. A separate calculated-score preflight aborts deployment for ANY already-invalid active listing, even when its stored score already equals that invalid calculation. Resolve through existing authorized lifecycle actions and retry; do not auto-pause/archive in the migration. Migration transaction rollback was tested for both stale and already-current invalid active fixtures.

Indexes are reused, not added. Live indexes cover property PK, private-location PK, photo property/order, amenity property/amenity and listings property. Local normal EXPLAIN on tiny fixtures sometimes chose sequential scans; transaction-local enable_seqscan=off confirmed existing index eligibility, not a production benchmark or forced planner setting.

Local evidence: 74/74 pgTAP assertions, 4/4 real concurrency/deployment/isolation checks, SQL lint with no schema errors. Frontend typecheck and 793/793 tests remain passing. Final fixture advisors report six WARNs: five test-policy auth_rls_initplan notices and the copied baseline set_updated_at mutable search_path; no new completeness-helper warning/error. Initial test-extension/ACL fixture issues were corrected, not production permissions. Live advisor baseline also retains existing callable SECURITY DEFINER and leaked-password-protection warnings; no unrelated repair was performed.

The preceding backend preparation pass left frontend components, models, services, journals, generated types and package files unchanged. Existing local-estimate/server-after-read contract remains; no realtime subscription or new automatic UI reload was added. Under that deployed contract, backend stored scores refresh without a manual listing save; an already-rendered screen still needs its existing authoritative read/reopen to display a later server value. Android/live end-to-end acceptance remains UNVERIFIED. Recommendation matching, ranking, safety ratings and all unrelated features remain untouched.

Evidence/reproduction: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#backend-completeness-freshness-local-tested-migration-2026-10-31), [backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#completeness-freshness-migration-local-test-only-2026-10-31), [isolated test instructions](../../supabase/test-support/README.md). The tenancy SELECT migration was not applied by Codex; the user subsequently reports it is deployed live. No permanent live backend mutation, commit/push/merge/deploy/EAS build occurred.


## Contextual completeness guidance (2026-10-31)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Presentation-only refinement on feature/search-discovery-backend-integration. Listing completeness remains a compact title, percentage, bar and status with local-estimate/saved-score and 80%/other-requirements explanations. It no longer renders the detached individual task checklist.

The existing ListingCompleteness contribution array now exposes stable factor keys alongside its existing labels, weights and completion booleans. The same array still calculates the local estimate; server percentage selection and threshold behavior are unchanged. CompletenessHint renders a single neutral ui.supporting text line from that metadata, with no formula or percentage literals in Views. Completed hints return null. Individual field completion comes from the existing known form/property/media state, not an inference from the aggregate server score.

Guidance locations:

| Control/section | Contextual contribution |
| --- | --- |
| Property photos header | At least one property photo, +20% |
| Location required section | Confirmed property location, +15% |
| Floor area input | +10% |
| Maximum occupants input | +5% |
| Active amenity selection | At least one amenity, +10% |
| Listing title input | +10% |
| Monthly rent input | +10% |
| Description input | At least 30 characters, +15% |
| Optional availability date control | +5% |

Description guidance replaces the previous always-visible static helper and disappears at the existing 30-character condition. Location guidance does not use typed address presence; it uses the existing confirmed-location condition. Local selected photos/amenities satisfy the local action, while the existing local-estimate explanation still says they must persist to count on the server. Read-only saved-property physical/location/amenity controls suppress unfinished hints because those fields cannot be changed in this creation surface. Optional fields remain optional.

ListingField now accepts a ReactNode helper as well as text, allowing the same tiny hint component to appear next to inputs without an empty helper wrapper when complete. No new cards, badges, animations, fonts, colors, dependencies or navigation were introduced; text wraps and retains normal font scaling.

No behavior beyond guidance placement/copy/visibility changed. Score conditions, weights, persisted server precedence, 80% publication behavior, validation, save/upload/submission services, journals, Tier 3, maps and navigation remain untouched. Protected-file hashes confirmed all 64 pre-existing backend/service/workflow/ViewModel/shared-service files unchanged. No Supabase tool call or backend operation occurred. The reported external completeness deployment is recorded separately in the ledger, not attributed to this pass.

Manual Android: scroll Property and Listing Details, confirm the summary has no detached list, find each hint beside its control, select a photo, confirm the actual map location and cross 29/30 description characters. Hints should disappear once satisfied and reappear when an editable value is cleared. Check optional fields, saved read-only property, narrow screens/large text, unchanged percentage after server reload, and normal Back/Stay/Leave/Save/Publish. Android visual/runtime acceptance remains unverified; no native rebuild is required by this JS-only change.

Evidence: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#contextual-completeness-guidance-2026-10-31) and [deployment provenance](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#external-completeness-deployment-report-and-presentation-only-pass-2026-10-31).


## Property creation rejection investigation (2026-10-31)

Status: diagnostic improvement IMPLEMENTED / AUTOMATED-TESTED; Android retest required. User-provided Android `[PROPERTY-CREATE-DIAG]` identifies `stage=rpc`, `rpcSent=true`, `code=23514`, `classification=rejected`. This is a PostgreSQL CHECK constraint rejection inside `create_property_setup`, not a local completeness failure or post-save reload failure. The rejected transaction rolls back, including any property/private-location/amenity writes. This does not establish whether a different, earlier request created a property.

The initial diagnostic discarded the constraint identity. A subsequent Android diagnostic confirmed properties_floor_numbers; the frontend floor-validation correction is documented below. Do not label a particular field or the deployed completeness migration as the cause without that evidence. Read-only inspection found 9 properties, newest `2026-10-30 04:09:14.818225+00`; no October 31 persisted property was observed. Aggregate evidence is not account-specific reconciliation.

Save routes through ListingDetailsView -> composed ViewModel `saveComposerDraft` -> propertyCreation workflow `submit(true)` -> typed creation service -> `create_property_setup`. Legacy PropertySetup review uses the same workflow. Payload construction validates and maps all four confirmed coordinates explicitly, backend property/city/furnishing enums, real amenity IDs, numeric physical fields and optional text. It supplies no trusted landlord ID. Source and regression tests confirm mapping; the failed Android payload itself was not captured, so its precise values cannot be reconstructed. The live RPC signature matches the generated contract and returns the expected JSON object.

Development diagnostics now include operation, stage, SQLSTATE, classified message, outcome, and an allowlisted constraint name when available. Arbitrary backend messages and row-containing details are never logged. Known SQL rejections remain confirmed failures; transport/receipt failures retain uncertainty and durable journals. No retry, submission, completeness formula/hint, publication threshold, location confirmation, RLS or navigation behavior changed. See the existing backend ledger for live inspection evidence.


## Saved-property workflow continuity (2026-10-31)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED AFTER REPAIR.** The user confirmed successful physical-property creation and a real UUID on Android. This verifies creation only, not photo upload, draft save, publication or the repaired transitions. At workflow-repair time the earlier CHECK constraint was still unknown. A subsequent Android diagnostic identified properties_floor_numbers; see the floor-validation correction below. The intervening successful attempt did not itself establish the cause.

### Active journey and state ownership

| Surface | Current behavior |
| --- | --- |
| Post chooser | Property Listing enters the existing Property composer; Community Post stays unavailable |
| Property | Local/saved photos, physical details, amenities and existing map confirmation; Next retains local state and performs no writes |
| Listing details | Rental fields, explicit coordinated Save draft and Preview; returning to Property retains listing edits |
| Preview / publication confirmation | Existing saved-draft and property-specific Tier 3 publication checks; no automatic publication |
| My Listings | Reopens the owned property/draft/status with its actual UUID; no return to creation is needed |
| Advanced photo management | Optional existing manager for order, alt text, cover and deletion; Done returns through existing history |
| Legacy/recovery property confirmation | One Continue with this property action returns to the composer; redundant photos/draft/new-property/verification detours removed |

App.tsx owns the mounted account-scoped workspace. The feature ViewModel remains mounted during its internal screen changes. Its active workspace property ID is authoritative for photos, draft, publication and lifecycle workflows; the creation receipt is a separate durable recovery fact. The confirmed UUID is now adopted synchronously at relevant navigation boundaries, as well as by the existing render effect. A rapid transition cannot skip the handoff. Receipt-only restoration can hydrate the public physical summary through the existing owner portfolio read, without creating a property or fetching private coordinates.

### Confirmed defects and intentional boundaries

- A failed photo assertContext previously reset the entire photo state, including propertyId. Workspace ID did not change, so its binding effect did not rerun. Check photo status then called load with no ID and silently returned. The repaired workflow clears prior media/local selections on unverified access but retains the opaque property binding and remembered owner. Recovery must reacquire and revalidate context; a confirmed different owner clears the binding. Generations reject old results and durable service journals remain intact.
- Initial draft hydration previously overwrote locally entered rental fields. Load/adopt now merges only untouched fields against the previous confirmed baseline. Local differences remain dirty; explicit save accepts the authoritative returned row. The hydration updater is pure under React development replay. Saved draft data and physical-property state remain separate.
- Photo status checking already performed real owner-scoped metadata reads and pending-operation reconciliation, not a fake action. Recovery labels now say Check saved photos or Retry loading photos, and success notices are visible in the primary media section. Recovery stays contextual; no always-visible refresh button was added. Existing journal-based cleanup/reconciliation is unchanged, and no upload is replayed automatically.
- Saved physical details/amenities are intentionally read-only here. The existing feature has no supported physical-property edit operation; direct authenticated properties UPDATE is unavailable. The UI uses a compact saved summary and states that limitation instead of presenting a wall of disabled creation fields or promising an edit path. Listing details labels the return action Property and photos for a saved property.
- Tier 3 does not gate owner photos or draft editing. Read-only rental controls now explain actual loading, uncertain status, inactive-property or non-draft lifecycle conditions. Known property-specific verification status is shown contextually; publication remains backend-authoritative. No rule locks ordinary editing merely because verification is pending.

### Completeness interpretation

There is one unchanged listing-publication formula, not a separate physical-property percentage. Property now explicitly says the displayed score includes the later rental details. A property-only local estimate can correctly be 40% (floor area 10 + occupants 5 + location 15 + amenities 10), with title/description/rent/date/photos still absent. Persisted listing scores remain authoritative; local queued media and unsaved text are not server credit. An old 100% estimate followed by 40% can therefore reflect different saved/local inputs, but the historical Android fields were not captured, so that exact score transition cannot be reconstructed conclusively. The proven hydration loss is fixed; no formula, 80% threshold or contextual hint was changed.

### Verification and limits

Typecheck PASS; npm test **812 total / 812 passed / 0 failed / 0 skipped / 0 cancelled**. Three regressions reproduced before fixes: immediate UUID handoff, recoverable photo-context failure and hydration preservation. Additional coverage includes receipt rehydration, pending/approved Tier 3 independence, read-only presentation, visible photo-reconciliation feedback and the same 40-to-80 contribution calculation across internal navigation. Existing Back/Stay/Leave, account/disposal, queue uncertainty, publication and lifecycle tests remain passing.

Android acceptance: create once -> retain UUID -> manage/upload photos -> Listing details -> Save draft -> Preview; Back preserves inputs. Leave/reopen My Listings -> same property and saved draft/photos. Retry an interrupted photo read using Check saved photos; verify visible results and no replacement property/automatic upload. Repeat with pending and approved property-specific Tier 3, unsaved Stay/Leave, account switch, narrow screen and large text. Successful downstream native/live operations remain unverified. No dependencies or native rebuild were added by this JS-only repair.

Evidence: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#saved-property-workflow-repair-2026-10-31), [backend policy inspection](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#saved-property-workflow-policy-inspection-2026-10-31).


## Property floor validation and save reliability (2026-10-31)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** The user supplied a definitive create_property_setup rejection: SQLSTATE 23514, properties_floor_numbers, confirmed_failed. The deployed CHECK permits either floor value to be NULL, otherwise floor_number <= total_floors. No values were swapped or defaulted incorrectly: the missing frontend cross-field relationship allowed an individually valid but incompatible pair to reach the RPC.

The pure DraftProperty propertyFloorIssues helper validates each supplied floor and the pair. It drives immediate per-field feedback independently of other incomplete required fields, the creation workflow/Next guard, coordinated Save eligibility and service payload validation. The RPC is not sent for an invalid pair. Correcting a floor preserves all other draft values and confirmed location; existing concurrent-submit guards and confirmed UUID/journals remain unchanged.

Both active Property and legacy PropertySetup/Review reuse PropertyFloorFields, now contextual to property type as described below, with wrapping optional controls and the 2nd-floor/5-story example. Placeholders are examples only; optional state remains blank. Unit numbers remain in the address. Ground-floor value 0 remains accepted as before; standalone properties can omit either or both fields. No basement/numbering convention or inferred building default was introduced. Review shows section errors and a correction summary; an invalid Save moves to the affected fields without an RPC.

RPC mapping remains floorNumber -> p_floor_number and totalFloors -> p_total_floors. Blank/whitespace-only optional numbers are omitted, using backend NULL defaults; missing floors never become zero. A known backend floor CHECK rejection also receives the same safe actionable message rather than generic Save failure.

Scoped reliability inspection confirmed smallint bedrooms/floors/occupants, bathrooms numeric(4,1), floor_area_sqm numeric(10,2), and the existing nonnegative/positive CHECKs. Model validation now catches numeric overflow after storage-scale rounding and positive floor areas that would round to zero. Valid payload numbers are not rounded or rewritten by the client. Existing enums, four confirmed coordinates, selected real amenity IDs, trimmed required text and optional fields retain their current mapping. Safety rating is server-owned, not a creation input. Backend authorization and catalogue freshness remain authoritative and can still reject stale access/amenities; no frontend validation promises backend success.

Evidence: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#floor-validation-and-save-reliability-2026-10-31), [contract ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#floor-validation-contract-inspection-2026-10-31). Completeness weights/80% threshold, photos, Tier 3, map/privacy, publication/lifecycle, dependencies and all backend objects are unchanged. No native rebuild required for this JavaScript-only fix.

Android acceptance: enter floor 6/building 5 and confirm both inline errors plus blocked Next/Save without an RPC diagnostic; change to 2/5 and verify other inputs/location persist. Test equal floors, ground floor 0, either/both blank and Review correction. Save once, rapidly tap again, then verify one persisted UUID. This repair is not yet Android runtime-verified.

Floor-fix final validation: npm run typecheck PASS; npm test 827 total / 827 passed / 0 failed / 0 skipped / 0 cancelled (15 added over 812). git diff --check PASS; documentation links/anchors 80 checked / 0 errors; protected backend/service/generated/maps/package/root file hashes 107 checked / 0 changed. New floor component and validation remain Android RUNTIME-UNVERIFIED.


## Property-type-aware floors and discoverable validation (2026-10-31)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** American English (en-US) is now the repository default for new/modified frontend text, tests and documentation, recorded in AGENTS.md. Existing technical identifiers and Philippine currency/time-zone behavior are unchanged. Historical evidence is not rewritten for spelling alone.

### Floor semantics

| Backend property_type | Optional presentation | RPC mapping |
| --- | --- | --- |
| house | Number of stories; no unit-floor control | totalFloors -> p_total_floors; p_floor_number omitted, using its NULL default |
| apartment, condominium | Unit's floor; Floors in building | Existing floorNumber / totalFloors mappings |
| room | Room's floor; Floors in building | Existing optional mappings |
| bedspace | Space's floor; Floors in building | Existing optional mappings |
| studio | Studio's floor; Floors in building | Existing optional mappings |
| boarding_house, dormitory, other | Rental floor; Floors in building; leave rental floor blank if it does not apply | Existing optional mappings; no assumption that the whole building is a single unit |

Switching to house keeps any previous floorNumber entry locally, clearly discloses that it is not sent for a whole house, and restores it when switching back. It is excluded from active validation/payload/display while inapplicable, not erased or converted into a building height. totalFloors remains independently editable and is retained. Both fields may be omitted; no fake defaults or new unit-number field exist. Applicable ground-floor 0 is preserved. The backend relationship still applies whenever both applicable values are sent.

### One validation source and correction path

DraftProperty now exposes all PropertyValidationIssue records with field, section, required/invalid kind and safe message. draftPropertyError/draftPropertyIssue and payload validation consume that same source. The floor helper still supplies affected-field markers, while the shared floor component deduplicates identical messages into one section-level accessible error. Invalid controls receive a visible border and accessibility hint, retaining full text scaling.

The subsequent Stage 1 simplification below removes the PropertyValidationSummary checklist from ordinary Property and Review/Save presentation, retaining the same validation metadata and correction targets. Required information is distinguished from inconsistent entries; percentage completeness is never treated as validation or persistence success. The completeness status copy now describes completeness items/threshold, not unconditional readiness to publish. Weights, server-score precedence and the 80% threshold are untouched.

A valid clickable Save is no longer the only way to discover errors: attempting Save with invalid property data sets a ViewModel correction intent and performs no write. From Listing Details it returns to Property; legacy Review moves to details/address as appropriate. The compact footer review action selects the first invalid field; Next now requires all physical-property validation to pass. Floor errors remain contextual. Entered property/listing/media values are preserved. Operational busy/uncertain/access guards still disable conflicting actions.

usePropertyFormFocus owns presentation-only native refs: section measurement against the scroll content, scrolling to the target, focus for mounted text inputs and an accessibility announcement. Choice-only sections are scrolled/announced without opening an unrelated keyboard. Request cleanup, editing, workspace replacement and unmount invalidate delayed focus. Native measurement failure falls back to announcing the error; actual Android scrolling/keyboard/TalkBack behavior remains unverified. ViewModels own the target/navigation, never native refs or backend queries.

### Validation and acceptance

Typecheck and full frontend tests pass; exact totals are recorded in the implementation history. Coverage includes house/condo/unit mappings, blank values, cross-field relationships, type-switch preservation, grouped summaries, single shared messages, composer/legacy Review correction, no-RPC failure, stale focus callbacks and retained account/workspace protection. No dependency or native rebuild added. No changes to tables, RPCs, RLS, Storage, photo management, location confirmation, Tier 3, listing draft persistence or lifecycle workflows.

Android: switch apartment 8/2 -> house (stories only, prior entry retained) -> apartment (8/2 restored and one error); correct to 2/5. Try either/both values blank. With an offscreen missing address or invalid floor, tap Save or a summary section and verify the right screen/section/input appears, text is announced once and all other values remain. Repeat on legacy Review, with large text/narrow screens, keyboard open, Back/Stay/Leave and account change. Finally save once and verify the same normal backend workflow. No runtime acceptance is claimed.

Evidence: [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#property-type-aware-floors-and-validation-navigation-2026-10-31), [backend boundary record](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#contextual-floor-frontend-boundary-2026-10-31).

Contextual-floor final verification: npm run typecheck PASS; npm test 845 total / 845 passed / 0 failed / 0 skipped / 0 cancelled (18 added over 827). git diff --check PASS; documentation links/anchors 83 checked / 0 errors; protected file hashes 107 checked / 0 changed. ComposerRecoveryFeedback.tsx also suppresses duplicate current section-validation notices while preserving actual backend errors. Android native scrolling, input focus and accessibility remain RUNTIME-UNVERIFIED.


## Stage 1 - Contextual validation and Property Next readiness (2026-10-31)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** The large Before saving the property checklist is no longer rendered by Property, Listing Details or legacy Property Setup/Review. Its earlier source/test evidence is retained; validation rules were not removed or replaced.

The existing property-creation workflow owns ephemeral touchedFields and validationAttempted state. Input edits mark that field touched; successful/opened location confirmation marks location interaction, and explicit review/progression attempts reveal errors. The ViewModel filters the same PropertyValidationIssue metadata for visible feedback. An untouched form stays neutral, while the footer explains why progression is unavailable. When a condition becomes valid its error disappears automatically, even though the touch marker remains. Floor relationships share one section error and highlight affected inputs. Required choice groups, address inputs and actual map-confirmation area use restrained borders/plain helper text, not warning cards.

The actual inspected source had Next inside the scroll body. ListingWizardScaffold now supports an optional action-only footer, used by PropertyProgressFooter to keep the existing Next action available below the scroll region. No listing completeness meter was moved into the footer. Disabled Next uses the existing neutral style with readable text and an explicit accessibility disabled state. One short neutral readiness message remains visible; when correction is possible it is an accessible Review field action using the existing ViewModel focus/navigation mechanism. It is not another checklist. It cannot start a write.

### Readiness and persistence

- New property: Next is enabled only after setup loads and the existing propertyValidationIssues set is empty, with no busy or uncertain creation operation. This includes supported type/city, required address, four confirmed map coordinates, current numeric/cross-field checks and valid selected IDs. Optional fields remain optional.
- Existing owned property selection: the known workspace property UUID supplies the persisted-property context; an empty creation form is not revalidated as a new property. Existing ownership/account, busy and downstream read-only guards remain.
- Next still performs local navigation to Listing Details. It does not create a property, upload photos, save a draft, publish or claim success. The existing explicit Save action later coordinates property creation and retains the Supabase-confirmed UUID before dependent writes. The ready message explicitly states when the property has not been saved yet.
- Readiness never uses listing completeness or its 80% publication threshold. A valid physical-property form with a low listing completeness estimate can proceed; an invalid property with a high estimate cannot.
- A programmatic/stale invalid Next call is revalidated synchronously, stays on Property, exposes contextual errors and sends no RPC. The disabled native action still has the separate footer correction explanation. Existing Back/Stay/Leave, identity/generation, uncertain-outcome and duplicate-write safeguards remain.

### Scope and verification

Stage 1 did not implement the later stages. Stage 2 is implemented in the follow-up section below; Stage 3 asynchronous listing-draft saving remains DEFERRED. No backend, model validation rule, property-type mapping, photo operation, map coordinate workflow, Tier 3 rule, listing-draft service, publication or lifecycle change occurred. No dependency/native rebuild was added.

Automated coverage includes untouched neutrality, touched required errors, correction clearing, optional floors, location confirmation, model-based disabled/enabled Next independent of percentage, preserved data, no-RPC progression, persistent-footer separation from scrolling content and an accessible correction action. Full results are in the implementation history. Android keyboard/scrolling/TalkBack/large-text layout remain RUNTIME-UNVERIFIED, not inferred from local presentation mocks.

Android: open a fresh Property form and confirm no blanket red fields/checklist, a gray Next and a short explanation. Edit/clear a required field, select an invalid floor pair, correct it, and invalidate/reconfirm the map. Use Review field while Next is disabled and verify the relevant field is shown/focused. Once required data is valid, Next enables and opens Listing Details with all values retained and no saved claim. Explicit Save should still confirm the real property UUID normally. Repeat with keyboard open near the last address field, 150-200% text, TalkBack, Stay/Leave and account replacement.

Evidence: [Stage 1 implementation](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#stage-1---simplified-property-validation-and-next-readiness-2026-10-31), [backend boundary](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#stage-1-validation-presentation-only-boundary-2026-10-31).

Stage 1 final verification, 2026-11-01 (Asia/Singapore): npm run typecheck PASS; npm test 855 total / 855 passed / 0 failed / 0 skipped / 0 cancelled, 10 added over 845. git diff --check PASS; documentation links/anchors 86 checked / 0 errors; protected file hashes 107 checked / 0 changed. tests/propertyCreation.test.ts also updates its old unused-import assertion to check metadata-driven location feedback; existing required-location/no-RPC tests remain. No new dependency or native build. Android keyboard, scrolling, TalkBack and large-text acceptance remain RUNTIME-UNVERIFIED. At Stage 1 completion both later stages were deferred; Stage 2 is now covered below, while Stage 3 remains deferred.


## Stage 2 - Persistent completeness footer (2026-11-01)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** Property no longer renders the large inline ListingCompletenessSummary or its repeated property-versus-listing explanation. Existing contextual hints remain at the same fields. Listing Details and Preview retain their current summary and Save/publication actions; this stage does not replace a draft Save with Next.

PropertyProgressFooter extends the existing Stage 1 persistent action surface: Listing completeness percentage, thin progress bar, a 48dp information control and Next: Listing. Only blocked progression shows the short Stage 1 readiness guidance/Review field action. Readiness remains supplied by the ViewModel's physical-property validation, not the displayed percentage. The footer reads the same completeness percent/source; no recalculation, new source or score write exists.

The information control expands a bounded, scrollable explanation above the compact footer row. Four concise points cover local estimate versus backend-confirmed score, property/photos/listing contributions, the existing 80% publication minimum, and separate property-specific Tier 3/other publication checks. Backend-confirmed wording explicitly excludes unsaved changes. No contribution checklist, large card, overlay, new modal or navigation destination is added.

Expansion is presentation-only useState inside the footer. It does not call a ViewModel workflow, mutate form state, create/upload/save, or refresh backend status. Tapping the same information control closes it. The button has an accessible label, expanded state and expansion/collapse announcements; its decorative icon is hidden from accessibility traversal. Native Back continues to use the existing feature history and Stay/Leave handling, with no new Back subscription or dismissal interception.

The existing scaffold remains unchanged: footer is outside the form scroll area and consumes layout space rather than overlaying controls. The explanation is capped at the lesser of 180dp and 25% of current window height, with its own ScrollView and normal text scaling. It does not explicitly dismiss the keyboard; its scroll view retains handled taps and keyboardDismissMode none. The primary action remains outside the information scroll region. Actual device keyboard resizing, TalkBack traversal and enlarged-text layout still need Android acceptance.

Validation: npm run typecheck PASS; npm test **862 total / 862 passed / 0 failed / 0 skipped / 0 cancelled**, 7 added over 855. Tests exercise footer data/source, open/close state and announcements, unchanged draft snapshots/no write callbacks, accurate backend/local copy, high percentage with disabled Next, hidden unnecessary guidance, removal of the large Property summary, retained contextual hint bindings and bounded small-window panel layout. Existing Stage 1/readiness/save/publish/exit/account tests remain passing. These local mocks are not Android runtime evidence.

Android: scroll Property to its final input and verify the footer stays available; expand/collapse information while editing and confirm values remain. Test a low percentage with a valid property and a high percentage with invalid property data; only validation controls Next. Check a saved backend score after reopening, keyboard shown, 320dp width, 150-200% text, TalkBack expand/collapse/traversal and existing Back/Stay/Leave. Confirm the explanation scrolls without covering Next or the final form control. Continue to Listing Details and verify its existing Save behavior. No native rebuild required by this JS-only change.

Stage 3 asynchronous draft saving remains DEFERRED. No validation/model, property-type/floor, map/privacy, UUID handoff, photo, hydration, completeness weight/server precedence/threshold, Tier 3, service/RPC/RLS/Storage, dependency or navigation architecture change occurred. No backend interaction, commit, push, merge, deployment or EAS build.

Evidence: [Stage 2 implementation](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#stage-2---persistent-completeness-footer-2026-11-01), [backend boundary record](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#stage-2-completeness-footer-presentation-boundary-2026-11-01).

Stage 2 final checks (2026-11-01): typecheck PASS; npm test 862 passed / 0 failed / 0 skipped / 0 cancelled. git diff --check PASS; documentation links/anchors 88 checked / 0 errors. Stage-2-specific SHA256 snapshot: 101 model/service/workflow/backend/map/package/root/scaffold/hint/Listing Details/Preview files checked / 0 changed. The earlier broader protection snapshot also passes 107 checked / 0 changed. All previous uncommitted work remains. No automatic Git publication or native build.


## Stage 3 - Responsive listing draft saving (2026-11-01)

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** This supersedes the earlier Stage 3 deferral, preserving the dated Stage 1/2 evidence.

Save draft immediately displays inline saving feedback. Scrolling and reading remain available; edits, competing operations and ordinary Back/Close exits stay guarded while saving. The composed ViewModel snapshots the submitted listing fields and retains the active property context. Duplicate requests are blocked synchronously. No background queue or process-termination saving guarantee is introduced.

Only a validated `save_listing_draft` receipt followed by an authoritative owner-scoped reload can open **Listing Draft Saved!**. Open saved listing uses the existing saved preview; My Listings and hardware Back return to the portfolio. This is draft confirmation, distinct from physical-property creation and publication. Incomplete/unverified drafts remain drafts. The confirmation receipt is scoped to the workspace generation and saved IDs; stale/disposed responses cannot navigate another workspace.

Failures retain entered fields in the editor. Existing accessible FeedbackNotice appears near Save. Known save failures offer Retry saving draft; loading failures retain Retry loading draft. Unknown outcomes offer Check draft save status, retaining the durable journal until authoritative reconciliation. Reconciliation never resends the RPC and never claims that the timed-out payload was applied or opens the new success destination merely from a read. User review and another explicit save are required when appropriate.

Development-only `[LISTING-DRAFT-DIAG]` reports operation, safe stage, validated SQLSTATE and not-sent/confirmed-failed/uncertain outcome. Diagnostic messages are fixed safe categories; arbitrary backend details, form values, credentials and coordinates are omitted. Original backend errors remain private Error causes where propagated, not user-facing strings. Diagnostic callback failure cannot change the save result.

No completeness formula, server precedence, 80% publication threshold, property-specific Tier 3 rule, property creation, MapTiler, photos, publication/lifecycle contract, dependency or backend configuration changed. Existing unsaved Stay/Leave and account-keyed disposal safeguards remain. Reopen the saved draft through the existing owner portfolio flow.

Android acceptance: Save an edited draft -> immediate feedback with one request -> confirmed success -> Open saved listing -> retained saved fields. Return to My Listings and reopen the same draft. Repeat known rejection/retry, unknown network response/Check draft save status, Back/Close during save, Stay/Leave after failure, account switch and narrow-screen/large-text/TalkBack use. Verify saving never publishes. No native rebuild is required by this JavaScript-only change.

Evidence: [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#stage-3---responsive-listing-draft-saving-2026-11-01), [backend boundary record](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#stage-3-draft-save-presentation-and-diagnostics-2026-11-01).

Stage 3 final validation (2026-11-01): npm run typecheck PASS (exit 0); npm test 871 total / 871 passed / 0 failed / 0 skipped / 0 cancelled (9 additional tests over Stage 2 baseline 862); git diff --check and staged whitespace check PASS; documentation links/anchors 90 checked / 0 errors; protected-file comparison 106 checked / 0 changed, excluding explicitly authorized draft-save files. No package/configuration changes in this stage; no dependency/native rebuild required. Existing working tree remains intentionally uncommitted, including unrelated prior work. Android RUNTIME-UNVERIFIED.


## Stage 2 follow-up - Shared Listing Details footer (2026-11-01)

Listing Details now uses the existing PropertyProgressFooter in ListingWizardScaffold's persistent footer slot. The component accepts an optional action and contextual guidance; Property Creation retains its existing Next: Listing behavior unchanged. One implementation owns percentage/progress semantics, accessible information control, local/server explanation and the bounded upward-expanding panel. No second completeness calculation or independently maintained footer was introduced.

The large inline completeness summary is removed from Listing Details. Field-specific hints remain alongside title, rent, description and availability. Save Draft, saving feedback, contextual guidance and existing retry/read-only reconciliation are in the persistent footer; Preview remains in the scrollable form. The scaffold allocates the footer below its flexing ScrollView, rather than overlaying inputs or bottom navigation. Existing keyboard tap behavior and root safe-area/keyboard handling are reused. Expanded information remains capped to a quarter of viewport height or 180 points and scrolls independently for large text.

Action readiness comes from composerSaveDisabled, not completeness or Tier 3. Stage 3's snapshot, synchronous duplicate guard, confirmed-save destination, preserved failure fields, account/workspace guards and uncertainty journal remain unchanged. Expansion is presentation-only state and performs no workflow writes. No model, ViewModel, service, backend, dependency or navigation architecture change.

Android RUNTIME-UNVERIFIED. Check Property -> Listing Details state preservation; footer visibility at both scroll ends; information open/close without field changes; keyboard with the final inputs, bottom tabs, narrow screens, large fonts and TalkBack. Repeat Save Draft -> immediate feedback -> backend-confirmed Listing Draft Saved!, known failure/retry and uncertain Check draft save status. Saving remains distinct from publication.

Shared-footer follow-up validation: typecheck PASS; npm test 873 total / 873 passed / 0 failed / 0 skipped / 0 cancelled (2 new regressions over 871). New tests failed before implementation; two existing presentation fixtures were updated to include the real draft-state contract, without changing their field/hint assertions. git diff --check and staged check PASS; documentation links 90 checked / 0 errors; protected hashes 315 checked / 0 changed (all source except the two authorized UI files, backend files and package/configuration). Files changed this pass: components/PropertyProgressFooter.tsx, views/ListingDetailsView.tsx, tests/propertyWorkspacePresentation.test.ts and the three continuous Property & Listing documents. MVVM review: presentation-only props/local expansion state; no View service calls or workflow changes. Skills applied/read in this continuing session: RentLease feature implementation, MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer, and Impeccable. No dependency/rebuild, live backend action, commit, push, merge, deployment or EAS build. Android RUNTIME-UNVERIFIED.


## Publication discoverability inspection (2026-11-01)

Read-only local source inspection, no live backend access or publication behavior change. A saved draft remains draft after Tier 3 approval by design. Current reachable route is My Listings -> Continue draft -> Listing Details -> Preview listing -> Review publication -> Publish listing confirmation. PropertyDashboardView exposes Continue draft, ListingDetailsView exposes Preview listing, and ListingPreviewView exposes Review publication and the explicit final Publish listing action. The composed ViewModel coordinates requestPublish/confirmPublish, and the existing service calls publish_listing with p_listing_id only.

Verified UI cause: publication is indirect and has no explicitly labeled entry action on the portfolio or Listing Details. This establishes a discoverability defect, not proof of the particular Android record failing backend eligibility. The publicationEligibility model checks saved property/draft identity, unresolved saves and unchanged persisted fields; it does not gate publication on the portfolio's Tier 3 label. The label is based on the selected portfolio item and may be stale until a portfolio reload, but that label alone does not block the RPC. Actual account/property-specific approval, completeness, access or other server denial cannot be determined without the attempt/result. No claim of live eligibility is made.

Proposed minimal solution for a subsequent authorized change: expose Review publication on Listing Details for a saved draft, using the existing requestPublish and confirmation path; explain unchanged-save prerequisites contextually. Preserve explicit landlord confirmation and authoritative backend 80%, property-specific Tier 3, ownership and other checks. No automatic publication. Proposal only; no publication code changed. Existing pull-to-refresh My Listings can refresh the displayed verification status.


## Direct publication review from Listing Details (2026-11-01)

This implements the preceding discoverability proposal. Existing saved drafts now show **Review Publication** directly in Listing Details, alongside Preview, above the unchanged persistent Save Draft footer. The action delegates to requestPublish and the existing publishConfirmation destination; no new screen or RPC is introduced. It is absent before a real draft exists and for non-draft records.

Unsaved listing edits produce the existing save-first error, preserving fields and preventing publication of the older saved payload. Save Draft retains its Stage 3 confirmation/recovery flow; return through the saved preview or My Listings and review again. No automatic save, discard or publication is performed.

A compact derived presentation distinguishes Draft, Ready for publication review and Active. Ready for publication review is explicitly not proof of publication eligibility and is never persisted as a database status. It uses unchanged saved fields and backend-confirmed completeness, not local estimates or account-level Tier 3 labels. A below-80% saved score receives concise add-details/save guidance; every review still warns that property-specific Tier 3 approval and all other checks are verified when publishing. Review remains reachable for incomplete drafts so authoritative rejection can be explained; saving does not acquire new requirements. Existing backend errors for property-specific Tier 3, access, duplicate live listings and other requirements remain actionable. The completeness rejection now explicitly says 80% and directs users to add details and save.

Publication errors are visible on Listing Details through the existing item-scoped feedback component, rather than hidden until Preview. Existing read-only status reconciliation is retained, with no blind retry. A successful publish still requires validated receipt plus owner-scoped authoritative reload; adoption invalidates the portfolio, which refreshes on return to My Listings. Existing active/lifecycle restoration prevents reopening a published row as a replacement draft.

Changed source: models/ListingPublication.ts (pure presentation summary and safe error wording), viewModels/usePropertyListingViewModel.ts (summary/action busy binding), components/ListingWorkspaceFeedback.tsx (visible publication errors), views/ListingDetailsView.tsx (direct action and concise guidance). Tests: listingPublication.test.ts, propertyWorkspacePresentation.test.ts, propertyExitGuard.test.ts. The publication service/workflow, backend contracts and thresholds remain unchanged. Strict MVVM retained: Views bind actions; pure model maps presentation; existing ViewModel/workflow/service own coordination and access. No dependency/native rebuild.

Android RUNTIME-UNVERIFIED. Reopen saved draft -> Review Publication -> explicit confirmation. Test unsaved edits (preserved/save-first), incomplete saved score, missing property-specific Tier 3, approved property with other unmet requirements, valid Publish -> authoritative published status -> My Listings refresh -> reopen Active listing. Repeat rapid confirmation taps, network interruption/status reconciliation, account switching, persistent footer and large-text/narrow-screen layout. No live publish or RLS validation was performed by Codex.

Final publication discoverability validation (2026-11-01): npm run typecheck PASS; npm test 879 total / 879 passed / 0 failed / 0 skipped / 0 cancelled, 5 added over 874. New direct-entry/readiness tests failed before implementation. The actual ViewModel regression covers unsaved edit retention, explicit save, review confirmation without an RPC, resolved blocker cleanup and confirmed Active adoption. Existing rejection/Tier 3/completeness/eligible/uncertain/duplicate/stale/reopen tests remain passing. Whitespace and staged check PASS; documentation links 90 checked / 0 errors; protected source/backend/package hashes 313 checked / 0 changed. Publication service/workflow, persistence, completeness formula, MapTiler, photos and Tier 3 contracts are unchanged. No live backend test or Android acceptance is claimed. Applied all eight RentLease SKILL.md files read in this continuing session (feature implementation, MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer) and Impeccable guidance. No dependency or build, commit, push, merge, deployment or EAS build.
