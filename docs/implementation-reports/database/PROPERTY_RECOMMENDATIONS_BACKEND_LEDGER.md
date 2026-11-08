# Property recommendations backend ledger

## November 8, 2026 - Read-only contract inspection

Project cxfsbwbwmwmgtqfonqth. Catalog-only SELECTs inspected completeness constraints, public profile columns, public identity/Tier-2-related function definitions and verification_submissions SELECT policies. No personal user/listing rows were queried, no RPC was executed for a user, and no mutations occurred. One multi-statement inspection returned only its last completeness constraint result; a subsequent single JSON catalog query supplied the remaining contract evidence.

Confirmed listings_completeness_score_check constrains stored numeric values to [0,1]. Existing local trusted completeness function caps at 1; no formula/trigger/publishing threshold was modified.

get_public_identities(uuid[]) returns consent-protected id/nickname/avatar_path only. public_profiles exposes id/display_name/avatar_path/bio/account_status/trust_score/trust_badge/created_at, not Tier 2 status. No public is_tier2_verified function was found. verification_submissions reads are owner-or-Admin scoped. Therefore the recommendation service does not read profiles/submissions/documents to infer verification and does not award a Tier 2 bonus. Active authoritative approved owner-specific results can be scored by the pure engine if a safe contract becomes available through separate authorization. Unit approved/revoked/expired cases are synthetic, not live assertions.

Runtime service reuses manual published listing search under the caller's existing client/RLS, plus batch listing/completeness/property-amenity projections. Ownership must agree across listing, physical property and candidate; own/inactive/unpublished/inaccessible rows are excluded. No private location/identity field selected and no new grants/RPC/migration. All feature queries are reads; no Supabase deployment or production fixture.

161 focused tests and TypeScript/whitespace pass. No live end-to-end recommendation query or physical Android session was performed. Existing listing visibility enforcement remains unchanged; tests do not replace hosted RLS acceptance. See the living feature document for 100-result cap, snapshot limitations and neutral unknown-quality handling.
