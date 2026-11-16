# Feature 4: Ratings with tags, backend audit and design

Status: PROPOSAL, nothing applied. Date: 2026-11-16.

## Decisions (2026-11-16, they supersede the matching text below)
1. **Tag lists exactly as in the wireframe** (8 property, 6 tenant), **max 5 per review, enforced server-side**, deduplicated; property tags only on kind `property`, tenant tags only on kind `user`.
2. **New tenant to landlord reviews are rejected with 42501** (section 2.2). The one existing approved tenant to landlord row is **left untouched**.
3. **No publish notification** (section 2.6 is not implemented). Rejected reviews show a plain "Not published"; no reason codes.
4. **The 5-argument `submit_tenancy_review` stays as a wrapper that delegates to the new 6-argument function**, so the rejection and the tag rules cannot be bypassed. Both are granted to `authenticated` only, never `anon`.
5. **`get_review_summary(kind, id)` kinds are `property`, `tenant` and `landlord`** (not `user`). Approved reviews only. `tenant` = approved landlord to tenant reviews about that person; `landlord` = the average over approved **property** reviews across all of that landlord's properties. `public.profile_rating_summary` is never used.
6. **`get_tenancy_reviews` gains `received`**: the counterpart's approved reviews only (never pending, never an id).
7. Stars required 1-5, comment optional, same unique rule per (tenancy, reviewer, kind).
8. Patches are based on the **hosted** `prosrc`, with md5 pins and exactly-once anchors. The original definitions are copied into a private table by the migration itself so the rollback restores them byte for byte. Wireframe: `docs/design/rentlease_f4_ratings_v8.html` (source of truth for tag wording and screens). Feature 5 (profiles) consumes the aggregates in section 2.5.

Evidence: hosted project `cxfsbwbwmwmgtqfonqth`, read-only catalog queries (structure, privileges, triggers, function source and ACLs, Edge Function list and the `review-wordcloud` source, row counts only; no review text or user ids were read), plus the repo migrations `20261110125450_tenancy_ratings_reviews.sql` and `20261114200000_published_reviews_reviewer_role.sql`, and the app's parsers.

---

## 1. Audit findings

### 1.1 Tables (schema `rentlease_reviews`, live)
| Item | Finding |
| --- | --- |
| `entries` | `id uuid pk`, `kind text not null check in ('property','user')`, `tenancy_id uuid not null` (FK tenancies, RESTRICT), `property_id uuid not null` (FK properties, RESTRICT), `reviewer_id uuid not null`, `reviewee_id uuid`, `user_review_id uuid unique` (FK `public.reviews`, RESTRICT), `rating smallint not null check 1..5`, `body text check length<=2000`, `status text not null default 'pending' check in ('pending','approved','rejected','hidden')`, `revision uuid`, `created_at`, `updated_at`, `moderated_at` |
| Constraints | `UNIQUE (tenancy_id, reviewer_id, kind)`; check that a `property` row has no reviewee and no `user_review_id`, a `user` row has a different reviewee and a `user_review_id` |
| Indexes | `review_public_property` and `review_public_user` (partial, approved), `review_queue (status, created_at, id)` |
| `events` | immutable log: `review_id`, `actor_id`, `action`, `note`, `created_at` (trigger `review_events_immutable`; AFTER INSERT trigger `audit_review_decision` copies approve/reject/hide decisions to the admin audit schema) |
| `receipts` | `(actor_id, operation_id)` pk, `input`, `result`, immutable |
| RLS / grants | RLS on all three with **no policies**; `anon`, `authenticated`, `service_role` have **no table privilege and no schema USAGE**. All access is through definer RPCs. |
| Content guard | `review_content_immutable` (BEFORE UPDATE/DELETE on entries): everything except `status, revision, updated_at, moderated_at` is frozen; delete is refused. **A new `tags` column is therefore immutable after submit automatically.** |
| Tags | None exist: no column, table or RPC parameter. |
| Data | **3 entries, all approved**: 1 property review, 2 user reviews (1 landlord to tenant, **1 tenant to landlord**). 6 events (3 `submitted_pending`, 3 `approved`), 6 receipts, 2 legacy `public.reviews` rows, 1 ended tenancy. |
| Legacy | `public.reviews` (id, tenancy_id, reviewer_id, reviewee_id, rating, comment, timestamps). Still written for `kind='user'` (the `user_review_id` link). Policies: permissive read (authenticated, `true`), create-by-reviewer, update-by-reviewer-or-admin, plus restrictive `review_rpc_only` (ALL, false) which neutralizes them. Triggers: `managed_review_immutable`, `trg_validate_review`, `trg_reviews_updated_at`. |

### 1.2 RPCs (live; all `security definer`, `search_path=pg_catalog`, owner `postgres`, `anon` NO execute, `authenticated` execute)
| Function | md5(prosrc) | What it does |
| --- | --- | --- |
| `submit_tenancy_review(uuid,uuid,text,integer,text)` | `62fd03983b613f068191da462af4d693` | Active Tier 1 participant (via `rentlease_reviews.tenancy()`: READ COMMITTED, property advisory lock, tenancy `FOR SHARE`); validates kind in `property/user`, rating 1..5, text length; per-actor operation lock; receipts replay/`Conflicting retry`; tenancy must be `ended` with `actual_end_date`/`ended_at` set and not in the future; `property` only by the tenant; for `user` it inserts the legacy `public.reviews` row first, the target is "the other party", **either direction allowed**; inserts the `entries` row as `pending`, logs `submitted_pending`; returns `get_tenancy_reviews`. |
| `get_tenancy_reviews(uuid)` | `8503a84e55583636a0d2ede4e1d1272d` | Participant read: `eligible` and **`own`** reviews only (the caller's own rows, any status) and `legacyUserReview`. Returns nothing about the counterpart's review. |
| `get_published_rental_reviews(text,uuid,integer)` | `e0ba690c49e865d6e8c1f33b9aa209ea` (patched 2026-11-14, applied) | Approved reviews of an ended, eligible tenancy for a `property` or `user` target, 20 per page, `count` and `average`; each row has `reviewerRole`. Access: property = owner, a tenancy party, or a property with an active published listing; user = self, an ended-tenancy counterpart, or a landlord with an active listing. |
| `get_review_moderation(text,integer)` / `moderate_rental_review(uuid,uuid,uuid,text,text)` | `93e3270f...` / `70396ca92553684801e891ea2383e75f` | Admin queue and decision. Approve only if the tenancy is eligible; independent moderator (not a party, not the author or subject); revision check (`40001`); transitions pending to approved/rejected, approved to hidden, rejected/hidden to approved/rejected; a note is required; receipts. |

**How pending becomes published:** nothing automatic. Every new row is `pending`; an Admin approves through `moderate_rental_review`, which sets `approved` and rotates `revision`. Only `approved` rows appear in `get_published_rental_reviews`. **There is no notification** of any kind to the author on approve/reject/hide: `notification_type` has `review_request` and `moderation_notice` but no trigger or function emits them (0 rows), and none of the notification triggers covers `rentlease_reviews`.

### 1.3 What the app sends and reads
- Send: `submit_tenancy_review {p_tenancy_id, p_operation_id, p_kind, p_rating, p_text}` (`rentalReviewService.write`). Read: `get_tenancy_reviews`, `get_published_rental_reviews`, `get_review_moderation`.
- The parsers read named keys only and ignore unknown keys (`parseReviewContext`, `parsePublishedReviews`, `row()` in `shared/models/RentalReview.ts`), so **adding keys to responses is safe**; `own` is capped at 2 rows. The review UI hides tenant to landlord (`reviewScreenFor`); the server does not.
- Listing "Ratings & Reviews": tabs Property / Landlord / Themes (`RentalFeedbackSection`). Themes = `PropertyReviewWordCloud` through the Edge Function.

### 1.4 `review-wordcloud` Edge Function
Hosted: ACTIVE, version 2, `verify_jwt=true`, no service role. It calls the caller's own `get_published_rental_reviews('property', id, offset)` in a loop (3 scans for consistency, up to 10,020 reviews), then POSTs the review texts to the external Render service (`https://rentlease-ml.onrender.com/wordcloud`, shared secret `NLP_SHARED_SECRET`), validates the result and returns up to 24 terms. Hosted source read; it was not byte-compared with the repo copy. The external service remains unverified. The function validates specific keys per row and ignores extra keys, so adding `tags` to the rows does not break it.

### 1.5 Surprises
1. **One tenant to landlord review exists and is approved** (the server allows it; only the UI hides it). It is visible today through `get_published_rental_reviews('user', <landlord>)` and the listing's Landlord tab.
2. **No author notification** on approve/reject/hide, although the wireframe promises "We'll notify you when it's published".
3. `public.profile_rating_summary` (security invoker view over legacy `public.reviews`) averages **all** legacy rows, including unmoderated ones. Clients cannot read it (no grants, restrictive policy). **Feature 5 must not use it.**
4. The legacy permissive policies on `public.reviews` (read for any authenticated user) are neutralized only by the restrictive `review_rpc_only` policy (audit surprise 8, still true). `validate_review()` is anon-executable (trigger function).
5. Hosted Edge Functions not in this repo: **`send-sms` (`verify_jwt=false`, anyone can call it, source not read)** and the older `estimate-rental-price`. Out of scope here but worth a separate look.
6. Reviewer role is exposed, never an id. A two-party tenancy makes the counterpart obvious anyway, so the "cannot see who reviewed" line in the wireframe applies to the public profile, not to the tenancy.
7. `get_tenancy_reviews` has no read of the counterpart's review. Both parties' approved reviews are public elsewhere, so reading them in the tenancy adds no new disclosure but is a policy choice (decision 3).

---

## 2. Design

### 2.1 Tags: a column with a fixed list per kind
Fixed lists (wording from the wireframe; codes are what is stored; labels live in the frontend model):
- **Property** (tenant rates the property, 8): `clean` Clean, `good_wifi` Good wifi, `quiet` Quiet, `safe_area` Safe area, `fair_price` Fair price, `well_maintained` Well maintained, `matches_listing` Matches the listing, `good_location` Good location.
- **Tenant** (landlord rates the tenant, 6): `communicated_well` Communicated well, `respectful` Respectful, `paid_on_time` Paid on time, `kept_clean` Kept the place clean, `followed_rules` Followed house rules, `reported_issues_early` Reported issues early.

```
alter table rentlease_reviews.entries add column tags text[] not null default '{}'::text[];
create function rentlease_reviews.valid_tags(p_kind text, p_tags text[]) returns boolean
  language sql immutable set search_path=pg_catalog;      -- max 5, all distinct, every tag in the kind's list
alter table rentlease_reviews.entries add constraint entries_tags_valid check (rentlease_reviews.valid_tags(kind, tags));
```
A column with a CHECK (not a catalog table) because the list is fixed, rows are immutable, counts are a simple `unnest`, and the existing content guard already freezes it. Adding a tag later is a one-line migration. The 3 existing rows get `{}`.

### 2.2 `submit_tenancy_review`: tags, reject tenant to landlord, stars required, comment optional
The signature changes (a new parameter), so the function is **dropped and recreated**, not patched in place; the house patch technique (md5 pin, exactly-once anchors) applies to the other functions below.
```
public.submit_tenancy_review(p_tenancy_id uuid, p_operation_id uuid, p_kind text, p_rating integer, p_text text, p_tags text[]) returns jsonb
public.submit_tenancy_review(p_tenancy_id uuid, p_operation_id uuid, p_kind text, p_rating integer, p_text text) returns jsonb   -- kept as a thin wrapper: select ...(..., array[]::text[])
```
Changes inside the 6-argument function (everything else as today):
- **Reject tenant to landlord:** after the existing `property`-only-by-tenant check, `if p_kind='user' and a=t.tenant_id then raise exception 'Only the landlord can rate the tenant' using errcode='42501'`. Two directions only: tenant rates the property, landlord rates the tenant. The legacy `public.reviews` insert is therefore reached only for landlord to tenant.
- **Stars required:** unchanged (`rating` not null, 1..5 in the function and the table).
- **Comment optional:** `p_text := nullif(btrim(p_text), '')`; null or empty is stored as null; max 2000 as today.
- **Tags:** `coalesce(p_tags, '{}')` must pass `valid_tags(p_kind, tags)` else `'Check review tags'` 22023 (max 5, no duplicates, only the kind's list). Stored in the new column.
- **Same one-review rule:** `UNIQUE (tenancy_id, reviewer_id, kind)` is unchanged; a later tenancy is a new row.
- Receipts: the stored `input` gains `tags` and the normalized text, so a replay with different tags is `Conflicting retry`.
The 5-argument wrapper keeps an app build that has not shipped the tag screen working during rollout (it submits no tags and is subject to the same direction rule).

### 2.3 Reading
- **Own and counterpart (Feature 1 deviation):** patch `get_tenancy_reviews` (anchors, pin `8503a84e...`): add `'tags',e.tags` to each `own` row and a new key
  `received`: approved reviews about me in this tenancy: `kind='user' and reviewee_id = me`, or `kind='property'` when I am the landlord; each `{id, kind, rating, text, tags, createdAt, reviewerRole}`, **only `approved`**, never pending, never an id. Existing clients ignore the key.
- **Published rows:** patch `get_published_rental_reviews` (anchors, pin `e0ba690c...`): add `'tags', q.tags` to each row (one anchor at the `reviewerRole` expression).

### 2.4 Summary read for the listing and for profiles
```
public.get_review_summary(p_kind text, p_target_id uuid) returns jsonb
-- p_kind in ('property','tenant','landlord')   (decision 5: 'tenant' replaces the earlier 'user')
-- { kind, targetId, count, average, distribution:[n1..n5], tags:[{tag, count}] }   tags: top 8, by count desc then code
rentlease_reviews.can_read_published(p_actor uuid, p_kind text, p_target uuid) returns boolean    -- private helper
```
Same filters as `get_published_rental_reviews` (approved, ended and eligible tenancy). `property`: that property's property reviews. `user`: reviews about a person (tenant profile). `landlord`: property reviews across every property the target owns (the Feature 5 landlord rating). Access reuses the same predicates as `get_published_rental_reviews` through the private helper; because that function keeps its own inline copy, the SQL checks assert both agree for owner, party, active-listing and stranger cases (a drift test, not a patch of the big function).

### 2.5 How tag counts feed the screens
- **Listing, Reviews / Themes:** the summary header (big average, review count, top tags with counts) is `get_review_summary('property', propertyId)`. The Themes tab shows the same tag counts (deterministic, no external service). The word cloud (`review-wordcloud`) stays as a secondary view with its own "not available right now" state; nothing depends on it.
- **Profiles (Feature 5):** tenant profile = `get_review_summary('user', tenantId)` (tenant tags); landlord profile rating = `get_review_summary('landlord', landlordId)` averaged across their properties, with property tags. The whitelist profile RPC in Feature 5 can embed or call these.
- **Never** use `public.profile_rating_summary` (it counts unmoderated reviews).

### 2.6 Pending to published, visible to the author
Unchanged state machine. The author's pending/approved/rejected/hidden state is already in `get_tenancy_reviews.own[].status` (frontend only: the "Review sent" screen). Optional notification (stretch, cuttable): one anchor patch in `moderate_rental_review` (pin `70396ca9...`) calling
`rentlease_notifications.emit(e.reviewer_id, 'review:'||e.id||':'||p_status, 'moderation_notice', 'Your review was reviewed', 'tenancy', e.tenancy_id)`.
Using kind `tenancy` and the tenancy id means the existing in-app routing opens Tenancy details; `get_in_app_notification_target` does not need a change. A rejection reason for the author is **not** exposed (admin notes are internal); the UI shows "Not published".

---

## 3. Migration plan
1. **Backup:** `scripts/predeploy-backup/New-PredeployBackup.ps1` into `C:\RentLease-Backups\` with `-Schemas public,rentlease_reviews`, `-Functions` the five public review functions, `-Tables public.reviews,rentlease_reviews.entries,rentlease_reviews.events,rentlease_reviews.receipts`, `-ForwardSql` and `-RollbackSql`.
2. **File:** `supabase/migrations/<ts>_review_tags.sql`, `begin ... commit`, applied with `db query --linked -f`, then `migration repair --status applied <ts>`. Never `db push`.
3. **Guards (abort on mismatch):** the md5 pins above for `submit_tenancy_review`, `get_tenancy_reviews`, `get_published_rental_reviews`, `moderate_rental_review`, `get_review_moderation`; `entries` columns and constraints exactly as in 1.1 (no `tags` column yet); no client privilege on the three tables or the schema; RLS on, 0 policies; triggers exactly the three on `entries`/`events`/`receipts` plus `audit_review_decision`; `get_review_summary` and `valid_tags` absent; the 6-argument overload absent.
4. **Order:** column and check, helper, new 6-argument function, 5-argument function replaced by the wrapper, anchor patches (`get_tenancy_reviews`, `get_published_rental_reviews`, optional `moderate_rental_review`), `get_review_summary` and its helper, grants (`revoke all ... from public,anon,authenticated,service_role; grant execute ... to authenticated`), post-conditions (grants, md5 of every changed function recorded, owner/ACL/config unchanged).
5. **Rollback** (`supabase/test-support/review_tags_rollback.sql`, data-retaining): restore the original 5-argument function and the two patched functions from the pinned originals (reverse anchors, md5 verified), drop the 6-argument function, `get_review_summary` and the helper. The `tags` column and any stored tags stay. A second file removes the column and constraint only when every `tags` is empty.
6. **Checks** (rollback-only, fixture built inside the transaction, same method as the rent ledger): both directions (tenant to landlord rejected, landlord to tenant accepted, tenant to property accepted); tags: 0 to 5 ok, 6 rejected, duplicate rejected, wrong-kind tag rejected, null treated as none; comment null/empty/whitespace/2001 chars; stars 0 and 6 rejected; one review per (tenancy, reviewer, kind), replay idempotent, conflicting retry with different tags; tags immutable after submit and after approval; pending rows invisible in published reads, approved rows show tags; `received` shows approved only and never pending; summary counts, average, distribution and tag counts for property/user/landlord, including a hidden review dropping out; access parity with `get_published_rental_reviews` (owner, party, active listing, stranger denied); anon denied on every RPC; nothing remains after rollback.

## 4. Risks
- The existing approved tenant to landlord review stays visible unless an admin hides it (decision 2).
- Changing the submit function replaces the one write path; the wrapper keeps old clients working, and the 6-argument function is the only one carrying the new rule.
- `get_review_summary` duplicates the access predicate; the parity checks are the guard.
- Notifications reuse `moderation_notice`; if the app does not render that type it shows the generic title.
- Word cloud still depends on the external Render service; it is now secondary.
- With only 3 reviews, the demo needs a few seeded approved reviews (made through the real flow and admin approval, not by direct SQL) for the Themes counts to look real.

## 5. What to cut if time is short (demo Nov 23)
1. Publish notification (2.6).
2. `received` on `get_tenancy_reviews` (counterpart line).
3. `distribution` in the summary.
4. The `landlord` summary kind (Feature 5 can use `user`-less profile later).
5. The 5-argument wrapper (only if the app ships with the new screen at the same time).
Must keep: tags column and check, `submit_tenancy_review` with tags and the tenant to landlord rejection, tags on published rows, `get_review_summary('property', id)`.
Rough plan: migration, SQL checks and rollback 1 day, apply and re-verification half a day, frontend (rate flow, pending screen, listing summary and Themes) 2 days, device test 1 day.

## 6. Decisions needed from you (ANSWERED, see the top of this document)
1. Tag lists and wording exactly as in 2.1 (8 property, 6 tenant, max 5)?
2. The existing approved tenant to landlord review: leave it, or have an admin hide it through the normal moderation action?
3. Show the counterpart's approved review in Tenancy details (Feature 1 line)? The two parties know each other, so it adds no new disclosure.
4. Include the "your review was reviewed" notification, or cut it first?
5. Rejected reviews: a plain "Not published" (recommended) or admin-chosen reason codes?
6. Keep the 5-argument `submit_tenancy_review` as a wrapper (recommended) or break old builds?
7. Landlord rating for Feature 5: average of property reviews across their properties (recommended)?
