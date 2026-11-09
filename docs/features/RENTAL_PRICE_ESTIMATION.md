# Rental Price Estimation

## Status - November 8, 2026

Existing rental-price-estimate is externally deployed ACTIVE version 1 with verify_jwt=true (read-only inventory November 8). The user reports a successful end-to-end Android prediction for that integration. The Phase 1 fidelity changes below are IMPLEMENTED / AUTOMATED-TESTED locally, uncommitted, and not deployed or Android-accepted. Previous Render reachability observations are historical, not a blocker used to rebuild the integration. No production writes, migrations, model-artifact changes or secret retrieval in this phase.

## Source-verified contract

Reviewed `main.py`, `model_adapter.py`, `MODEL_INTEGRATION.md`, `models/model_metadata.json`, and `models/reference_predictions.json` at [dee06f16fe182361b1d9d7e6ecf35f41703bf1a6](https://github.com/johnkamantig/Rentlease-Features/tree/dee06f16fe182361b1d9d7e6ecf35f41703bf1a6). Source requires a private `ML_SHARED_SECRET` bearer token on `POST /predict`. `/health` returns `{ "status": "ok" }`. No live response from the Render deployment was obtained; source does not prove the live artifact/version.

Prediction fields: `estimated_rent_monthly`, `range_min`, `range_max`, `currency` (`PHP`), `model_version` (`development-v1`). Target training uses log1p; the server inverts with expm1 once. Frontend never applies another inverse. Range fields are fixed 70%-130% illustrative arithmetic, not statistical uncertainty. Valid supplied bounds are displayed beneath the primary estimate as Illustrative rental range (±30%). Proxy `predictedAt` records receipt time, not a timestamp supplied by the model.

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

### Current readiness

57 focused tests, TypeScript and fresh native Edge packaging pass. Render health and unauthenticated predict probes timed out, so service/authenticated inference operation remains unverified. No secret values were retrieved. Existing estimate-rental-price stays active with unchanged bundle hash; its observed version advanced 7 -> 8 externally during review and needs confirmation. New rental-price-estimate is not deployed. See proxy README for exact isolated procedure and blockers. No model, authorization, Tier 2 or production configuration changes were made. Android acceptance remains pending.

## Handoff fidelity update - November 8, 2026

The November 3 handout describes a different training run from pinned November 6 metadata. Exact provenance, gap matrix, all catalog mappings and detailed Phase 2 schema/compatibility/privacy design are in [handoff reconciliation](../implementation-reports/audits/RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md). Its older evaluation metrics are not automatically results for the November 6 fit.

Phase 1: map the exact fitted amenity vocabulary plus Wi-Fi -> wifi, Elevator -> lift and 24/7 Security -> 24 hours security. Eight of 16 active catalog entries now map; uncertain labels are omitted only from inference, never deleted from listings. Null and explicit empty amenity data remain distinct. The current three parent-label API requests and broad subtype fallback stay compatible with the adapter's two groups; explicit subtype is still schema-dependent.

New property drafts leave bedrooms/bathrooms blank until answered; required validation blocks a missing answer from becoming zero. Explicit zero and saved legacy zeros are preserved. Floor area remains optional for saving and positive for inference. Shared advisory warnings review unusual dimensions/counts, missing floor area and legacy-zero uncertainty, without correcting values, changing rent or blocking publication. Heuristics are not fitted training limits. Asking-rent budget/search semantics and all existing broader marketplace categories remain unchanged.

Validation: 526 focused regression tests passed, TypeScript/whitespace passed; final added missing-count creation scenario passed in a 66-test creation follow-up. Expanded run also encountered four unchanged property-workspace presentation failures; the same four reproduced against HEAD source (including the obsolete exclusive-role assertion). They were not fixed or hidden. Reference cases remain unchanged; no trained-model accuracy improvement is claimed. Revised native Edge bundle passed, 37,906 bytes, SHA-256 76439e240c4156619da493002634fea165d8223d88382ebe75bebae136e396bb.

Phase 2 remains design-only: nullable explicit subtype/lot/parking, derived model groups, no speculative backfills, versioned compatible RPCs, tenancy/Tier 3 protection and reviewed approximate-public-location use. No location values were read or sent. Separate backend/proxy rollout authorization and this revision's Android warning/count/prediction acceptance are required. Existing legacy estimate-rental-price remains untouched.


### Local illustrative-range revision - November 8, 2026

Prepared locally: show only validated upstream arithmetic bounds beneath the primary PHP/month estimate; asking rent stays separate. The range is not a statistical confidence interval or an accuracy claim. No model inputs, authorization, RLS, cancellation or schema changed. This revision requires separately authorized deployment of only rental-price-estimate (including its shared mapper dependency), followed by hosted prediction and Android acceptance. No deployment or secret retrieval occurred.


## Authorized illustrative-range deployment - November 8, 2026

Codex deployed ONLY rental-price-estimate to cxfsbwbwmwmgtqfonqth using `supabase.cmd functions deploy rental-price-estimate --project-ref cxfsbwbwmwmgtqfonqth`, exit 0, under explicit user authorization. FUNCTION_CHANGE: version 2 -> 3, ACTIVE, verify_jwt=true. Deployed bundle SHA-256: 033284738ff501c342a89b508f2a75ad15c2aae1fd6a88861a95cb7f7cf16899. Read-only function inventory and retrieved source confirm range validation/forwarding and Auth checks. Legacy estimate-rental-price remains ACTIVE version 8, JWT enabled, unchanged hash 3a025cc63b881af7b8a4410a2b6e9aadb99d0d301ac9ad995c1398531be67648; send-sms metadata also unchanged.

73 focused tests, TypeScript and whitespace passed. Sanitized network-isolated native packaging (runtime v1.77.8) passed: 40,562 bytes, SHA-256 5a3f754bb8d4daa779f69939c4d02dad58380f50c2dcc71aa7789999fb6ace51. The CLI actually selected runtime v1.74.2 for successful deployment; its hosted bundle hash above is distinct from the preflight artifact. Disposable preflight container automatically removed. No secrets retrieved/changed, migrations, Tier 2 changes, Render modifications, unrelated function deployment, database writes, commit/push or Android build. No rollback executed or authorized; withdrawing/redeploying needs separate authorization. Prior documentation saying this revision is local-only is historical as of this entry.

Hosted authenticated prediction has not been exercised for this revision. Android acceptance pending: valid range below primary estimate, exact illustrative label/explanation, separate asking rent, missing/invalid bounds omitted, retry/cancellation, Back and account switching. Existing app sessions and authorized real properties should be used; no production fixtures were created. Frontend changes remain local and were not distributed by the Edge deployment. Skills read/reused: Supabase plugin, RentLease Supabase contract guard, implementation ledger and test/runtime verification.


### Range display formatting - November 8, 2026

Frontend-only refinement: peso range amounts use an en dash with a single secondary per month line. Text remains unconstrained by line limits for small-screen wrapping. Primary/asking rent, validation and disclaimer are unchanged. 74 focused tests passed; Android visual acceptance pending. No backend/API changes, deployment, commit or push in this refinement.


## Inline estimation in real details - November 8, 2026

IMPLEMENTED / AUTOMATED-TESTED locally. The real published Listing Details (including Chat-linked details) uses its current listing ID. Owned saved property/composer/routine-details and listing-details/management surfaces embed the same shared expandable InlineRentalEstimate, preferring the workspace's saved listing ID and otherwise using its property ID. Unsaved property creation has no target. Portfolio/search cards never predict automatically. Normal entry points no longer open the standalone browsing picker; its route and reusable implementation remain for compatibility.

Shared ViewModel orchestration calls the existing authenticated prediction client only after expansion and explicit Estimate rental price. No extra listing queries or saved-data reentry are needed. Collapse/cancel/unmount invalidate generations and abort transport; account/target changes create new state immediately. Results, sanitized errors/retry, loading/cancel, primary PHP/month estimate, optional validated illustrative range with a single secondary per month line, arithmetic disclaimer, asking rent and model limitations stay inline. Estimation uses saved data; unsaved form changes are not sent. Server Auth/Tier 1/RLS and feature mapping remain unchanged.

Validation: 316 focused tests passed / 0 failed, including 8 inline workflow/presentation tests, tenant target/account binding, existing estimator/proxy/mapping, Search/GPS, Chat property context, property edits and listing draft/lifecycle regressions. TypeScript and whitespace pass. Initial search render harness expected the old navigation action and lacked the new shared component stub; updated to assert the intentional inline behavior. No production call, backend change, Edge deployment, schema/model change, commit, push or build occurred. No permanent live backend mutation was performed in this phase.

Android acceptance remains pending: published details and Chat Back; owned saved/unpublished properties; unsupported type/missing floor area; expand/estimate/cancel/retry; range wrapping/disclaimer/asking rent; Back during prediction; switch property/account while waiting; verify existing search/GPS, edits and publication. Abort cannot guarantee an upstream calculation already started is canceled. Hosted prediction for the inline revision is not tested.

Skills read/reused: feature implementation, frontend MVVM guard, Supabase contract guard, security review, test/runtime verification, documentation maintainer, implementation ledger, artifact organizer; user-level brainstorming. The user's detailed desired behavior supplies the implementation scope; no backend or publishing permission is inferred.


### One-tap inline estimation - November 8, 2026

Supersedes the accordion interaction above: a compact unboxed section exposes Estimate rental price immediately. First tap invokes the existing ID-bound workflow; no mount-time inference. During loading the sole action reads Estimating and is disabled, with an indicator. Results and safe errors/retry remain inline; unsupported-input and Tier 1 messages are unchanged. No expanded state or second action remains. Unmount/target/account changes still abort or invalidate stale responses. 316 focused tests passed; TypeScript and whitespace passed. Android one-tap, loading, Back, property/account switching and narrow-screen result checks remain pending. Frontend-only; no live backend interaction or permanent mutation, API/Edge/model/schema change, deployment, commit or push.


### Inline 422 diagnostics and information UI - November 8, 2026

READ_ONLY_INSPECTION by Codex via supabase_query_logs, project cxfsbwbwmwmgtqfonqth, window 2026-11-08T13:30:00Z to 13:38:00Z (21:30-21:38 Philippine time). Source/key discovery followed by aggregate function-edge query confirmed five rental-price-estimate v3 HTTP 422 responses, 639-1,991 ms. No request bodies, property IDs, tokens, identity values or private records were queried. One unsupported JSON-path aggregate failed and was replaced with mapKeys metadata discovery. Logs do not retain the safe response body/code; exact per-request cause is NOT determined. Handler inspection identifies three 422 paths: target validation (input), saved-property mapping (input), upstream 422 (model_input). These are not timeout responses. No new live invocation or mutation was performed.

Frontend fix: prediction client reads response-like contexts without relying on global Response constructor identity, preserves only allowlisted safe codes, and falls back to input for unreadable/unrecognized HTTP 422 responses. Raw provider bodies/unknown codes are never shown. The former generic Render-startup fallback could mislabel 422 when code extraction failed; actual Android response constructor/body behavior is not proven by logs. Inline ViewModel preserves errorCode and retryability. Input/model_input/auth/access/eligibility/configuration errors show actionable review guidance without Retry; transient service/timeout/rate-limit/invalid-result errors allow retry. No missing model features were guessed or modified; this improves diagnosis, not the underlying saved-record validity.

The compact header has a 44dp info-circle action and an initially hidden, scrollable native modal with Close and Android Back dismissal. Saved-input, missing-input, arithmetic range/non-confidence, asking-rent and privacy explanations moved there. Primary action/result remain inline with no automatic invocation, duplicate requests or stale-result publication. Existing Edge Function and model were not modified in this task.

321 focused tests passed, including response-like/native contexts, unreadable 422, sanitized code fallback, 503/504, cancellation, validation retry policy and modal open/Back behavior; Search/GPS, property edit, draft/lifecycle and Chat context regressions also pass. TypeScript and whitespace pass. Android acceptance pending: reproduce failing property and observe safe code-specific guidance; verify retryable outage/timeout, info focus/readability/Back at larger fonts, one-tap loading, cancellation and property/account switching. No deployment, database/Render changes, secret retrieval, commit or push. No permanent live backend mutation was performed in this phase.


### Saved-property estimation eligibility - November 8, 2026

Shared RentalEstimateEligibility reuses mapPredictionInput for saved type/city/furnishing/measurement validation, with specific unsupported-type, missing/invalid floor-area and inactive-property explanations. Supported house/apartment/condominium only; titles never infer category. Missing optional fields and unusual nonnegative valid measurements do not block estimation. Existing standalone candidates reuse the same rule. No training heuristics become eligibility limits.

Real listing details pass saved public model fields only; owned-property ViewModel projects saved physical fields, not form drafts or private locations. Known ineligibility hides Estimate and guards direct workflow invocation. Only a confirmed owner with an existing permitted edit action receives Review property details; tenants receive the explanation only. Saved-field changes invalidate the workflow in addition to account/target changes. Missing saved context is explicitly unavailable rather than assumed eligible. Info modal and one-tap eligible behavior remain unchanged.

326 focused tests passed; TypeScript and whitespace pass. Frontend cannot establish current Tier 1, Auth/RLS, concurrent ownership/publication/availability changes, or Render acceptance; server remains authoritative. Existing listing detail service enforces public visibility before loading, but its display projection does not expose all live authorization fields. A known-local-eligible result is not a promise of server acceptance; unexpected input/model_input errors stay distinct from local eligibility. No new backend read, live invocation, permanent backend mutation, deployment, database/Render/Edge/model change, commit or push occurred. Android acceptance pending for all categories, saved-data edits/reopen, owner review/tenant absence, transient retry, Back and property/account switching.


### Compact estimate information dialog - November 8, 2026

Root cause: the white surface was attached directly to a ScrollView with maxHeight 85% but default flex growth; it expanded despite short content. The new centered View has width 100% with maxWidth 340dp, 20dp outer margins, 18dp padding, 12dp corners and an 85%-screen height safety cap. No content flex:1/minHeight/fixed height. Its overflow scroll area has flexGrow:0/flexShrink:1 and scrolling is enabled only when measured content exceeds its viewport. Concise requested About rent estimates copy replaces the longer paragraphs; muted privacy text ends the panel. A 44dp X replaces the bottom button. Separate full-backdrop dismiss target and Android onRequestClose preserve dismissal without intercepting panel content.

Agent-observed Android emulator-5554 (Android 17/API37) validation at 360dp width (1080px, temporarily 480dpi): actual native dialog centered, approximately 320dp wide, content-sized, white panel ending shortly below privacy text; no large blank bottom area. All text fit without scrolling. Android Back, backdrop tap and X dismissal passed. Original density 420 restored. Existing published listing navigation/read-only data loading only; no prediction, message, edit or production data mutation. No physical-device acceptance claim. Larger accessibility font/overflow coverage remains pending.

327 focused tests passed; TypeScript and whitespace passed after correcting unsupported StyleSheet.absoluteFillObject to an explicit backdrop-only absolute style. Initial copy assertion was updated to the exact requested confidence-interval wording. A dismissal probe during refresh was inconclusive; repeated after rendering settled with explicit waits, all three dismissal actions passed. Local screenshots and diagnostic UI-tree artifacts were removed. No backend/Edge/model/schema change, deployment, build, commit or push. Skills applied: RentLease UI/UX, MVVM and test/runtime verification plus existing documentation workflow.


## Phase 2A model-compatible property attributes - November 9, 2026

IMPLEMENTED / LOCAL-TESTED / NOT DEPLOYED. Adds optional subtype, lot area and parking entry to property creation and routine editing, with shared strict validation and no fabricated defaults. Marketplace property_type is unchanged. House subtypes and canonical apartment_condominium subtype combinations were verified from pinned Rentlease-Features dee06f16fe182361b1d9d7e6ecf35f41703bf1a6 adapter/metadata. No standalone category is reclassified. Blank means null; explicit 0 remains meaningful. Incompatible draft subtypes can be explicitly cleared. Existing saved fields and profiles require no backfill.

Prepared official-CLI migration 20261109115021_property_model_attributes_v2.sql adds three nullable columns/checks and authenticated-only create_property_setup_v2, update_property_details_v2 and get_owned_property_edit_context_v2. Existing RPC signatures and source/config/owners/grants remain unchanged. V2 editing includes new values in the original lock/version/receipt transaction and freezes them for open tenancies. Canonical identity snapshots/gates, verification evidence, RLS, completeness and asking rent remain unchanged. Column writes are not granted to clients. Old clients preserve new values through legacy RPCs. New clients detect the v2 context; missing v2 cannot silently discard entered attributes. Prepared database.types.ts additions match reviewed SQL, not an already deployed schema.

Validation: 68 PostgreSQL checks passed / 0 failed in a synthetic PostgreSQL 17.6 disposable container (desktop-linux, network none, no mounts/host ports). Tests include source/collision refusal, all group combinations, unknown/zero, owner/Tier1/anonymous/inactive denial, catalog/grant preservation, exact retry/conflict, three tenancy states, a two-session concurrency race, actual canonical identity gate and unchanged verification records, legacy calls and data-retaining rollback. 642 focused frontend/regression checks passed / 0 failed, including 10 new Phase 2A tests; TypeScript, whitespace, Python AST syntax and scoped credential scan pass. Initial frontend failures were harnesses not modeling v2-unavailable reads and pre-existing TSX presentation imports; the fallback/mocks were updated without removing assertions or changing application behavior to pass tests. Temporary validation logs removed; disposable container stopped and --rm removal confirmed. No full-repository test-suite claim or Android acceptance.

Current inference deliberately remains Phase 1: broad subtype fallback; lot_area_sqm, parking_spaces and coordinates null. No RentalPrediction/Edge/Render/trained-artifact changes in this phase, no inferred asking rent updates. Backend-first rollout, schema/type/client compatibility, scoped rollback limitations and Phase 2B/2C are detailed in RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md. Android form/save/reopen, keyboard, old/v2 backend behavior, tenancy restrictions and account switching remain pending. No production writes, deployment, secret retrieval, commit, push, merge or build. No permanent live backend mutation was performed in this phase.

Migration LF SHA-256: 66fab33086d02c780ca8cda36ab18a48813751cfffae27d90baad4849235aeca. Rollback LF SHA-256: 9027beb8eb47d73595b4bf7f0e2d033f9d468237de65a5c7e26da662f1fac2dd. Future deployment must verify actual source/payload bytes and baseline again. Read/reused skills: rentlease-feature-implementation, frontend-mvvm-guard, supabase-contract-guard, security-review, ui-ux-design, test-runtime-verification, documentation-maintainer, implementation-ledger, implementation-artifact-organizer and Supabase plugin. The detailed authorized phase scope supplies the implementation sequence; no publishing permission is inferred.


## Phase 2B local integration - November 9, 2026

Prepared only, not deployed. Saved subtype/lot/parking now reach inference through the caller-scoped narrow property read; explicit apartment/condominium subtypes use the canonical combined API group, legacy null subtype keeps its existing broad fallback. Only an exact missing Phase 2A column error permits one legacy projection retry; unrelated errors fail. Missing optional values remain null, explicit zero stays zero. JWT/Tier 1/RLS/listing access, illustrative range, asking-rent separation and cancellation remain preserved. Shared range contract is included as an existing required checkpoint dependency; unrelated UI work stays separate. Coordinates remain null. Phase 2C grid-shape review helper is disconnected and always denies transmission; no privacy approval is implied.

Coordinated release: fresh baseline/freeze and restricted backup -> isolated Phase 2A schema/RPC apply and verification -> compare generated types/release property frontend -> separately deploy only rental-price-estimate with JWT enabled -> hosted/Android acceptance. No db push, unrelated migration/function, secrets change or Render/model change. Full procedure and consolidated test evidence: RENTAL_ESTIMATION_HANDOFF_RECONCILIATION_2026-11-08.md, Phase 2B section.


## Phase 2A postdeployment frontend reconciliation - November 9, 2026

Phase 2A schema/RPC deployment independently confirmed as 20261109131034 (28 history rows); migration renamed without SQL changes. Live-generated relevant columns/RPC signatures match prepared types; explicit SQL-nullable Args retained. Existing creation/edit services already bind v2 correctly with legacy compatibility and account/version/receipt protections. Focused frontend tests and TypeScript pass; production caller-JWT write/Android acceptance remain pending. Phase 2B named Edge deployment still requires separate authorization; no deployment/build in this reconciliation. Details: reconciliation audit postdeployment section.


## Phase 2 physical Android acceptance and focused fixes - November 10, 2026

Agent-observed owner create/reopen (user-created draft), studio/35 sqm/unknown lot/parking zero, authorized lot/parking save/reopen, real inline estimate/range/asking-rent separation, legacy unknown-field prediction and unsupported Boarding house gating passed. Two frontend fixes: first hydrated render exposes owner property editing; saved model fields/edit_version now invalidate old estimates. 169 focused regressions, TypeScript and whitespace pass. Final designated test-property attributes: lot 50 / parking 2; asking rent 5,000 unchanged. Different-account tenant inference/denial remains unverified. No deployment/build/commit/push; details and reproduction steps in reconciliation audit.


## Rental price guidance and scoped Phase 2 completion - November 10, 2026

Compact real XGBoost guidance now follows Monthly asking rent. Saved property IDs only; unsaved property shows save-first guidance without creating/publishing anything. Explicit Use estimate fills the local price through the ViewModel, never autosaves or overwrites a price automatically; manual override remains valid. Existing inline details, null/zero, eligibility, safe errors, cancellation and the two physical-test fixes are preserved. Physical owner guidance/adoption/manual override/save/reopen passed; test price restored5000. 545 focused workspace tests, TypeScript and whitespace pass. Cross-account tenant acceptance remains BLOCKED; automated authorization passes. No schema/service/model change or build; final evidence/scope in reconciliation audit.
