# Rental price estimate proxy - prepared only

Not deployed. No production secret has been configured. Contract source: [Rentlease-Features dee06f16fe182361b1d9d7e6ecf35f41703bf1a6](https://github.com/johnkamantig/Rentlease-Features/tree/dee06f16fe182361b1d9d7e6ecf35f41703bf1a6).

## Required deployment configuration (separate authorization)

Target Supabase project: `cxfsbwbwmwmgtqfonqth`.

| Variable | Scope | Value/purpose |
| --- | --- | --- |
| `ML_SHARED_SECRET` | Edge Function secret ONLY | Must match the private `ML_SHARED_SECRET` already configured on Render. Obtain it through the team's secure channel; never put it in this repository, chat, or `EXPO_PUBLIC_*`. |
| `ML_API_URL` | Edge Function environment | `https://rentlease-ml.onrender.com` (default). Only this HTTPS host is accepted; `/predict` is fixed. |
| `SUPABASE_URL` | Built-in Edge environment | Target project's API URL. |
| `SUPABASE_ANON_KEY` | Built-in Edge environment | Target project's public anon key; caller JWT supplies authorization. No service-role credential is used. |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Existing app environment | Existing target project configuration; no new public ML variable or secret. |

Keep `[functions.rental-price-estimate] verify_jwt = true` in `supabase/config.toml`. The handler independently verifies the user via Auth and rejects anonymous users; existing `is_tier1_verified` enforces active eligibility. All database requests carry that user's JWT and are subject to existing RLS. Do not disable gateway JWT checking to bypass a deployment problem.

When authorized, set the two ML variables in the Supabase dashboard's Edge Function secrets interface (or an appropriately protected external env file), then deploy **only** this function:

```powershell
supabase functions deploy rental-price-estimate --project-ref cxfsbwbwmwmgtqfonqth
```

This command is documentation, not evidence of execution. No database push, migration or Render modification is necessary. CLI bundling includes the dependency graph and must include `../../../src/shared/models/RentalPrediction.ts`, imported by the handler. Native packaging was verified November 8 using the official Edge runtime v1.77.8 selected by installed CLI 2.122.0: its bundle command resolved all three modules, including the shared source outside the function directory. Network was disabled and only a sanitized three-file source copy was mounted. Hosted gateway/HTTP acceptance remains pending. Do not copy the server secret into a public environment variable to work around packaging or authentication errors.

## Contract and security

POST body is exactly `{ "listingId": "uuid" }` or `{ "propertyId": "uuid" }`; all feature overrides/extra fields are rejected. Owned properties and owned listings (including drafts) are allowed. Nonowners require an RLS-visible active published listing, active physical property, and reached availability date. Listing/property owner and IDs must match. Direct property IDs alone never authorize nonowners.

Server reads only selected property features, listing rent, and catalog amenity names. It never selects private or public location fields, Auth identity details for inference, or verification documents. Optional location, lot-area and parking inputs are null for model imputation. Property types are restricted to house/apartment/condominium; positive floor area is a deliberate app quality requirement stricter than the API. No price or other record is written.

The handler bounds request bodies at 2 KB, has a 70-second overall deadline, refuses upstream redirects, returns sanitized failure codes and no-store responses, and suppresses same-user concurrent requests within one function instance. This is not a distributed rate limiter. There are no automatic retries. The app waits up to 85 seconds and ignores/cancels stale requests. Client cancellation cannot guarantee the remote model has not already begun computing.

Success returns `estimatedMonthlyRent`, `currency`, `modelVersion`, `target`, `askingRent` (nullable) and proxy receipt time `predictedAt`. The illustrative upstream `range_min`/`range_max` values are discarded. No statistically valid confidence interval is available. `/health` reports status only, not a model hash. `development-v1` is a broad upstream label; the response does not cryptographically attest the source commit or loaded artifacts.

## Post-deployment acceptance still required

Verify an authorized user request, a denied anonymous/restricted request, denied foreign property ID, and an allowed public listing. Confirm a real Render prediction and compare the source/artifact deployment with the pinned contract. Then test narrow-screen Android selection, inference, network failure/retry, Back, property/account changes and current listing navigation. Do not fabricate a successful response while Render is unreachable. Disable/remove only this function to withdraw inference; there is no data migration to roll back.


## Predeployment checkpoint review - November 8, 2026

Native ESZIP packaging passed: 33,446 bytes; SHA-256 `eb867ef8b17dd5485997217702ca6d3137b13a3a43d075ba8ab7ed321fd99813`. Runtime image digest `sha256:178c041398a33ded8219344382d0672a90051d1babbf0af03425cafe20039a75`. Used the runtime's actual `bundle --entrypoint ... --output ...` command, not a TypeScript-only substitute or a deployment command. Standalone Deno is not installed; the native Linux Edge runtime container supplies the packaging engine. The disposable container was automatically removed. Generated ESZIP and sanitized source copy are outside Git under the local temporary directory.

Current CLI help was checked: no deploy dry-run flag exists; no deployment command was executed. Current [platform limits](https://supabase.com/docs/guides/functions/limits) allow 150 seconds for request idle timeout and free-worker lifetime, above the 70-second proxy deadline and 85-second app wait. Native packaging is not hosted gateway/JWT/RLS or Render acceptance. Source-pinned model behavior was rechecked without calling Render. Model quality remains limited by imputed latitude/longitude/parking/lot area, exact-name amenity matching and unknown category coverage; no confidence band is claimed.

444 focused tests passed, including 57 estimator/proxy tests. TypeScript, whitespace and checkpoint credential scan passed. No material security issue found in this scoped source review. Ready for a separately authorized controlled deployment/configuration; not yet live-verified or Android-accepted. No secrets were configured and no production endpoint/data was modified.
