# Rental Price Estimation

## Status - November 8, 2026

IMPLEMENTED / AUTOMATED-TESTED locally; proxy PREPARED ONLY. Uncommitted changes on `fix/gps-nearby-results`, layered over preserved UC-09 work. Render live prediction, Edge deployment/secret configuration, hosted JWT/RLS acceptance and physical Android acceptance are PENDING. No production mutation, migration, commit, push or build.

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
