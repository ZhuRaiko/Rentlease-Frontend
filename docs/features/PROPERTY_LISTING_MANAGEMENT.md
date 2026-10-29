# Property & Listing Management

## Purpose

Manage landlord-owned physical properties, ordinary property media, later listing drafts/publication/lifecycle, and their integration boundaries. A physical property is distinct from a marketplace listing. Creating a property does not create a listing, publish it or submit Tier 3 verification.

## Scope and actor ownership

Phases 1-5 were implemented on feature/property-listing-management. The current exact-location integration branch is feature/maptiler-property-location (current baseline ab15285 plus uncommitted composer/portfolio work). Active Tier 1 Landlords may use physical-property setup; Tier 3 is not a creation prerequisite. The ordinary-photo frontend exposes signed-in owner management only. Backend policies also recognize Admin management, but this feature adds no Admin interface. Authentication owns the account/session snapshot; this feature revalidates identity/ownership and owns its local form/media workflows.

Phases 1-5 are **IMPLEMENTED / AUTOMATED-TESTED**. The pre-map Phase 1 blocked-location Android path was **RUNTIME-VERIFIED** as user-reported; map rendering/style/pin/review is now user-reported **Android PARTIALLY RUNTIME-VERIFIED**; successful property, ordinary-photo and listing-draft persistence remain **RUNTIME-UNVERIFIED**. The approved public-location rule and complete Phase 1 handoff are implemented/automated-tested; successful Android creation remains unverified; ordinary photos require a real persisted property UUID. Phase 3 listing draft saves/loads are implemented behind the persisted-property prerequisite. Normal My Listings now uses the owned-property portfolio. Explicit sample publication/lifecycle paths remain PREVIEW and do not power the portfolio. Real saved drafts have explicit RPC publication and a separate backend-confirmed status screen with landlord pause/reactivate/archive controls.

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

Normal Post opens ListingComposerView immediately, before any property UUID. Physical/address fields are on Property; listing terms are on Listing Details. Next changes pages without persisting. PropertySetupView details/address/review/created steps remain legacy/recovery presentation, not the default Post path. It collects physical type, structured city/barangay/address, private access instructions, bedrooms, bathrooms, optional floor area/floor number/total floors/max occupants and furnishing. Floor area is not automatically land area. Display labels are separate from backend identifiers:

| Domain | Backend values |
| --- | --- |
| property_type | apartment, boarding_house, bedspace, room, studio, condominium, house, dormitory, other |
| cavite_city | imus, dasmarinas, tagaytay |
| furnishing_status | unfurnished, semi_furnished, furnished |

Creation uses **`public.create_property_setup(...)` only**. Required generated arguments are `p_property_type`, `p_city`, `p_barangay`, `p_address_line_1`, `p_public_lat`, `p_public_lng`, `p_exact_lat`, `p_exact_lng`. Optional physical/text fields are explicitly mapped, blank optionals omitted and `p_amenity_ids` is `[]` in this phase. The controlled amenity catalogue is not connected; no guessed IDs are sent. No direct INSERT into `properties`, `property_private_locations` or `property_amenities` is used. The RPC derives landlord identity and creates those records transactionally; validated JSON `{property_id: UUID, status: 'created'}` becomes ViewModel `propertyId`.

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

Normal Post opens `listingComposer` before property creation; successful property persistence does not change screens. Its large active preview and thumbnail gallery are the primary photo surface; `photoManager` is secondary for ordering, descriptions and recovery. Both legacy `photoUpload` and `photoManager` render `PropertyPhotosView`. Gallery selection can queue local photos without a UUID. Only backend upload requires a real workspace property UUID, supplied by confirmed creation or an owner-authorized portfolio selection, never a preview ID. The legacy advanced manager still requires a saved property. Android upload still requires a successfully persisted property UUID; public-location policy is now implemented, but Android creation/upload acceptance remains unverified.

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

Backend authority: active Tier 1 Landlord identity, owned listing, permitted current status and no active tenancy are checked by every lifecycle RPC. Reactivation additionally checks an active owned property, qualifying approved Tier 3 for that exact property, no competing active/paused/rented listing and trigger-recomputed 80% completeness. No TypeScript completeness formula or account-wide Tier 3 gate was added. Errors are normalized to safe transition, tenancy, Tier 3, completeness, duplicate or access messages.

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

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED.** The default flow is Property (`listingComposer`) -> Listing Details (`listingDetails`) -> Preview. Earlier same-day single-page descriptions are historical. Property contains media first, physical type/details, local-only amenities and structured address/location. Listing Details contains a compact property summary, Edit property, title/rent/description, rental terms, deposits/advance/minimum stay, rules and availability. Legacy wizard screens are bypassed in normal Post. Next only navigates; no RPC, upload or metadata write occurs.

Save draft on Listing Details retains the existing ViewModel-owned sequence: validate/create physical property, retain real UUID, sequentially upload selected photos, then save listing draft. Local photos work before UUID; uploads require the confirmed UUID. Existing draft selection opens Listing Details; property-only selection opens Property; non-draft records retain lifecycle/status management. My Listings remains backend-backed. Physical property details remain read-only after persistence. The owner portfolio reads floor number, total floors and maximum occupants alongside its existing safe physical summary, without private coordinates.

Media uses a large 4:3 active image and horizontal thumbnails. Tapping an image/thumbnail opens the shared fullscreen viewer with pinch zoom, panning, double-tap, bounded previous/next buttons and fitted-image horizontal swipes. Active image selection does not change cover or order; Set as cover remains explicit. Closing or Android Back closes the gallery first, preserving files and both-page form state. Image changes reset zoom. The disabled Add 360° interior control is inside Media; 360 is not implemented. Unsupported/non-image verification handling and Admin private signed-URL lifecycle are unchanged.

The map remains a temporary modal over Property and returns there on confirm/cancel/Back. Address revision/privacy policy, dirty state spanning both pages, Stay/Leave and account/workspace invalidation remain. No new dependency was added by this refinement. Existing development clients must already contain the earlier image-picker/MapLibre/gesture dependencies; no rebuild or EAS build was run. No schema, RLS, RPC, Storage configuration or Tier 3 behavior changed.

Android checks: Post opens Property/media first; choose local photos, open/zoom/pan/swipe/close gallery and use hardware Back; switch thumbnails without changing cover; check long labels/large text. Complete location, Next with no writes, Edit property/Back preserving both pages, Preview then Back to Listing Details. Save once and check property -> photos -> draft, failure reconciliation and duplicate exclusion. Reopen property-only/draft/non-draft portfolio items; test account change, unsaved Stay/Leave and existing verification previews. All new native interactions remain runtime-unverified.

Evidence: [implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#two-page-post-refinement-2026-10-29) and [backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#two-page-post-local-presentation-2026-10-29).
