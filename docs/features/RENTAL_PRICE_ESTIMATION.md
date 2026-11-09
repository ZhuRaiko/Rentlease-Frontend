# Rental Price Estimation

## Status - November 8, 2026

Existing rental-price-estimate is externally deployed ACTIVE version 1 with verify_jwt=true (read-only inventory November 8). The user reports a successful end-to-end Android prediction for that integration. The Phase 1 fidelity changes below are IMPLEMENTED / AUTOMATED-TESTED locally, uncommitted, and not deployed or Android-accepted. Previous Render reachability observations are historical, not a blocker used to rebuild the integration. No production writes, migrations, model-artifact changes or secret retrieval in this phase.

## Source-verified contract

Reviewed `main.py`, `model_adapter.py`, `MODEL_INTEGRATION.md`, `models/model_metadata.json`, and `models/reference_predictions.json` at [dee06f16fe182361b1d9d7e6ecf35f41703bf1a6](https://github.com/johnkamantig/Rentlease-Features/tree/dee06f16fe182361b1d9d7e6ecf35f41703bf1a6). Source requires a private `ML_SHARED_SECRET` bearer token on `POST /predict`. `/health` returns `{ "status": "ok" }`. No live response from the Render deployment was obtained; source does not prove the live artifact/version.

Prediction fields: `estimated_rent_monthly`, `range_min`, `range_max`, `currency` (`PHP`), `model_version` (`development-v1`). Target training uses log1p; the server inverts with expm1 once. Frontend never applies another inverse. Range fields are fixed 70%-130% illustrative arithmetic, not statistical uncertainty, and are discarded. Proxy `predictedAt` records receipt time, not a timestamp supplied by the model.

Prediction groups are house and shared apartment/condominium with separate subtype features. App exposes only unambiguous `house`, `apartment`, `condominium` records, each mapped to the identical original type/subtype. Standalone studio/room, boarding house, bedspace, dormitory and other are unavailable because their required parent category cannot be established. Unknown city/furnishing categories are accepted by the fitted encoder with ignore semantics; training-category coverage and accuracy for RentLease's cities are not independently established.

## Exact stored-data mapping

| RentLease source | Model field | Treatment |
| --- | --- | --- |
| `properties.property_type` | `property_type`, `property_subtype` | Identity mapping for house/apartment/condominium only; API maps apartment/condominium to its shared prediction group. |
| `properties.city` | `city` | imus -> Imus; dasmarinas -> Dasmariñas; tagaytay -> Tagaytay; adapter lowercases. |
| `properties.furnishing_status` | `furnishing_status` | Exact stored enum (unfurnished/semi_furnished/furnished), never guessed as fully_furnished. Encoder may ignore unseen categories. |
| `properties.bedrooms`, `bathrooms`, `floor_number` | Same names | Preserve valid numeric zero and nonnegative values; missing optional values are null for fitted imputation. Invalid supplied values rejected. |
| `properties.floor_area_sqm` | `floor_area_sqm` | Positive stored floor area, never lot area. App deliberately requires it despite API optional imputation. |
| No matching stored lot-area or parking-count field | `lot_area_sqm`, `parking_spaces` | Null, not zero; a parking amenity is not a parking-space count. |
| No location selected | `latitude`, `longitude` | Null for imputation; neither exact nor approximate coordinates leave RentLease. |
| `property_amenities -> amenities.name` | `amenities_normalized` | Trim/lowercase/deduplicate actual names. API recognizes exact vocabulary terms; unknown aliases are ignored, not guessed. Empty verified links mean []; malformed/over-100 catalog links mean null (unknown). |
| `listings.asking_rent_monthly` | Comparison only | Never sent as a model feature or automatically changed; unavailable asking rent remains null. |

Numeric/amenity missing values use the source's fitted median/missing indicators, not local invented features. Missing input imputation, unrecognized catalog aliases and unseen categories can reduce usefulness. No accuracy or confidence claim is made.

## Flow and ownership

Existing Discover and property-management estimator entries remain. Both account capabilities can use My properties and Published rentals; the invocation actor only sets the initial presentation tab. Owner choices use bounded owner-filtered property pages and a bounded historical listing relation, selecting a deterministic current listing; incomplete listing history falls back to property-only estimation without inventing asking rent. Published choices follow the existing manual-search visibility, active-property, publication, availability, and deterministic recent/ID ordering. Unsupported/missing-input properties remain reviewable with a clear unavailable explanation.

`estimatePropertyService.ts` owns the safe projections and account rechecks. `priceEstimationWorkflow.ts` owns loading, pagination, duplicate-call prevention, explicit retry, cancellation/generations, source/property changes and Back. The existing ViewModel wraps that workflow; Views render actual records/results through shared components/tokens. Result shows PHP/month, actual selected asking rent/difference, model label, receipt time and limitations. Demo properties, fake confidence/ranges, fake history and preview timer have been removed from the real flow. No persistence contract is invented.

`src/shared/services/ml/priceEstimationClient.ts` calls only `rental-price-estimate` using the existing authenticated Supabase client, sending one target ID. Server proxy re-reads authorized stored data. It does not trust supplied property features or ownership assertions. Existing UC-08, UC-09, Public Identity, My Listings, Tenancy and Post remain in place. No new dependencies or authorization roles.

## Deployment and verification

See [prepared function/configuration](../../supabase/functions/rental-price-estimate/README.md) for exact required server secrets, scoped deployment command and acceptance checks. Frontend requires only the existing public Supabase URL/key. Legacy `EXPO_PUBLIC_FASTAPI_BASE_URL` is not used by this estimator; never add an ML secret to a public variable.

57 new estimator/proxy tests, one new real-detail entry test, plus focused UC-08/UC-09/identity/listing/navigation regressions: **444 passed / 0 failed**. TypeScript passed. Tests use source reference values and mocked HTTP; they do not execute XGBoost or establish live inference/hosted RLS. No production fixtures or dependency installation. Native Edge/Deno packaging and Android testing remain pending.

History: [implementation](../implementation-reports/phases/RENTAL_PRICE_ESTIMATION_IMPLEMENTATION.md). Source/backend evidence: [ledger](../implementation-reports/database/RENTAL_PRICE_ESTIMATION_BACKEND_LEDGER.md).


## Predeployment review - November 8, 2026

Supersedes the native-packaging-pending statement above. CLI 2.122.0/help and current Supabase dependencies/runtime-limit documentation checked; no deployment dry run is available. Official CLI-pinned Edge runtime v1.77.8 successfully bundled the three exact source modules with --network none and a sanitized temporary source tree, including the shared model import outside the function directory. Output: 33,446-byte ESZIP, SHA-256 eb867ef8b17dd5485997217702ca6d3137b13a3a43d075ba8ab7ed321fd99813. Image digest 178c041398a33ded8219344382d0672a90051d1babbf0af03425cafe20039a75. No standalone Deno installation, project env files, secret mounts, host ports or production connections. Container removed automatically; generated artifacts remain outside Git in local temporary storage.

Fresh 444 focused tests (57 estimator/proxy), TypeScript and whitespace pass. Pinned main.py/model_adapter.py/MODEL_INTEGRATION.md rechecked through read-only GitHub fetch. Caller JWT/RLS, active Tier 1, ownership/public listing boundaries, fixed HTTPS ML host, server-only secret and omitted coordinates remain enforced in reviewed source; no material finding. No database or live Render request. Native packaging does not verify hosted JWT/gateway/RLS or model correctness/accuracy. These, server secret/configuration, deployment authorization and Android acceptance remain pending. UC-09 prerequisite source is checkpointed separately before ML; existing deployment reconciliation and local files are excluded.

## Handoff fidelity update - November 8, 2026

The November 3 handout describes a different training run from pinned November 6 metadata. Exact provenance, gap matrix, all catalog mappings and detailed Phase 2 schema/compatibility/privacy design are in [handoff reconciliation](../implementation-reports/audits/RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md). Its older evaluation metrics are not automatically results for the November 6 fit.

Phase 1: map the exact fitted amenity vocabulary plus Wi-Fi -> wifi, Elevator -> lift and 24/7 Security -> 24 hours security. Eight of 16 active catalog entries now map; uncertain labels are omitted only from inference, never deleted from listings. Null and explicit empty amenity data remain distinct. The current three parent-label API requests and broad subtype fallback stay compatible with the adapter's two groups; explicit subtype is still schema-dependent.

New property drafts leave bedrooms/bathrooms blank until answered; required validation blocks a missing answer from becoming zero. Explicit zero and saved legacy zeros are preserved. Floor area remains optional for saving and positive for inference. Shared advisory warnings review unusual dimensions/counts, missing floor area and legacy-zero uncertainty, without correcting values, changing rent or blocking publication. Heuristics are not fitted training limits. Asking-rent budget/search semantics and all existing broader marketplace categories remain unchanged.

Validation: 526 focused regression tests passed, TypeScript/whitespace passed; final added missing-count creation scenario passed in a 66-test creation follow-up. Expanded run also encountered four unchanged property-workspace presentation failures; the same four reproduced against HEAD source (including the obsolete exclusive-role assertion). They were not fixed or hidden. Reference cases remain unchanged; no trained-model accuracy improvement is claimed. Revised native Edge bundle passed, 37,906 bytes, SHA-256 76439e240c4156619da493002634fea165d8223d88382ebe75bebae136e396bb.

Phase 2 remains design-only: nullable explicit subtype/lot/parking, derived model groups, no speculative backfills, versioned compatible RPCs, tenancy/Tier 3 protection and reviewed approximate-public-location use. No location values were read or sent. Separate backend/proxy rollout authorization and this revision's Android warning/count/prediction acceptance are required. Existing legacy estimate-rental-price remains untouched.

## Phase 2A model-compatible property attributes - November 9, 2026

IMPLEMENTED / LOCAL-TESTED / NOT DEPLOYED. Adds optional subtype, lot area and parking entry to property creation and routine editing, with shared strict validation and no fabricated defaults. Marketplace property_type is unchanged. House subtypes and canonical apartment_condominium subtype combinations were verified from pinned Rentlease-Features dee06f16fe182361b1d9d7e6ecf35f41703bf1a6 adapter/metadata. No standalone category is reclassified. Blank means null; explicit 0 remains meaningful. Incompatible draft subtypes can be explicitly cleared. Existing saved fields and profiles require no backfill.

Prepared official-CLI migration 20261109115021_property_model_attributes_v2.sql adds three nullable columns/checks and authenticated-only create_property_setup_v2, update_property_details_v2 and get_owned_property_edit_context_v2. Existing RPC signatures and source/config/owners/grants remain unchanged. V2 editing includes new values in the original lock/version/receipt transaction and freezes them for open tenancies. Canonical identity snapshots/gates, verification evidence, RLS, completeness and asking rent remain unchanged. Column writes are not granted to clients. Old clients preserve new values through legacy RPCs. New clients detect the v2 context; missing v2 cannot silently discard entered attributes. Prepared database.types.ts additions match reviewed SQL, not an already deployed schema.

Validation: 68 PostgreSQL checks passed / 0 failed in a synthetic PostgreSQL 17.6 disposable container (desktop-linux, network none, no mounts/host ports). Tests include source/collision refusal, all group combinations, unknown/zero, owner/Tier1/anonymous/inactive denial, catalog/grant preservation, exact retry/conflict, three tenancy states, a two-session concurrency race, actual canonical identity gate and unchanged verification records, legacy calls and data-retaining rollback. 642 focused frontend/regression checks passed / 0 failed, including 10 new Phase 2A tests; TypeScript, whitespace, Python AST syntax and scoped credential scan pass. Initial frontend failures were harnesses not modeling v2-unavailable reads and pre-existing TSX presentation imports; the fallback/mocks were updated without removing assertions or changing application behavior to pass tests. Temporary validation logs removed; disposable container stopped and --rm removal confirmed. No full-repository test-suite claim or Android acceptance.

Current inference deliberately remains Phase 1: broad subtype fallback; lot_area_sqm, parking_spaces and coordinates null. No RentalPrediction/Edge/Render/trained-artifact changes in this phase, no inferred asking rent updates. Backend-first rollout, schema/type/client compatibility, scoped rollback limitations and Phase 2B/2C are detailed in RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md. Android form/save/reopen, keyboard, old/v2 backend behavior, tenancy restrictions and account switching remain pending. No production writes, deployment, secret retrieval, commit, push, merge or build. No permanent live backend mutation was performed in this phase.

Migration LF SHA-256: 66fab33086d02c780ca8cda36ab18a48813751cfffae27d90baad4849235aeca. Rollback LF SHA-256: 9027beb8eb47d73595b4bf7f0e2d033f9d468237de65a5c7e26da662f1fac2dd. Future deployment must verify actual source/payload bytes and baseline again. Read/reused skills: rentlease-feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, ui-ux-design, test-runtime-verification, documentation-maintainer, implementation-ledger, implementation-artifact-organizer and Supabase plugin. The detailed authorized phase scope supplies the implementation sequence; no publishing permission is inferred.
