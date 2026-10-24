# Property & Listing Management

## Purpose

Manage landlord-owned physical properties, ordinary property media, later listing drafts/publication/lifecycle, and their integration boundaries. A physical property is distinct from a marketplace listing. Creating a property does not create a listing, publish it or submit Tier 3 verification.

## Scope and actor ownership

The current branch is `feature/property-listing-management`. Active Tier 1 Landlords may use physical-property setup; Tier 3 is not a creation prerequisite. The ordinary-photo frontend exposes signed-in owner management only. Backend policies also recognize Admin management, but this feature adds no Admin interface. Authentication owns the account/session snapshot; this feature revalidates identity/ownership and owns its local form/media workflows.

Phases 1 and 2 are **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**. New app saves remain blocked by external location integration; ordinary photos require a real persisted property UUID. Phase 3 listing draft saves/loads are implemented behind the persisted-property prerequisite. Dashboard fixtures and publication/lifecycle screens remain PREVIEW; they are separate from a confirmed backend draft.

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
| Models | `models/DraftProperty.ts`, `models/PropertyPhoto.ts`, `models/PersistedListingDraft.ts`, preview `models/PropertyListing.ts`, `models/listingNavigation.ts` |
| ViewModel/workflows | `viewModels/usePropertyListingViewModel.ts`, `viewModels/propertyCreationWorkflow.ts`, `viewModels/propertyPhotoWorkflow.ts`, `viewModels/listingDraftWorkflow.ts` |
| Creation service/composition | `services/propertyCreationService.ts`, `services/propertyCreationDependencies.ts` |
| Listing draft service/composition | `services/listingDraftService.ts`, `services/listingDraftDependencies.ts` |
| Photo service/device composition | `services/propertyPhotoService.ts`, `services/propertyPhotoDependencies.ts` |
| Views | `views/PropertySetupView.tsx`, `views/PropertyPhotosView.tsx`, `views/CreateListingView.tsx`, `views/PropertyListingFlowView.tsx`, `views/ListingManagementView.tsx`, `views/ListingPreviewView.tsx`, `views/PropertyDashboardView.tsx` |
| Presentation reuse | `components/ListingWizardScaffold.tsx`, `components/ListingControls.tsx`, `components/ListingButton.tsx` and shared theme/feedback/navigation confirmation |

Tests: `tests/propertyCreation.test.ts`, `tests/propertyPhotos.test.ts`, `tests/listingDraftPersistence.test.ts`, `tests/propertyExitGuard.test.ts`, `tests/marketplaceWiring.test.ts` plus existing navigation/verification regressions. Shared backend entry: `src/shared/services/supabase/client.ts`; structural types: `src/shared/services/supabase/database.types.ts`.

## Phase 1 - Physical Property Creation

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**.

Post -> A physical property -> propertySetup uses details/address/review/created steps. It collects physical type, structured city/barangay/address, private access instructions, bedrooms, bathrooms, optional floor area/floor number/total floors/max occupants and furnishing. Floor area is not automatically land area. Display labels are separate from backend identifiers:

| Domain | Backend values |
| --- | --- |
| property_type | apartment, boarding_house, bedspace, room, studio, condominium, house, dormitory, other |
| cavite_city | imus, dasmarinas, tagaytay |
| furnishing_status | unfurnished, semi_furnished, furnished |

Creation uses **`public.create_property_setup(...)` only**. Required generated arguments are `p_property_type`, `p_city`, `p_barangay`, `p_address_line_1`, `p_public_lat`, `p_public_lng`, `p_exact_lat`, `p_exact_lng`. Optional physical/text fields are explicitly mapped, blank optionals omitted and `p_amenity_ids` is `[]` in this phase. The controlled amenity catalogue is not connected; no guessed IDs are sent. No direct INSERT into `properties`, `property_private_locations` or `property_amenities` is used. The RPC derives landlord identity and creates those records transactionally; validated JSON `{property_id: UUID, status: 'created'}` becomes ViewModel `propertyId`.

The backend requires authenticated/active/Landlord/Tier 1, **not Tier 3**. An external backend test confirmed creation by a Tier 1 landlord without Tier 3; that is not Android acceptance. Attribution, the remaining inactive test fixture and cleanup limits are in [ledger P1-01 through P1-03](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#p1-01-codex-physical-property-contract-inspection).

### External location dependency and blocked save

The service contract requires four distinct numbers: `exactLatitude`, `exactLongitude`, `publicLatitude`, `publicLongitude`. Incomplete local drafts retain null values. The future location workflow may supply confirmed exact and approved generalized public points through `provideConfirmedLocation(location, expectedAddressRevision)`. Address edits clear all four values and increment `locationRevision`; stale confirmations are ignored.

There is no current production supplier of these values. Review remains available, while final creation is disabled with the non-error notice **"Confirm the property location before saving."** No coordinate derivation, hardcoded coordinate, exact-to-public substitution, manual latitude/longitude entry or Maps/GPS implementation is added in this branch. The existing shared MapTiler/geocoding service remains unchanged. Full Android property persistence is pending the separately owned location integration.

### UUID, uncertainty and navigation

Successful creation retains the real UUID for photo management/later listing work. The unchanged Tier 3 owned-property query can later find the property without cross-feature ViewModel coupling; no automatic Tier 3 submission occurs. The dashboard still shows listing previews, not a newly connected owned-property browser.

A synchronous guard, identity/generation checks and account-scoped AsyncStorage receipt journal protect against duplicate local attempts/stale results. Pending is recorded before the RPC; confirmed receipts retain only UUID/status, not address/coordinates/tokens. Restore rechecks ownership. Unknown network/result outcomes block blind retries across restart; users can check at most ten recent owned properties and explicitly recognize a record, followed by an ownership recheck. Absence is not proof that creation failed. No backend idempotency key or cross-device exactly-once guarantee exists. Starting another property clears only a confirmed receipt, not an uncertain one.

Ordinary internal Back retains local progress; existing Stay/Leave protects draft exits. Busy operations block guarded exits. Keep local progress does not claim Supabase persistence and is not a durable full-form draft save.

## Phase 2 - Ordinary Property Photos

**IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED**.

Property confirmed -> Manage property photos opens `photoManager`. Both `photoUpload` and `photoManager` render `PropertyPhotosView`. Photo selection/upload requires `propertyId` from confirmed creation/receipt restore, never a preview listing ID or a production test UUID. Without it, controls are unavailable with a saved-property explanation. Therefore Android upload depends on the same unresolved external location integration for a newly created property.

### Picker, limits and Storage contract

The existing Expo DocumentPicker is reused: `multiple:false`, `copyToCacheDirectory:true`, MIME filters `image/jpeg`, `image/png`, `image/webp`. Selection is local until explicit Upload photo. MIME/reported size are validated; Expo `File.arrayBuffer()` provides binary data whose actual size is rechecked. Maximum file size is **10,485,760 bytes (10 MB)**; at most **10 ordinary photos** per property. The persisted count drives the integrated UI and disables further selection/upload at ten; the backend serialized limit trigger remains authoritative.

Bucket: **`property-media`**, currently public. Object key:

```text
<owner_uuid>/<property_uuid>/<photo_uuid>.<extension>
```

Expo Crypto generates photo UUIDs before upload. New extensions are jpg/png/webp; reading also accepts existing .jpeg paths. Uploads use `upsert:false`. Photos must not contain verification documents, private access instructions or sensitive data.

Metadata table: **`property_photos`**, with id, property_id, storage_path, nullable alt_text, sort_order, is_cover and created_at. Existing metadata uses `property-media/<owner>/<property>/<photo>.<extension>`; new metadata deliberately preserves that convention. Storage methods receive the normalized bucket-relative object key, never a doubled bucket prefix. Reads accept prefixed/relative paths only after namespace validation. Display URLs are derived through Storage `getPublicUrl`; they are not persisted in storage_path or logged. Verification's private bucket/signed URLs remain unchanged.

### Upload, cover, ordering and alt text

Upload rechecks owner/count, journals a unique operation ID/path, uploads binary data, registers metadata, then reloads authoritative photos. The old sample action assigning photoCount=4 is removed; integrated counts are derived from persisted rows. When a real property is bound, the listing preview uses its real photo instead of a Figma sample. Separate listing fixtures remain explicit previews.

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

A real propertyState.propertyId, nonblank title, nonblank description and positive monthly asking rent are required before account persistence. Before that boundary, Keep local progress retains the existing session-local snapshot and explicitly says it is not saved to the account. No placeholder title/description/rent/UUID is sent. Once minimum fields exist, the action is labeled Save listing draft to account and validates the remaining supported fields before using the RPC. Invalid optional values block the save rather than silently claiming local/backend success. Success wording follows the confirmed response and authoritative reload, not optimistic local status changes.

The saved-property UUID remains the externally owned location prerequisite: new Android property creation is still blocked until confirmed exact/public points are supplied. Phase 3 does not implement Maps/GPS or add manual property-ID entry. No real app persistence is claimed from tests. Existing creation receipts can supply a known UUID; the dashboard exposes Edit account listing draft/Continue listing draft for that current property, not a new unrestricted listing browser.

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

On a confirmed property UUID, the service loads only property_id=current UUID, landlord_id=authenticated owner and status=draft, ordered created_at DESC then id DESC, limited to one. RLS remains authoritative. It confirms active ownership and current identity; authoritative listing fields populate the existing form without changing physical-property details or reference. Backend-loaded values become the confirmed form snapshot. Saves and loads use busy/generation/account guards; field edits and workspace exits are blocked during these operations. The prior unsaved-exit fix remains in place.

A per-account/property AsyncStorage pending marker is written before the RPC, storing no title/description/credentials. Workflow and service guards prevent rapid duplicate saves. Unknown RPC result, invalid result or post-save reload failure leaves the marker, uncertain state and last-confirmed data intact, blocks another save and exposes Load current backend draft to reconcile. Reconciliation reads rather than automatically writing: it loads CURRENT backend state, which may not contain the attempted changes, and explicitly asks the user to review before another save. A missing row leaves the outcome uncertain; it does not trigger a blind create. Markers survive reopen; journal loss/reinstall and cross-device edits are not exactly-once or conflict-resolution guarantees. Known SQL validation/authorization failures permit explicit correction after safe marker cleanup. Account/property changes/disposal ignore late responses.

### Draft-only and authorization boundary

Authenticated listings table privileges are SELECT only; the frontend performs no direct INSERT/UPDATE/DELETE and asks for no broad grants. Existing RLS permits own-draft reads. The RPC requires authenticated active Tier 1 Landlord membership and an active owned property. Its SECURITY DEFINER/search_path/EXECUTE contract and external tests are recorded in [Phase 3 backend ledger](../implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md#phase-3---listing-draft-persistence-recorded-2026-10-24). External function creation is not attributed to Codex. The advisor's authenticated SECURITY DEFINER finding is expected for this controlled entry point and is not a reason to expose table writes.

Backend status remains draft; local published/unavailable fixture labels are not backend values. Publication controls remain explicitly preview-only and make no backend calls. No Tier 3 publication gate, lifecycle, one-active-listing enforcement, moderation or publication completeness rule is implemented. Full Phase 4/5 work and all seven teammate-owned integrations remain deferred.

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

This branch may expose clean integration boundaries but must not duplicate or take ownership of these features. Ordinary photos do not constitute 360 support.

## Planned Property & Listing phases

| Phase | Current boundary |
| --- | --- |
| Phase 1 - physical property creation foundation | Implemented/automated-tested; Android persistence pending location integration |
| Phase 2 - ordinary property photos | Implemented/automated-tested; runtime requires saved UUID |
| Phase 3 - listing draft persistence | Implemented/automated-tested; Android runtime blocked by persisted-property prerequisite |
| Phase 4 - publication workflow | NOT STARTED |
| Phase 5 - listing lifecycle | NOT STARTED |
| Later integration with separately owned features | DEFERRED |

Listing draft writes use save_listing_draft only; direct listings INSERT/UPDATE, publication and real lifecycle are not connected. The previously recorded backend publication gap for property-specific Tier 3 enforcement must be confirmed/resolved by an authorized backend operator before Phase 4; account-wide Tier 3 timestamps are not a substitute. Phase 3 is now integrated as documented above; Phase 4/5 remain NOT STARTED.

## Runtime unsaved-exit correction (2026-10-24)

The user reports that the initial Android blocked-save flow passed, but the dirty Property Setup unsaved-exit dialog initially failed to appear. That failure supersedes earlier broad source/unit-test assumptions about runtime exit protection. Blocked-save acceptance is limited to that tested behavior; full property/photo persistence remains location-gated.

This pass corrected reproducible navigation defects: the guard previously received a render-time boolean and could see the previous clean snapshot when a workflow changed before React committed; confirmed Listings-root exit retained the dirty physical draft; retained exit callbacks could run after workspace/account unmount. The guard now accepts a live predicate for property/photo workflow state (while retaining boolean compatibility elsewhere), and the Property ViewModel funnels real exits through one mounted/busy-checked request function. Confirmed discard clears only local property/photo edits and restores the legacy draft snapshot; it does not clear durable operation journals, forget a confirmed property UUID, create a property or upload photos. Unmount cancels pending intent and stale callbacks cannot navigate.

Exit-path audit: Discover, Chat, Tenancy and explicit Close already called the ViewModel request wrapper; Listings/root Back used the shared guard directly and now use the same feature wrapper for discard/lifecycle semantics. There was no unconditional direct bottom-tab bypass to replace. The reproduced clean-snapshot branch could execute an exit immediately without a prompt. Review -> address -> details remains internal and unprompted. Details -> posting type retains the physical draft; the next posting-type/root exit is guarded. Stay/cancel preserves inputs and never navigates; Leave executes the first requested destination once. Shared NavigationConfirmation still maps Android Back to cancel. No screen redesign or new native navigation mechanism is introduced.

Automated evidence: npm run typecheck PASS; npm test **351/351 PASS**, 0 failed/skipped/cancelled; git diff --check PASS. Eleven new integration-style tests execute the actual PropertyListingFlowView callbacks, Property ViewModel, creation/photo workflows and shared guard with controlled hook scheduling and replaced native/backend dependencies. They reproduce the pre-render dirty-state gap, exercise internal/root Back, Stay/Leave, duplicate requests, Listings discard, clean exit and stale unmounted intents. These are not native React/Android rendering tests. The earlier source assertion was updated to recognize the guarded feature wrapper; behavioral coverage replaces reliance on that regex alone.

Corrected behavior: **RUNTIME-UNVERIFIED AFTER FIX** until the user retests Android. Retest dirty details -> posting type -> hardware Back; Discover/Listings/Chat/Tenancy/Close; Stay, Leave, repeated taps and Android Back on the dialog. Verify internal review/address Back preserves values without prompting, no immediate re-prompt after confirmed Listings discard, and account/workspace replacement cannot execute an old pending destination. The agent did not reproduce the native dialog visually, so Android acceptance is not claimed.

No live backend action was performed and no ledger change was needed for that bugfix. Phase 3 was NOT STARTED at that point; its later implementation is documented above. See the [continuous implementation history](../implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md#runtime-bugfix---unsaved-workspace-exit-2026-10-24).

## Runtime verification and known limitations

Last documentation/source review: **2026-10-24**. Current bugfix validation is recorded above; historical phase evidence follows: Phase 1 typecheck and 310/310 tests passed; Phase 2 typecheck and 340/340 tests passed (30 new photo tests), zero failures/skips/cancellations; whitespace passed. These are prior implementation-run results, **not rerun in this documentation-only pass**. Baseline `a827827` plus uncommitted Phase 2 work is not a verified Phase 2 commit. Full phase Android acceptance remains **RUNTIME-UNVERIFIED**; the user-reported blocked-save PASS and unsaved-exit failure/fix are scoped above. Full app creation/photo persistence remains location-gated.

Existing Expo compatibility drift remains: expo 57.0.30 expects ~57.0.31, expo-location 57.0.21 expects ~57.0.22, expo-notifications 57.0.23 expects ~57.0.24. No dependencies were changed. No new native dependency/rebuild was introduced for photos. Historical pre-final-refactor Android JavaScript/Hermes export (940 modules) was bundle validation only, not a final device/runtime test.

Manual Android checks: first verify review shows the non-error blocked-save state and no create RPC. After separately authorized location integration, verify Tier 1/non-Tier 3 creation yields one real owned UUID, no listing, and visibility in unchanged Tier 3 selection. Then test picker cancellation, explicit upload/reopen, supported/oversized/unsupported files, ten-photo limit, cover/order/alt text, cover deletion and both metadata/Storage cleanup. Exercise network loss at each non-atomic stage, status reconciliation without duplicates, remount/account switching/non-owner denial, Back/Stay/Leave, narrow Android screens and font scaling. Use separately authorized new fixtures; do not alter existing verification test records.

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
