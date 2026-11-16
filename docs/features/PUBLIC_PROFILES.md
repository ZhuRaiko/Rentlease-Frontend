# Public profiles and the verified check

Backend: `20261116150000_public_profiles` and `20261116150100_revoke_public_execute`, applied and verified (ledger F5-M1, design [f5-profiles-backend-design.md](../design/f5-profiles-backend-design.md)). Wireframe: `docs/design/rentlease_f5_profiles_v8.html`.

## Behavior (frontend, November 17, 2026)
- **One read.** `get_public_profile(p_user_id)` returns a whitelist (id, nickname, avatarPath, idVerified, roles, relationship, landlord block, tenant block). The parser rejects any unknown or missing key and any malformed value; unknown tags are dropped. A refusal or missing user (42501) is a normal "denied" answer. A short per-session cache (60 s, by signed-in user and profile id, refusals included) with one shared request per id keeps lists from re-reading.
- **Profile screen** (`src/features/public-profiles`): landlord (avatar, name with the blue check, "Landlord", "N active listings . M properties managed", average with stars, distribution bars, "N reviews across their properties", tag counts, Listings that open the listing, Recent reviews with property title and month) and tenant ("N completed stays", average, "From N landlords", tags, "What landlords said" with role and month only, and the line "Landlords you talk to can see this profile. Reviewer names stay hidden."). Empty reviews: "No reviews yet" and the check. Unavailable: "Profile unavailable". The name falls back to "RentLease user".
- **Block choice.** The entry point passes the role it is about; if that block is null the other shows; if both are null, only the identity.
- **Small surfaces** (`src/shared/components/ProfileSurfaces.tsx`, one read each): listing owner row (name, check, `★ x.x landlord`, View profile), chat header (name with the check and "Landlord . <property>" or "Tenant"), reservation applicant line and the Manage waiting-request card ("Tenant . ★ x.x . N stays"), tenancy people (both parties, tappable). A refusal or failure draws no check, no rating and no error.
- **Verified check:** `VerifiedCheck` (blue circle, accessibility label "ID verified"); a missing check draws nothing. The word "Tier" appears in none of the new screens.
- **Navigation:** the root (`App.tsx`) owns a stack of overlays (a profile, a listing opened from a profile) and provides `useProfileNavigation().open(userId, role)`; Back (including the hardware button) removes the top overlay and returns to where it was opened.
- **Own profile:** the verification rows read "Account verified", "ID verified" and "Property verified" (no tier wording). No read of the owner's pending submission exists in the account snapshot, so "Verification pending" is not shown.

## Cut / stand-ins
Property shield and the search-result card check (no backend read). The digits on the own-profile verification rows are unchanged.

## Verification
Automated: `tests/publicProfiles.test.ts` and updated surface tests. Emulator (agent-observed, not user acceptance): profiles opened from the listing owner row, a conversation header and the tenancy people at 411dp/100% and 320dp/150%; 48dp targets by uiautomator. Not run on a device: the reservation applicant line and the Manage waiting-request card (no reservation request exists on the test account), a blocked or refused profile, an ID-verified landlord (the test landlord has no ID check).
