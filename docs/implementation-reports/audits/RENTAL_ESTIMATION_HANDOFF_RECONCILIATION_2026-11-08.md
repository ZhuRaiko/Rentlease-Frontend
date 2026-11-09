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


## Phase 2A local implementation and rollout plan - November 9, 2026

Current status: PREPARED LOCALLY / NOT DEPLOYED. This supersedes the earlier statement that no Phase 2 migration is prepared; the November 8 design remains historical rationale. Phase 1 inference, Discover restoration, inline estimates/range, UC-09 reconciliation and Tier 2 work are preserved.

### Confirmed adapter authority and scope

Re-read model_adapter.py and models/model_metadata.json at pinned Rentlease-Features dee06f16fe182361b1d9d7e6ecf35f41703bf1a6. November 6 training metadata still has only house and apartment_condominium. Adapter original house accepts house/townhouse/beach_house/villa. Canonical apartment_condominium accepts apartment/room/condominium/studio/loft/penthouse/condotel; legacy apartment accepts only apartment/room, legacy condominium only condominium/studio/loft/penthouse/condotel. Stored apartment or condominium can choose the canonical combined-group subtype list; this does not make that pair valid for the narrower legacy API request. Phase 2B must explicitly map to canonical combined-group requests before enabling these fields for inference. Standalone room/studio/boarding_house/bedspace/dormitory/other remain their existing marketplace types and do not receive an inferred prediction parent.

### Prepared database and RPC contracts

CLI-created migration: supabase/migrations/20261109115021_property_model_attributes_v2.sql. Adds properties.property_subtype text NULL, lot_area_sqm numeric(10,2) NULL, parking_spaces integer NULL, without defaults or UPDATE/backfill. Checks subtype against the unchanged marketplace type, finite nonnegative lot area, and nonnegative integer parking. Numeric precision/range follows storage capacity, not training limits. Blank is null; confirmed zero persists. No completeness weights, publication threshold, verification rules, asking rent, search RPC or RLS policy changes.

create_property_setup_v2 is a reviewed clone of the catalog-confirmed v1 definition, adding the three optional parameters/columns to its existing single property INSERT inside the same property/private-location/amenity transaction. Existing Auth, active account, Tier 1, coordinate, address and amenity gates remain. Creation keeps the original journal-based unknown-outcome recovery; this is not a new server-side exactly-once/idempotent-create contract.

update_property_details_v2 preserves lock_owner, READ COMMITTED, edit_version, request receipts, amenity validation/replacement, private-context update, completeness guard and tenancy serialization. New fields are included in one property UPDATE and the receipt body (schema_version=2), so conflicting replays reject and no second version rotation is introduced. All three new fields are frozen during proposed/pending_confirmation/active tenancies. Existing canonical identity snapshot/gate and verification rows remain unchanged; subtype is descriptive metadata, not authorization to replace a physical rental or alter protected marketplace type/address/location. Identity changes remain in the existing revision/re-verification workflow. A category correction may require explicitly clearing an incompatible optional subtype first; no automatic relabel or re-verification bypass is provided.

get_owned_property_edit_context_v2 calls the existing owner-gated context function and merges only the three stored fields plus model_attributes_version=2. Existing get_property_details_operation reads v2 receipts without changing its signature/result. The original four public RPCs and protected helper definitions are untouched. New SECURITY DEFINER functions use pg_catalog search_path, postgres owner and authenticated-only EXECUTE; no new column INSERT/UPDATE grants. Existing table SELECT remains subject to existing RLS. Migration guards reject source/config/owner drift, broad property write grants and any colliding v2 RPC before adding columns.

### Frontend compatibility

New optional fields and validated subtype choices are in property creation and routine editing; no saved data is re-entered for estimation. Shared PropertyModelAttributes validation and fields handle blank/null, zero, numeric capacity, invalid pairs and explicit clearing after a draft category change. Errors identify the relevant field. Open-tenancy controls disable new material fields. Existing required count/floor/location rules are unchanged.

Creation with no new values still uses create_property_setup; any new value (including 0) uses v2. A missing v2 contract returns a clear rollout-required rejection and never retries v1 with discarded inputs. Routine reads try v2 and fall back only for PGRST202; legacy contexts stay editable for old fields with new controls unavailable. V2 contexts validate actual string/number/null types. V2 writes reload the authoritative v2 context and retain the existing journal/receipt/conflict/account-change handling. New values on a legacy context fail before a journal/write. Types in database.types.ts describe the prepared contract, not evidence that production has it; regenerate/compare from the approved applied schema before release.

No RentalPrediction mapper, rental-price-estimate handler, Render endpoint/artifact or tenant filter changed in Phase 2A. Current inference still sends broad subtype fallback and null lot area, parking, latitude and longitude even when new saved metadata exists. No new private-coordinate reads or external disclosure.

### Safe rollout order (separate authorization required)

1. Review source, migration checksum, test evidence and complete current production catalog/history. Confirm target project, exact legacy definitions/ACL/RLS/identity/tenancy baselines, no v2 collision and no concurrent schema change. Reconcile pending migrations by inspection: do not run blanket db push or inadvertently apply Tier 2/UC-09 files.
2. Create a restricted external schema/catalog backup and an appropriately authorized export of optional attribute values if any already exist; verify ACLs/manifests and recovery scope. Do not expose private locations or user data in Git/logs. Stop for drift, failed backup, existing migration/fields or unclear rollback scope. No production backup was taken in this local task.
3. Apply ONLY the reviewed Phase 2A migration through an approved isolated migration-history-recording mechanism, once. Verify actual recorded version/payload and all prior history; do not falsely mark pending unrelated files applied. Freshly verify nullable/no-default columns, constraints, new grants, old source/ACL/RLS and canonical identity gates.
4. Generate/compare schema types from the resulting confirmed contract, then release the property-form/service revision separately. Test owned/foreign/inactive/anonymous cases, blank/zero, subtype combinations, old clients, concurrent edits/tenancies, receipt replay/recovery and an existing authorized draft/edit/publication. No fabricated production fixtures. Old clients remain on v1 and preserve new stored values.
5. Do not change inference during this rollout. Separately authorize Phase 2B proxy integration/packaging/live prediction and Android acceptance after database/app readiness. Legacy estimate-rental-price stays intact. No model retraining or asking-rent overwrite.

### Rollback / downgrade

supabase/test-support/property_model_attributes_v2_rollback.sql disables only the three v2 functions, retaining columns, checks, entered data and receipts. Withdraw/revert the new client first or coordinate a short write freeze; pending v2 operations must reconcile before disabling. Old RPCs remain usable and preserve stored attributes. Verify exact deployed v2 definitions and backup before rollback; stop if changed. Record rollback as a separate authorized compensating migration, never erase or repair history. Re-enabling requires separately reviewed function recreation, not replaying the entire ADD COLUMN migration against retained columns.

Exact schema reversal (dropping the three columns/checks) is intentionally not automatic: it destroys entered attributes and may remove dependents. It requires a separate data export, explicit loss approval, dependency review, compatible clients and a new reviewed migration. This rollback is not full database/Auth/Storage recovery. No restore or hosted downgrade was tested here; local data-retaining rollback was tested.

### Subsequent phases / acceptance

Completed Phase 2A: storage, owner entry/editing, versioned owner RPCs, prepared types, validation and local security/regression coverage. Phase 2B remains: safe caller-scoped reads and canonical group/subtype inference mapping, optional lot/parking use in proxy, missing-field backward behavior, native packaging and real reference/hosted acceptance; any tenant subtype/parking filters require separate server-supported query design. Phase 2C remains: privacy/purpose/access/provenance review for confirmed approximate public-location inference. Exact private coordinates remain excluded. Neither phase is authorized by this local preparation; no trained-artifact changes or model accuracy claim.

Android: new creation, optional zero/blank, category/subtype clearing, saved legacy/v2 editing, open-tenancy disabled controls, failed/uncertain save recovery, Back/account switching and unchanged listing publication/inference remain runtime-unverified for this revision. Synthetic local tests do not establish hosted PostgREST, RLS, native keyboard/layout or deployment acceptance.


Phase 2A final evidence: 68 isolated PostgreSQL checks and 642 focused frontend/regression tests pass; TypeScript/whitespace/AST/scoped credential checks pass. Disposable container stopped/removed. Migration LF SHA-256 66fab33086d02c780ca8cda36ab18a48813751cfffae27d90baad4849235aeca; rollback LF SHA-256 9027beb8eb47d73595b4bf7f0e2d033f9d468237de65a5c7e26da662f1fac2dd. No production writes or deployment.

## Phase 2A checkpoint and read-only production preflight - November 9, 2026

Deployment is NOT authorized. Source checkpoint preparation is separate from backend/frontend release. The checkpoint selectively includes Phase 2A; unrelated inline estimation, Discover, UC-09, Tier 2 and workspace changes remain outside it. Reviewed migration and rollback LF hashes above match their local bytes after newline normalization.

Fresh metadata-only SELECTs confirmed 27 migration records, latest 20261108071009_public_profiles_security_invoker, zero proposed columns and zero collisions with the three proposed public v2 RPC names. All six definitions in property_model_attributes_baseline.json match live full-definition hashes, owners, configuration and ACLs. Current creation/editing ownership, active Tier 1, lock/version/receipt and private-location gates match the reviewed implementation. Live tenancy-version and canonical-consistency function bodies also match their existing local migration sources. Profiles, properties, listings and private locations retain RLS and authenticated SELECT without broad table INSERT/UPDATE grants. Current policy/trigger catalogs were inspected; this is not a claim that every catalog object has an independently retained historical snapshot. No unexpected difference was observed in the compared baseline. No application rows or secret values were read, no user RPC was executed, and no production write occurred.

The working-tree migration set has two unapplied payloads: 20261108041628_recommendation_owner_tier2_status.sql (EXCLUDED; privacy review unresolved) and 20261109115021_property_model_attributes_v2.sql (sole future Phase 2A target). UC-09 is already recorded remotely as 20261106125046/20261106130211; its separate local filename reconciliation is deliberately excluded from this checkpoint. The committed older UC-09 filenames therefore remain an additional blanket-push hazard. Do not deploy/repair/relabel unrelated history to make a CLI push proceed. This preflight is point-in-time evidence; a schema deployment freeze and fresh baseline are required immediately before a later apply.

### Restricted backup procedure for later authorization

No backup was created in this checkpoint. Use an external protected directory, never Git. Installed CLI help confirms schema selection and role-only dump flags. With later backup authorization, run from the repository in PowerShell:

```powershell
$phase2Backup = Join-Path 'C:\RentLease-Backups' ('property-model-attributes-predeploy-' + (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $phase2Backup -ErrorAction Stop
$phase2Owner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $phase2Backup /inheritance:r /grant:r "$($phase2Owner):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F'
if ($LASTEXITCODE -ne 0) { throw 'Backup ACL failure' }
icacls $phase2Backup
if ((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'cxfsbwbwmwmgtqfonqth') { throw 'Wrong linked project' }
supabase.cmd db dump --linked --schema public,rentlease_property_edit,rentlease_property_identity,rentlease_completeness --file (Join-Path $phase2Backup 'schema.sql')
if ($LASTEXITCODE -ne 0) { throw 'Schema backup failed' }
supabase.cmd db dump --linked --role-only --file (Join-Path $phase2Backup 'roles.sql')
if ($LASTEXITCODE -ne 0) { throw 'Roles backup failed' }
```

Use the established secure CLI session/prompt. Never print secrets, embed a connection URL/password, enable debug output or export application/private-location/message rows. Save metadata-only complete migration-history rows (including statements), relevant full function definitions/owner/config/ACLs, table/column grants, policies, triggers, constraints and version/identity/tenancy contracts under the same restricted directory. Export exact migration/rollback Git blobs from the reviewed checkpoint with Python subprocess.check_output(['git','show','<checkpoint>:<path>']) and binary write_bytes; verify the two LF hashes above. Require every expected artifact nonempty, successful command exits, SHA-256 manifest reread/verification and restricted ACLs. Recheck production baseline after backup; stop on drift or concurrent deployment.

These artifacts support reviewed schema/catalog/role reconstruction, not full database recovery. They contain no application data snapshot, Auth sessions, Storage bytes or PITR guarantee. Role metadata is sensitive and must not be replayed wholesale. Restoring future hosted dump artifacts is untested. If proposed columns already exist or contain data, stop this first-apply procedure; obtain a separately authorized attribute-value export and recovery review rather than blindly replaying or dropping anything.

### Isolated apply and acceptance for later authorization

After separate deployment approval, load only the checksum-verified migration blob as UTF-8 and submit once through the connected Supabase apply_migration mechanism with project_id=cxfsbwbwmwmgtqfonqth, name=property_model_attributes_v2 and query equal to that exact payload. It does not scan local pending files. Do not use db push, migration repair, manual history edits, Tier 2 SQL or an unrecorded SQL-editor apply. If the response is ambiguous, inspect history/schema read-only before any retry.

Require exactly one new history entry (28 total), unchanged prior 27 complete rows, recorded payload parity and the actual assigned version. Confirm only intended nullable/no-default columns, checks and three authenticated-only v2 RPCs were added; original function definitions/ACLs, RLS, identity/tenancy gates and unrelated history remain unchanged. Record actual version and reconcile only this migration filename later under explicit scope. Stop on any discrepancy; do not automatically roll back or weaken guards.

Backend first: verify applied contracts, regenerate/compare types, then separately release the new property-form client. Old clients keep v1 RPCs and preserve new values. Validate real authorized owner/foreign/anonymous/inactive cases, null/zero, subtype pairs, legacy clients, version conflicts, receipt reconciliation and tenancy restrictions with separately authorized hosted acceptance; no synthetic production fixtures. Local synthetic tests do not replace PostgREST/Android acceptance. Phase 2B proxy deployment and Phase 2C location privacy remain excluded.

Rollback readiness is local only: the reviewed rollback disables three v2 functions and retains columns, data, checks and receipts. Withdraw the new client and reconcile in-flight v2 operations before separately authorizing that compensating migration. It does not reverse entered data or restore a complete database. Full schema reversal requires data-loss authorization and dependency review; never erase migration history or replay the forward ADD COLUMN payload against retained columns.


Checkpoint validation: exact staged snapshot (23 files) passed 618 focused frontend/regression tests, TypeScript, 68 isolated PostgreSQL checks, staged whitespace, Python syntax and added-content credential/artifact scans. The earlier 642 count includes unrelated uncommitted UI tests and is not the checkpoint count. Both staged SQL LF hashes match the values above. One full-file scan matched an unchanged historical loopback test URL; no new credential pattern was found in added content. Disposable PostgreSQL was stopped and removal confirmed. No production writes, deployment, backup creation or Android build.


## Phase 2B implementation and Phase 2C preparation - November 9, 2026

IMPLEMENTED LOCALLY / NOT DEPLOYED. Phase 2A checkpoint 8db5adcf1c681ebe3ba840aa9775f49c09cade86 remains unchanged. Re-read pinned model_adapter.py and model_metadata.json at dee06f16fe182361b1d9d7e6ecf35f41703bf1a6: still two fitted groups, eight numeric inputs and the previously documented legacy/canonical subtype distinction. The mapper now consumes saved property_subtype, lot_area_sqm and parking_spaces. Explicit supported apartment/condominium subtypes use property_type=apartment_condominium with the saved subtype; house stays house. Null/missing subtype retains the original broad parent request/fallback, preserving legacy/reference behavior. Invalid pairs and nonfinite/negative measurements reject; parking must be an integer. Missing optional measurements stay null; actual zero stays zero. No fabricated categories, amenities, asking-rent features, trained-artifact changes or accuracy claim.

The proxy first requests the three optional columns alongside the original narrow property projection, with the same caller JWT. Only HTTP 400, SQLSTATE 42703 and an exact missing-column message naming one of these three properties columns permit one legacy projection retry. Other missing columns, permission/relationship/cache errors, malformed errors and server failures do not trigger fallback. It is request-local with no capability cache; later requests detect newly deployed columns. The legacy retry repeats all existing property/owner/listing/availability gates. Phase 2A adds all columns atomically; a partial schema is unsupported and must stop deployment preflight. No new RPC, client, direct write, location read or auth bypass. Existing active Tier 1, RLS, owned draft/direct-property and public listing rules, request cancellation and duplicate suppression remain authoritative.

The Phase 2B checkpoint includes the already-local shared illustrative-range validation/receipt contract as a required dependency so this Edge revision preserves the current deployed range rather than reverting it. UI changes, error-client changes and unrelated pending work are not part of this checkpoint. Existing working inline UI remains untouched. Malformed/missing bounds remain hidden; asking rent is separate. No screen redesign or new automatic prediction.

Phase 2C is PREPARATION ONLY. Existing public location is the owner-confirmed 300m Web Mercator grid center, with legacy retained points potentially outside that projection. New pure reviewPublicGridPoint uses the existing grid utilities to identify shape only, rejects extra/private payload keys and returns no coordinates, always transmissionAllowed=false. Grid shape is not confirmation provenance, freshness, permission or lawful disclosure. The helper is not wired into prediction and adds no backend projection or network call. Both mapper coordinates remain typed/runtime null even if public/exact/latitude/longitude values are supplied. No real location values were read. Before any future enablement: research/privacy purpose and notice review, opt-out/missing rules, caller-scoped public-point projection only, saved identity/version provenance, freshness, private-data exclusion and hosted negative tests. Never fall back to exact_location, device GPS or geocoded addresses.

### Coordinated rollout - separate authorization required

1. Inspect current production history/catalog and establish a deployment freeze; do not rely on the earlier 27-row point-in-time preflight. Verify Phase 2A source/ACL/RLS/tenancy/identity guards, no partial columns or v2 collision, and exclude Tier 2 and UC-09 reconciliation. Create/verify the restricted external schema/catalog/roles backup described above; no backup is created by this local development task.
2. Apply ONLY the checksum-reviewed Phase 2A migration through the isolated history-recording mechanism. No db push or history repair. Verify the actual assigned version, unchanged prior rows, nullable/no-default fields, checks, v2 authenticated-only permissions and old-client contracts. Migration/rollback hashes remain unchanged. Rollback disables only v2 entry points, retaining data; coordinated client withdrawal and separate approval required.
3. Regenerate/compare database types against that confirmed applied schema; release the updated property forms/frontend separately. Verify existing null records, blank/zero, subtype pairs, owner/foreign/inactive cases, edit versions/receipts and tenancy restrictions. Existing v1 clients remain compatible and preserve saved new values. Current deployed proxy may still ignore new fields during this transition.
4. Separately approve deployment of ONLY rental-price-estimate from the validated checkpoint, including index.ts, handler.ts, RentalPrediction.ts and RentalModelAttributes.ts. Keep verify_jwt=true, existing secrets and legacy estimate-rental-price unchanged. Command: supabase.cmd functions deploy rental-price-estimate --project-ref cxfsbwbwmwmgtqfonqth. No migrations, --prune, --no-verify-jwt, unrelated function or Render deployment. New proxy can safely use the legacy projection before Phase 2A, but backend-first remains the coordinated release order.
5. Verify new version/status/JWT/bundle hash, unchanged legacy bundle and real authorized owned/public prediction. Check canonical subtype plus zero/null lot/parking, denied anonymous/foreign/restricted cases, validation versus transient failure, malformed range and cancellation/account changes. No fabricated production fixtures. Android inline estimate/range/asking rent, Back, property/account changes and optional property fields remain required. Withdraw/redeploy only the proxy under separate authorization if needed; never erase stored attributes or weaken RLS. Phase 2C stays disabled throughout.

### Consolidated development evidence

Focused working-tree suite: 199 tests passed / 0 failed across Phase 2B, input fidelity, prediction/proxy/client, Phase 2A attributes/create/edit and inline UI lifecycle. TypeScript and whitespace pass. Native offline runtime v1.77.8 packaged the four sanitized modules: 47,041 bytes, SHA-256 6da92d1aba2fdc060fcac6788b82b812a68e1338a3d5fd0650ea79ea3f35465d. No env or secret mounts; no network; artifact outside Git and container automatically removed. Packaging verifies resolution, not hosted inference or model accuracy. Reference fixture amounts and trained artifacts unchanged. Scoped staged-checkpoint evidence is recorded below when complete. No production write, migration/Edge/Render deployment, secret retrieval or Android build.


Final checkpoint evidence: 176 focused tests passed / 0 failed against the exact scoped staged snapshot, including the new eight Phase 2B/C/range-dependency tests; TypeScript passes for staged and working sources. Working-tree total 199 includes the preserved unrelated inline UI tests. Phase 2A security regression: 68 PostgreSQL checks passed / 0 failed; disposable container removal confirmed. Native bundle source matches the four staged modules after LF/CRLF normalization. Scoped credential/artifact and whitespace checks passed. No production deployment or secrets access.
