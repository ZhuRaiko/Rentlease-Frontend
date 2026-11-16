# Feature 5: Public profiles, backend audit and design

Status: AUDIT + PROPOSAL, nothing applied, no SQL file written. Date: 2026-11-16. Wireframe: `docs/design/rentlease_f5_profiles_v8.html`.

Evidence: hosted project `cxfsbwbwmwmgtqfonqth`, read-only catalog queries (function source, ACLs, policies, dependencies, columns, counts only; no profile, review or message content was read), the hosted Edge Function sources (`send-sms`, `estimate-rental-price`) and the repo. Feature 4's `get_review_summary` and the review tables are as applied on 2026-11-16.

## Summary
1. The profile RPC can be built on the existing identity rule with two small additions (tenancy parties, exclude blocked chats). The "landlord views an applicant before any chat" case cannot happen: every reservation and viewing request already has a conversation.
2. `public_profiles` is not a usable base: it is `security_invoker`, so the profiles RLS (own row only) means it returns only the caller's own row. The app never reads it. Do not build on it.
3. **Revoking `anon` does nothing.** The EXECUTE grant is to `PUBLIC` (`=X/postgres`). The revoke must be `from public`. Nothing in RLS, views, other functions, triggers, Edge Functions or app code needs anon on these two functions, so revoking is safe. Seven more functions in `public` have the same exposure, including `is_admin(uuid)` and `update_my_profile`.
4. "ID verified" is stored as `profiles.tier2_verified_at`, readable only by the owner. The app has two different definitions of it today. The property shield (Tier 3) has no public read at all.
5. `get_review_summary` cannot be reused as is for profiles (its access rule is stricter than the profile rule), but its aggregation can be shared through a private helper.

---

## 1. `can_read_public_identity(uuid)`

| Item | Finding |
| --- | --- |
| Signature / grants | `public.can_read_public_identity(p_target uuid) returns boolean`, `security definer`, `search_path=""`, owner `postgres`, ACL `{postgres, authenticated}`. **anon: no.** md5(prosrc) `ce7a49ff8184972232e5d000cb2135cc`. |
| Rule | True when the target profile is `active`, **and** the caller (`auth.uid()`) has an `active` profile, **and** either the target is the caller, **or** the caller is **Tier 1** (`is_tier1_verified(auth.uid())`) **and** one of: (a) the target is a landlord with an **active published listing** on an active property (status `active`, `published_at` set, `available_from` null or reached, Manila date); (b) the caller and target share a **conversation** (any status, either side). |
| Callers | `get_public_identities(uuid[])` (the only nickname/avatar read, up to 50 ids, returns `{id, nickname, avatar_path}` with confirmation flags and an avatar path regex) and the `public_profiles` view. No app code calls it directly. |

Cases:

| Case | Result |
| --- | --- |
| Tenant viewing a landlord with an active listing | Allowed (a) |
| Landlord viewing an applicant after the first message | Allowed (b) |
| **Landlord viewing an applicant before any chat** | **Cannot occur.** `rental_reservations.conversation_id` is `NOT NULL`, and viewing requests and reservations come out of a conversation created by `start_property_inquiry`. No gap. |
| Tenancy parties | Allowed only through the conversation. `tenancies.conversation_id` is **nullable** (0 null rows today). A tenancy with no conversation would hide the counterpart. A small gap to close in the new helper. |
| Conversation `blocked` or `closed` | Still allowed (no status check). 13 conversations, all `open`. Decision 2. |
| A landlord whose listings are all archived, with a past chat | Allowed through the chat only. A stranger is refused (correct). |
| Caller not Tier 1 | Refused. |
| Admin | Not allowed. Admins use the admin queues. |
| Self | Allowed. |

The rule does not say **why** someone can see the user. For profiles that matters (section 5.2): the public-listing path must not unlock a landlord's tenant history.

## 2. `public_profiles` and the `profiles` table

`public_profiles` (view, owner `postgres`, `security_invoker=true`, ACL `authenticated=r`; anon none):
columns `id, display_name, avatar_path, bio (always null), account_status, trust_score (null), trust_badge (null), created_at (null)`, `where can_read_public_identity(id)`. Nickname and avatar only count when confirmed; the avatar path is regex-checked.

- **Who can select:** `authenticated` only. **Because it is `security_invoker`, the base table's RLS applies to the caller.** `profiles` has RLS on with `profiles_select_own` (`auth.uid() = id`), so every caller sees **only their own row**. The view is effectively "my own public row". No app code reads it (only `database.types.ts`).
- **account_status exposure:** the view returns the real `account_status` column for the rows it shows, which is only the caller's own. If `security_invoker` were ever dropped, every readable user's status would appear. The RPC must never return it.
- **profiles columns:** `id, display_name, avatar_path, bio, account_status, tier1_verified_at, tier2_verified_at, tier3_verified_at, trust_score (generated from the three tiers), suspended_until, suspension_reason, created_at, updated_at, experience_preference, public_nickname, public_nickname_confirmed_at, avatar_public_confirmed_at, public_identity_version, public_identity_request_id/hash`.
- **Grants:** `authenticated` has table `SELECT` on **all** columns (including `suspension_reason`, `trust_score`, `tier2_verified_at`), limited to the own row by RLS. No `INSERT/UPDATE/DELETE` privilege, anon has nothing. 8 profiles, 6 Tier 1.
- **"ID verified" (Tier 2):** `profiles.tier2_verified_at`, set by the trigger `refresh_profile_verification_timestamps` as `max(reviewed_at)` of **approved** `tier_2_identity` submissions (`status` enum: `pending, under_review, approved, rejected, cancelled, revoked`; a revoked or cancelled submission drops out and the timestamp is recomputed). Only the owner can read the column. 3 profiles have Tier 2, 3 approved submissions.
- **Two definitions exist.** `rentlease_reservations.project()` sends `applicant_tier2 = tier2_verified_at is not null`. `get_recommendation_owner_verification()` uses a stricter "authoritative" rule (exactly one approved submission, `reviewed_by`/`reviewed_at` set and not in the future, and `tier2_verified_at = approved_at`). Profiles need one definition (decision 8).
- **Property verified (Tier 3):** `profiles.tier3_verified_at` is user-level (4 profiles). The per-property truth is `rentlease_property_identity.verified(property_id)` (private; approved submission bound to the current identity revision, same owner, no repair). The owner reads it through `get_owned_property_identity_statuses`. **No tenant-facing read exists**, so the green shield on listings has no data source today.
- **Roles:** `user_roles` (`tenant`, `landlord`, `admin`; owner can read own rows). 9 rows: admin 1, landlord 4, tenant 4, and **3 users hold more than one role**.

## 3. `is_tier1_verified(uuid)` and `can_access_tenancy(uuid, uuid)`

Both: `security definer`, `search_path=public`, owner `postgres`, argument `requested_user` has a default (`auth.uid()`), **ACL `{=X/postgres, postgres, authenticated}`**. The `=X` entry is a **PUBLIC** grant, so `anon` can execute them. `revoke ... from anon` removes nothing; `revoke ... from public` is required. Default privileges for `public` define nothing, so **every new function in `public` is PUBLIC-executable unless the migration revokes it** (the Feature 3 and 4 migrations did).

- `is_tier1_verified(uuid)`: `profiles.tier1_verified_at is not null and account_status='active'` for any uuid.
- `can_access_tenancy(tenancy, user)`: admin, or the user is tenant or landlord of that tenancy.
- What anon can do today: ask a yes/no question about any uuid (is this user Tier 1, is this user a party of this tenancy). No data rows. It is an oracle, not a leak of content.

### Dependents (hosted catalog, `pg_depend` plus a source search)
**RLS policies**, every one is `TO authenticated` (none is `PUBLIC` or `anon`):
- `is_tier1_verified`: `conversations` (`conversations_create_tenant`, `inquiry_conversation_event_scope`), `listings` (`listings_create_owner`, `listings_read_allowed`), `messages_create_participant`, `price_estimates_read_allowed`, `properties_create_verified_landlord`, `reports_create_verified_user`, `reviews_create_reviewer`, `saved_listings_owner`, `tenant_preferences` (`preferences_owner_admin`), `verification_submissions` (create tier2/tier3 self).
- `can_access_tenancy`: the maintenance policies (`maintenance_attachments`, `maintenance_requests`, `maintenance_updates`), `rent_obligations_read_parties_admin`, `storage.objects` (`storage_maintenance_insert_party`, `storage_maintenance_read_party`).

**Views / rules:** none depend on either function directly (`public_profiles` depends on `can_read_public_identity`).

**Functions that call `is_tier1_verified`:** about 50 in `public` and the private schemas, all `security definer` except `search_nearby_listings` (invoker) and all `authenticated`-only or no client grant: the messaging, viewing, reservation, tenancy, listing, saved listing, report, notification, nearby places, rent ledger, review (`rentlease_reviews.actor`), `can_read_public_identity`, `can_view_property` (anon), `get_recommendation_owner_verification`, `request_rental_reservation`, and the identity functions. Exactly one trigger function mentions it (`validate_verification_submission`). `can_access_tenancy` is called only by policies.

**Edge Functions:** hosted sources read (`send-sms`, `estimate-rental-price`); the repo sources for `rental-price-estimate`, `delete-unfinished-post`, `review-wordcloud`, `nearby-places` contain no call. None calls `is_tier1_verified` or `can_access_tenancy`. `estimate-rental-price` calls `rpc("is_admin")` **with the caller's JWT** (authenticated). `send-sms` is an Auth hook and uses no database function. **App code:** only `estimatePropertyService` calls `is_tier1_verified` (no argument, as `authenticated`).

**Who evaluates what:** policies and the invoker function `search_nearby_listings` run as `authenticated` and need its explicit grant (kept). Definer functions run as `postgres` (keeps EXECUTE). Trigger functions are not EXECUTE-checked at fire time. `anon` has **no table or view SELECT in `public`** (checked: none), so it never reaches a policy; `service_role` bypasses RLS.

### What breaks if PUBLIC/anon EXECUTE is revoked
- **anon:** direct RPC calls to these functions now fail with 42501. Nothing in the app does that. No policy, view or other function is evaluated as `anon`. Nothing breaks.
- **authenticated:** nothing, as long as its explicit grant stays (the migration re-grants `authenticated` and `service_role` right after the `revoke from public`).
- Rollback is one `grant execute ... to public`.

### Other anon-executable functions in `public` (read-only list; 27, `kind=f`)
- **Non-trigger, callable as RPC (9):** `can_access_conversation(uuid,uuid)`, `can_access_tenancy(uuid,uuid)`, `can_manage_property(uuid,uuid)`, `can_view_property(uuid,uuid)`, `has_app_role(app_role,uuid)`, `is_admin(uuid)`, `is_tier1_verified(uuid)`, `refresh_my_tier1_verification()`, `update_my_profile(text,text,text)`.
  - `is_admin(uuid)` and `has_app_role` let anon ask whether any uuid is an admin.
  - `can_view_property` and `can_manage_property` expose "can user X see/manage property Y".
  - `update_my_profile` and `refresh_my_tier1_verification` return/raise for anon because `auth.uid()` is null (harmless today) but should not be callable. The app calls neither (they exist in `database.types.ts` only).
- **Trigger functions (18):** `apply_moderation_action`, `enforce_property_photo_limit`, `handle_new_auth_user`, `log_maintenance_status_change`, `prevent_conversation_identity_changes`, `refresh_profile_verification_timestamps`, `set_maintenance_update_actor`, `set_updated_at`, `sync_listing_from_tenancy`, `sync_tier1_verification`, `touch_conversation_after_message`, `validate_conversation_participants`, `validate_maintenance_request`, `validate_message_sender`, `validate_review` (the one named in the brief), `validate_tenancy`, `validate_verification_submission`, `validate_viewing_schedule`. A function returning `trigger` cannot be called as an RPC, and anon has no table privilege, so these do not fire for anon. Leave them.
- Other schemas: no anon-executable function outside `public` (private schemas are closed).

## 4. Existing summaries and Feature 4

- **Nickname and avatar** are read only through `get_public_identities` (the app's `publicIdentityService.read`, via `usePublicIdentitiesViewModel`). Listings (owner row, search cards), the chat header and inbox, reservations, viewings and tenancy people all use it. It is gated per id by `can_read_public_identity`, so an unreadable id is omitted silently.
- **Reservation request screen** shows "Applicant: Renter. Tier 1 active. Tier 2 approved." from `applicant_tier1` / `applicant_tier2` in `rentlease_reservations.project()` (md5 `7bd83b0e...`, the weaker Tier 2 rule).
- **`get_review_summary(kind, id)`** returns `{count, average, distribution[5], tags[top 8]}` for `property`, `tenant`, `landlord` (approved, ended tenancies). Its gate is `rentlease_reviews.can_read_published`: self, **any tenancy**, **a pending/approved reservation**, and (landlord) an active listing. **It is not the profile rule**: a landlord who only has a *conversation* with a tenant passes `can_read_public_identity` but fails `can_read_published('tenant')`. The profile RPC therefore cannot just call it.
- **Reuse:** share the aggregation, not the gate. Add a private `rentlease_reviews.summarize(p_kind, p_target)` (same query as `get_review_summary`, no gate). `get_review_summary` stays untouched (pins stay valid) and the checks assert both return the same numbers. Alternative (patch `get_review_summary` to call the helper) rejected: a second patch of a function applied yesterday for no functional gain.
- Current data: 3 reviews, all approved. The demo needs a few seeded approved reviews made through the real flow.

## 5. Counts without exposing rows

| Wireframe item | Read |
| --- | --- |
| Active listings (landlord) | `count(*)` of `listings` with `status='active'`, `published_at` set, available, on an `is_active` property of that landlord. Same predicate as the identity rule. Listings are already readable by any Tier 1 (`listings_read_allowed`), but a count and a short card list from a definer RPC avoids opening the table. |
| Properties managed | **Naive `count(properties)` is wrong for the demo:** 34 properties, 33 `is_active`, but **only 10 ever had a published listing** (the rest are unfinished posts). Proposal: active properties with at least one published listing (decision 5). |
| Completed stays (tenant) | `count(*)` of `tenancies` where `tenant_id = target` and the same "ended and eligible" test the reviews use (`status='ended'`, `actual_end_date` and `ended_at` set and not in the future). `tenancies` RLS is parties and admin only, so this must be a definer count. |
| Rating, distribution, tags | The private summarize helper (section 4). Tenant: approved landlord to tenant reviews, plus distinct reviewer count ("From 3 landlords"). Landlord: approved property reviews across the landlord's properties. |
| Recent reviews | Approved rows of those same sets, newest 5: `rating, text, tags, createdAt, reviewerRole` and, for landlord rows, a property title. No reviewer id, no review id. |

## 6. Proposal

### 6.1 `get_public_profile(p_user_id uuid)`
```
public.get_public_profile(p_user_id uuid) returns jsonb      -- security definer, search_path=pg_catalog, authenticated only
```
Gate (new private helper `rentlease_profiles.can_view(p_actor, p_target)`): `public.can_read_public_identity(p_target)` (unchanged) **or** the caller and target are parties of one tenancy; **and not** a blocked conversation (decision 2). A refusal and a missing user both raise `42501 'Profile unavailable'` (no existence oracle). Null id: `22023`.

Return (whitelist only):
```
{ "id", "nickname" | null, "avatarPath" | null,            -- same confirmation and path rules as get_public_identities
  "idVerified": boolean,                                    -- one authoritative rule (rentlease_profiles.id_verified)
  "roles": ["landlord","tenant"],                           -- user_roles intersected with those two; never "admin"
  "relationship": boolean,                                  -- caller shares a conversation or tenancy with the target (false for self)
  "landlord": null | { "activeListings", "propertiesManaged",
      "rating": {"count","average"|null,"distribution":[5],"tags":[{"tag","count"}]},
      "listings": [{"listingId","propertyId","title","city","monthlyRent","propertyVerified"}],   -- up to 5 active
      "recentReviews": [{"rating","text","tags","createdAt","reviewerRole","propertyTitle"|null}] },  -- up to 5
  "tenant": null | { "completedStays", "reviewerCount",
      "rating": {...same...}, "recentReviews": [...] } }     -- only when relationship is true
```
Never returned: `account_status`, suspension fields, trust score or tiers, `created_at`, bio, emails, phones, review or reviewer ids. `landlord` is null unless the target holds the landlord role or owns a published listing; `tenant` is null unless `relationship` is true (a public listing must not unlock someone's tenant history, section 5.2 of the rule discussion; decision 3). Property titles come from the property's latest published listing, otherwise null ("A property").

### 6.2 Badge batch for lists
```
public.get_public_badges(p_user_ids uuid[], p_property_ids uuid[]) returns jsonb   -- authenticated only, each array at most 50
{ "users":[{"id","idVerified","landlord":{"count","average"}|null,"tenant":{"count","average","completedStays"}|null}],
  "properties":[{"id","verified"}] }
```
Same per-id gate as `get_public_identities` (unreadable ids are omitted); the `tenant` entry only with a relationship; a property is included only if the caller can already see it (`can_view_property`). It feeds the search card, chat header, reservation request and tenancy people so they never fetch a full profile. Property shield: `verified` is `rentlease_property_identity.verified(id)` through this RPC (no tier numbers leave the server).

### 6.3 Revoke migration (`..._revoke_public_execute.sql`, separate file)
Safe, because section 3 shows no dependent runs as anon. Change:
```
revoke execute on function <the 9 non-trigger functions> from public, anon;
grant  execute on function <the 9> to authenticated, service_role;
```
Guards: md5 pins of all nine, and the ACL is exactly `=X, postgres, authenticated` before; a second guard that no policy has `anon` or `PUBLIC` as a role and calls them; post-conditions: anon has no EXECUTE on any non-trigger function in `public` (only the 18 trigger functions remain), authenticated still has it on all nine. Rollback: `grant execute ... to public`. Smallest alternative if you want only the two named functions: the same statement for `is_tier1_verified` and `can_access_tenancy`; the evidence is identical for the other seven, so I recommend all nine (decision 1). Optional, not before the demo: `alter default privileges in schema public revoke execute on functions from public`, so future functions stop being public by default.

### 6.4 Opening the profile screen
New feature folder `src/features/public-profiles` (View, ViewModel, service; `get_public_profile` through a feature service). **No cross-feature View/ViewModel imports:** the existing pattern of root-owned callbacks (like `onOpenConversation`) carries a `userId`:
- Listing detail owner row (`LiveSearchViews`): the row becomes tappable, opens the **landlord** block.
- Chat header (`MessagingConversationView`): check next to the name, tap opens the profile; the other person's role picks the block.
- Reservation request (`RentalReservationsView`, and `ManagedReservation` in Manage): the applicant line opens the **tenant** block.
- Tenancy people (`PersonRow` in tenancy details and workspace): tap opens the profile; relationship is true, so the tenant block is available to the landlord.
Navigation is the root's screen state (as for tenancy details), with a back stack of one level. The screen reads one RPC and has plain loading, error ("Profile unavailable") and empty states ("No reviews yet": no stars, no average).

### 6.5 Verified check and shield data, surface by surface
| Surface | Name and avatar | Check (ID verified) | Rating | Property shield |
| --- | --- | --- | --- | --- |
| Search card | `get_public_identities` (today) | `get_public_badges.users` | `landlord.average` | `get_public_badges.properties` |
| Listing detail owner row | same | same | already `get_review_summary('landlord')` (Feature 4) | from the property |
| Chat header | same | `get_public_badges.users` | not shown | n/a |
| Reservation request (landlord) | same | `get_public_badges.users` | `tenant.average` and `completedStays` (replaces "Tier 1/Tier 2" text) | n/a |
| Tenancy people | same | same | not shown | n/a |
| Own profile | own row | `profiles.tier2_verified_at`, read by the owner today, shown as "ID verified" or "Verification pending" from the owner's own submissions | none | "Property verified" from the owner's own `tier3` data |
| Profile screen | `get_public_profile` | `idVerified` | full | per listing `propertyVerified` |
One shared `VerifiedCheck` and `PropertyShield` component, props only (boolean), labels never say "Tier". A missing check draws nothing.

## 7. Migration plan (nothing written yet)
1. **Backup** with `New-PredeployBackup.ps1` (`-Schemas public,rentlease_reviews`, the functions below, tables `public.profiles`, `public.user_roles`, forward and rollback SQL).
2. **Migration A `revoke_public_execute`** (6.3). Rolled-back checks as `anon`, `authenticated` and `service_role`: anon refused on all nine, authenticated unchanged, a policy-heavy read (conversations, listings, maintenance) still works, `search_nearby_listings` still works, `can_read_public_identity` and `get_public_identities` unchanged.
3. **Migration B `public_profiles`**: private schema `rentlease_profiles` (`can_view`, `id_verified`) and `rentlease_reviews.summarize`, then `get_public_profile` and `get_public_badges`. Guards: md5 pins of `can_read_public_identity` (`ce7a49ff...`), `get_public_identities` (`ef1a0176...`), `get_review_summary` (`78f27537...`), `can_read_published` (`cb155722...`), `rentlease_property_identity.verified` (`199b17b6...`), `is_tier1_verified` (`ddd2c8ed...`); `profiles`, `user_roles`, `tenancies`, `listings` columns and RLS as audited; none of the new objects exist. Grants: `revoke all ... from public, anon, authenticated, service_role`, then `authenticated` only. No new table, no column, no data change.
4. **Rollback B:** drop the two RPCs and the helpers (no data to keep).
5. **Checks (rollback-only, fixture in one transaction):** stranger refused; public landlord readable; shared conversation readable; blocked conversation refused; tenancy party readable; tenant block null for a public-listing viewer and present with a relationship; both-role user; admin role never appears; whitelist keys exactly (no extra key); counts (active listings, properties managed, completed stays) with draft, archived and unpublished fixtures; rating and distribution equal `get_review_summary` for the same inputs (parity); pending and hidden reviews excluded; no reviewer id anywhere; anon refused; `get_public_badges` omits unreadable ids and unseen properties; ids over 50 refused.
6. Apply with `db query --linked -f` and `migration repair`, never `db push`; hosted facts and pins recorded in the ledger.

## 8. Surprises
1. `revoke ... from anon` is a no-op here; the grant is to PUBLIC. New `public` functions are PUBLIC-executable by default.
2. Nine non-trigger functions in `public` are anon-callable, including `is_admin(uuid)`, `has_app_role`, `update_my_profile` and `refresh_my_tier1_verification` (the app uses none of them).
3. `public_profiles` is `security_invoker` over an own-row-only RLS table, so it is useless for other users, and its `account_status` column would leak if that setting changed. The app does not use it.
4. `authenticated` has column `SELECT` on every `profiles` column (suspension reason, trust score). RLS limits it to the own row; a future policy widening would expose them. The RPC reads the table as definer and returns a whitelist.
5. Two definitions of "ID verified" (weak in reservations, strict in recommendations).
6. No public source for the property shield; only a private function and an owner-only read.
7. 3 of 9 role rows belong to users holding more than one role, so "Landlord" or "Tenant" cannot be a single label.
8. 34 properties, only 10 ever published: "properties managed" must exclude unfinished posts.
9. `get_review_summary`'s access rule is stricter than the profile rule (no conversation-only case).
10. `tenancies.conversation_id` is nullable, so tenancy parties are visible only through the chat.
11. The blocked conversation status is not honored by the identity rule.
12. The wireframe sentence "Landlords see this profile when you request a reservation" is true for the tenant block through the chat, which exists earlier than the reservation. A landlord sees the tenant profile once a chat exists, not only after a request (decision 3).

## 9. What to cut for the Nov 23 demo
1. The property shield and the `properties` half of `get_public_badges` (needs a public read and UI; the profile listing rows can show no shield).
2. `get_public_badges` entirely: the search card keeps nickname and avatar; only the profile screen, chat header check and reservation applicant line need data (the profile RPC can serve those three).
3. `reviewerCount` and the profile listings list.
4. The seven extra revokes (keep the two named).
Must keep: `get_public_profile`, the revoke of the two functions, the profile screen from the owner row and the reservation applicant line.
Rough plan: backend and checks 1 day, apply and verify half a day, frontend 2 days, device test 1 day.

## 10. Decisions needed from you
1. **Revoke scope:** the two named functions only, or all nine (recommended: same evidence, closes `is_admin(uuid)`)?
2. **Identity rule:** keep `can_read_public_identity` as is and add, in the new helper, tenancy parties and "not blocked" (recommended), or keep it exactly?
3. **Tenant block:** only with a shared conversation or tenancy (recommended), so a public landlord profile never shows tenant history, or also publicly for people with a landlord role?
4. **Users with both roles:** return both blocks and let the entry point choose (recommended), or add a role argument?
5. **"Properties managed":** active properties with at least one published listing (recommended), or all active properties (34 today)?
6. **Review aggregation:** a private shared helper plus parity checks and `get_review_summary` untouched (recommended), or patch `get_review_summary`?
7. **Recent reviews on a landlord profile:** show the property title from the latest published listing, "A property" otherwise (recommended), or no title?
8. **ID verified:** one authoritative rule through a helper for profiles (recommended); also patch `rentlease_reservations.project()` (md5 `7bd83b0e...`) so the reservation text matches, or compute the check from the badge/profile read instead?
9. **Property shield and `get_public_badges`:** include, or cut as in section 9?
10. **Default privileges:** leave as is until after the demo (recommended), or add `alter default privileges ... revoke execute ... from public` now?

## Step 1 outcome (2026-11-16): decisions applied
Both migrations were applied: A `20261116150000_public_profiles` and B `20261116150100_revoke_public_execute`. Decisions as built: revoke scope all nine non-trigger functions (PUBLIC revoked, `authenticated` and `service_role` granted, `anon` none); `can_read_public_identity` unchanged and a private `rentlease_profiles.can_view` adds tenancy parties and excludes blocked conversations; `get_public_profile` returns the whitelist only and both blocks for users with both roles, the tenant block only for the caller's own profile or with a shared non-blocked conversation or a tenancy; properties managed = active properties with at least one published listing; landlord review rows carry the title of the latest published listing or "A property", tenant review rows carry no property name; the aggregation is a private shared helper checked for parity with `get_review_summary` (not patched); `idVerified` uses one strict private rule (the reservation projection was not patched); `get_public_badges` and the property shield are cut. Review change before apply: `roles` also contains `tenant` when the user is the `tenant_id` of any conversation or any `rental_reservations` row (any status), in addition to `user_roles` and tenancies; the tenant block stays gated by self or relationship.
