# XGBoost handoff reconciliation and Phase 2 design

November 8, 2026. Phase 1 local implementation; Phase 2 DESIGN ONLY. No production writes, schema/Edge deployment, model-artifact changes, secret retrieval, commit/push or build. Baseline d079ec07b751695f0c7dd1d4026d06fc3c961f2c; unrelated local work preserved.

## Authority and provenance

Read all three pages of Downloads/RentLease_Landlord_Listing_and_Tenant_Search_Handout (1).pdf. It cites train_20261103_145157_071221 and a November 3 export. The pinned repository commit dee06f16fe182361b1d9d7e6ecf35f41703bf1a6 instead records train_20261106_140356_301784, using clean_20261103_145130_022013. These identify different training runs; sharing a cleaning date does not establish identical fitted artifacts or performance. The handout's 74.15% within 30%, PHP 13,583.73 MAE and 998-row holdout must not be attributed to the November 6 fit without matching evaluation evidence.

Technical authority is the pinned model_metadata.json plus fitted adapter/preprocessing contract, MODEL_INTEGRATION.md and unchanged reference_predictions.json. Metadata confirms two groups (house, apartment_condominium), eight numeric inputs, four categorical inputs and 68 amenity labels. Median imputation/missing indicators and the fitted encoder remain server-owned; log1p is inverted by expm1 exactly once server-side. The adapter accepts original house/apartment/condominium requests, maps the latter two to the combined group, and validates subtype separately. Its subtype allowlist is API taxonomy, not proof each subtype was well represented in fitted training.

The handout's two app roles do not override the deployed unified-account model. Its posting/search requirements are proposals, not authorization to change publication, verification or tenancy rules. Read-only function inventory shows rental-price-estimate ACTIVE version 1, verify_jwt=true; legacy estimate-rental-price ACTIVE version 8. The user reports successful end-to-end Android inference for the existing integration. No fresh inference was attempted here, and a broad modelVersion label/metadata inventory does not attest which artifacts are loaded on Render. New Phase 1 changes remain runtime-unverified.

## Gap matrix

| Topic | Verified current behavior | Phase 1 / remaining action |
| --- | --- | --- |
| Model groups | Three accepted original parent labels route to two fitted groups | Preserve compatible requests. Phase 2 exposes derived groups, not nine independent prediction models. |
| Subtype | Broad type is the legacy fallback; no stored subtype column | Preserve fallback now; explicit subtype design below. Never guess a parent from standalone room/studio. |
| Coordinates | Proxy selects no location; both inputs null | Unchanged. Third-party use of even public approximate points requires reviewed access/privacy policy. |
| Lot/parking | No corresponding property columns; null inference values | Nullable optional fields proposed; no garage/parking-count inference from amenity presence. |
| Bed/bath | DB NOT NULL defaults 0; former new form also prefilled 0 | New draft starts blank and existing required validation requires an answer. Explicit 0 remains valid. Legacy zeros are not rewritten. |
| Floor area | Nullable property field; positive value required only for inference | Keep saving optional and show explanation/review warnings. No publication threshold change. |
| Amenities | 16 active labels; five direct lowercase vocabulary matches | Explicit three-alias mapping adds three more known labels. Unknown labels remain stored and are omitted only from inference features. |
| Suspicious data | DB-valid test measurements can produce misleading estimates | Nonblocking review heuristics; no claim of fitted input limits or model accuracy gain. |
| Tenant scope | Marketplace includes other types, optional filters, asking-rent budget | Preserve search and recommendation scope; prediction eligibility is narrower. No Render calls to filter rentals. |

## Exact catalog amenity mapping

| Catalog label | Inference token |
| --- | --- |
| Wi-Fi | wifi |
| Air Conditioning | air conditioning |
| Balcony | balcony |
| Swimming Pool | swimming pool |
| Gym | gym |
| Elevator | lift |
| CCTV | cctv |
| 24/7 Security | 24 hours security |
| Parking, Kitchen, Laundry Area, Gated Property, Water Heater, Backup Generator, Pet Friendly, Common Area | No defensible fitted token from the label alone |

No fuzzy matching. Parking does not establish garage or a space count; Kitchen does not establish equipped/integral kitchen; Laundry Area need not be a room; a gate does not establish fully fenced; water heating is not dwelling heating. Do not infer internet/security/guardhouse in addition to selected labels. All exact fitted vocabulary terms remain valid, case/whitespace normalized and deduplicated. Null amenities retain model missingness; a known empty or unknown-only list yields no positive learned flags. Catalog IDs, labels and property associations are unchanged.

## Phase 1 behavior

New count fields start unanswered; required validation prevents Number('') becoming a saved zero. Explicit zero remains valid and old saved zero is retained. Missing optional numeric inputs (including blank strings at the mapper boundary) remain null, never fabricated zeros; invalid supplied nonblank numeric strings/booleans/nonfinite/negative values remain rejected. Positive floor area remains an estimator prerequisite, not a new saving/publication prerequisite.

Shared pure measurement warnings are derived by the Property ViewModel and estimator service, not by backend clients in Views. Review floor area below 10 or above 1,000 sqm, bed/bath count above 20, and floor area below 5 sqm per bedroom. These transparent product sanity heuristics are not training quantiles, legal minimums, model validity bounds or hard blockers. Zero counts receive a confirmation reminder because older records may contain defaults. No record is clamped, corrected, suppressed, repriced or unpublished. Asking rent remains separate from model features and output. User-facing warnings appear in property setup and selected estimator context.

## Phase 2: backward-compatible proposal (not implemented)

### Taxonomy and optional data

Retain existing properties.property_type and its marketplace enum. Expose a derived prediction_group: house -> house; apartment/condominium -> apartment_condominium; all other types -> unknown/ineligible. Do not store a redundant group column initially. Add nullable property_subtype text, lot_area_sqm numeric and parking_spaces integer through a separately approved migration. No default zero. Check finite nonnegative lot area and nonnegative integral parking (using existing numeric precision/range conventions); leave null for unknown. Null subtype means not explicitly recorded, not a fabricated subtype.

Allowed subtype pairs by derived group: house = house/townhouse/beach_house/villa; combined = apartment/room/condominium/studio/loft/penthouse/condotel. Phase 2 proxy would use the canonical group request supported by the adapter and explicit stored subtype. This avoids forcing combined-group subtypes into the narrower legacy apartment request allowlist. General business type remains available for listing/search distinction. Standalone room/studio legacy rows stay unsupported until owner confirmation and product rental-scope policy establish a valid parent; changing physical property type must use existing identity-correction/Tier 3 safeguards, never a silent relabel.

### Existing records and rollout

Add nullable columns without mass backfill. Do not infer a room parent, lot size from floor area, parking count from Parking, or exact confirmation from old zeros. Existing original RPCs and clients continue to operate. New clients clearly distinguish confirmed fields and missing data; add reviewed provenance/confirmation metadata if historical count certainty must be persisted. New zero entries in Phase 1 are explicit form answers, but old zeros cannot be retrospectively classified. No automatic zero-to-null conversion or retroactive publication withdrawal.

Provide new unambiguous versioned RPC names, for example create_property_setup_v2 and update_property_details_v2, rather than breaking existing signatures or adding ambiguous PostgREST overloads. Creation must atomically preserve current owner/Tier 1/location checks and save the optional fields; routine updates retain lock/version/receipt/idempotency protections. Schema migration, generated types, RPC signatures, clients and tests roll out backend-first under separate authorization. New proxy feature use must degrade to current requests when fields are absent; compare old/new inference behavior before changing unknown-subtype fallback. No direct table write shortcut.

### Property forms, editing and publication

Keep marketplace type controls and add dependent subtype selection in the supported estimation section. House and Apartment-Condominium are model-facing groups, not replacements for all general marketplace types. Optional lot/parking inputs explain sqm/count, blank unknown and explicit 0. Reuse saved fields for estimation without re-entry. Review whether changed subtype/lot boundaries identify a different physical rental; route material identity changes through correction/re-verification. Do not bypass open-tenancy material-field freezes, immutable evidence, reservation commitments or exact-property Tier 3.

Retain existing publication/completeness calculations and thresholds initially; optional model attributes must not secretly reduce existing completeness or block publication. Making floor area a mandatory publication input is a separate product/backend policy change requiring explicit approval, legacy handling and tests. Never make predicted rent a condition of publication or overwrite asking rent.

### Location/privacy boundary

Preferred future input is the already approved approximate public_location cell center, not exact_location or device-current coordinates. This task did not read location values. Sending an approximate point to Render is still external processing and needs notice/purpose/access review; public visibility is not automatic consent for inference. Define eligible record/version and owner/public-listing authorization, explicit location-confirmation provenance and opt-out/missing behavior before enabling. Use a narrow caller-scoped projection deriving latitude=ST_Y and longitude=ST_X from the approved public point only, never SELECT private location tables. Invalid, stale, unauthorized or unapproved points remain null. Do not add precision, synthesize address coordinates, send addresses/contact data or claim improved accuracy from approximate points without actual evaluation. Any exact-coordinate alternative requires separate security/privacy approval and is not proposed for automatic use.

### Tenant search compatibility

Keep Any defaults and existing broader property types. A future model-group filter can translate combined to existing apartment OR condominium, with a separate optional subtype predicate; do not silently exclude other listing types from Any. Null lot/parking/subtype remain unknown. A minimum parking filter requires known stored counts, not model-imputed counts or a Parking amenity. Existing amenity filtering continues on the complete catalog, including model-unknown terms. Budget always uses asking_rent_monthly; proximity/OSM/verification and availability remain independent. Implement new filters only after safe backend support, not through unbounded frontend filtering.

## Validation and later deployment

Pinned three reference fixtures and expected amounts are unchanged (condominium PHP 22,433.353515625; apartment PHP 39,733.69921875; house PHP 26,632.958984375 before API rounding). Tests validate transport, mapping, units and fixtures; the trained booster was not run and no accuracy improvement is claimed. Phase 2 requires parent/subtype matrix, nullable/zero rules, old/new client compatibility, concurrent/versioned edits, tenancy/Tier 3 protections, filter semantics and zero private-coordinate exposure tests before any migration proposal is executable.

Phase 1 shared mapper changes also affect the Edge bundle: deploy only rental-price-estimate after separate approval, preserving legacy estimate-rental-price and server secrets. No Phase 2 migration is prepared. Validate sanitized native packaging, a real authorized prediction, denied cases and Android count/warning flows for this revision before release. Do not retrain/refit artifacts, replay migrations or treat the earlier user-observed Android success as acceptance of these new local changes.
