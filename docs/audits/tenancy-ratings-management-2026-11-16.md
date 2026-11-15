# Audit: tenancy, ratings, profiles and property management (2026-11-16)

Read-only. No code, migration, data write or commit was made. Nothing was read from row data: the live database was queried through
catalog views only (`pg_class`, `pg_attribute`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_proc`, `pg_get_viewdef`,
`supabase_migrations.schema_migrations`) plus `list_edge_functions`. Reservation `d67d5332-39f6-45b7-b4f3-8e81396d490e` was not touched,
not queried and not named in any query.

Sources: repo migrations in `supabase/migrations/`, the app in `src/`, and the hosted project `cxfsbwbwmwmgtqfonqth` (catalog only).
"Live" means the hosted catalog on 2026-11-16. "UNVERIFIED" means I could not confirm it.

Hosted vs repo: 45 migrations in both. `20261114200000` (reviewer role) **is applied** (live `get_published_rental_reviews` md5
`e0ba690c...`, the post-patch value pinned in `20261114200000_published_reviews_reviewer_role.sql:15`), even though its header says "NOT APPLIED"
(`:1`). Repo migrations do not reproduce the hosted schema exactly: `public.reviews` is not created by any repo migration (grep), and
`public.ratings`, created by `20260707100000_ratings_reports_trust.sql:3`, does not exist live. Cause UNVERIFIED.

---

## A. Ratings: data model and rules today

### A1. Tables, constraints, ties
- `rentlease_reviews.entries` (current source of truth for publication), `20261110125450_tenancy_ratings_reviews.sql:10-20`:
  `kind in ('property','user')`, `tenancy_id not null` (FK `public.tenancies`), `property_id not null`, `reviewer_id`, `reviewee_id`,
  `rating smallint 1..5`, `body <= 2000`, `status pending|approved|rejected|hidden`, `revision`, timestamps.
  **`unique(tenancy_id, reviewer_id, kind)` (`:19`)**: each rating is tied to a tenancy, never just to a user or property.
  Check `:20`: property rows have no reviewee; user rows need a reviewee different from the reviewer and a legacy `user_review_id`.
- Companion tables: `rentlease_reviews.events` (immutable log, `:24,:39`), `rentlease_reviews.receipts` (idempotency, `:25,:40`).
  Content is immutable after submit (`guard_content`, `:41-44`); no edit and no delete.
- `public.reviews` (legacy, still written by `submit_tenancy_review` for `kind='user'`, `:86`). Live columns: id, tenancy_id, reviewer_id,
  reviewee_id, rating, comment, created_at, updated_at. Live constraints: `UNIQUE (tenancy_id, reviewer_id)`, `reviews_not_self`,
  rating 1..5, FK tenancy `ON DELETE CASCADE`. Raw access is shut: restrictive policy `review_rpc_only` (`:50`, live `pg_policies`: `ALL`, `false`).
  An old permissive policy `reviews_read_authenticated USING (true)` still exists live but the restrictive policy overrides it.
- View `public.profile_rating_summary` (live): average and count from `reviews` per reviewee. `security_invoker=true`, `SELECT` granted
  to `authenticated`, but it reads `reviews` through the restrictive policy, so it returns nothing to app roles. **No app code reads it** (grep).

### A2. Who can rate whom, and when (RPC `submit_tenancy_review`, `:74-92`)
- Actor must be active Tier 1 (`rentlease_reviews.actor`, `:56`) and a participant of the tenancy (`tenancy()`, `:61-65`).
- Tenancy must be completed: `status='ended'`, `actual_end_date` and `ended_at` set and not in the future (`:82`).
- `kind='property'` only by the tenant (`:83`).
- `kind='user'`: reviewee is the other participant (`:85`), so **both directions are allowed by the backend**: tenant to landlord and
  landlord to tenant.
- **The UI deliberately offers only two directions** (decision D1): tenant reviews the property, landlord rates the tenant.
  `src/shared/models/RentalReview.ts:44-55` (`reviewScreenFor`: tenant gets `property`, landlord gets `user`; comment at `:33` "The tenant is never
  offered a rating of the landlord"). So **tenant to landlord is possible in the backend but not reachable in the UI.**
- Once per tenancy per kind per reviewer (`:19` unique; UI hides a kind already submitted, `RentalReview.ts:24,48`). Never, if the person doesn't
  do it: there is no prompt or deadline. Cannot be edited (`:41-44`).
- Publication: every new row is `pending`; an independent Admin approves, rejects or hides (`moderate_rental_review`, `:112-129`; status
  machine `:125`; participants and the source tenancy's parties cannot moderate, `:123`). Nothing is public until approved.

### A3. Repeat behavior (today)
- Same tenant rating the same property after a later tenancy: **yes**. Uniqueness is per tenancy id, so a new tenancy is a new row.
- Landlord rating the same tenant on a later tenancy: **yes**, same reasoning.
- Constraint that limits it: only one open tenancy per listing (`idx_one_open_tenancy_per_listing`, live: `UNIQUE (listing_id) WHERE status in
  ('proposed','pending_confirmation','active')`). Nothing caps reviews across tenancies. Nothing contradicts one-rating-per-tenancy; the
  backend enforces exactly that.

### A4. Screens: create, display, fields
- **Create:** Tenancy details, ended tenancy, "Leave a Review / Review Submitted" (`src/features/tenancy/views/TenancyDetailsView.tsx:29`) opening
  `TenancyReviewPanel` (`src/shared/components/RentalReviews.tsx:15-41`); also "Ratings & Reports" home to `TenancyReviewChooser`
  (`RatingsReportsFlowView.tsx:60`, `RatingsReportsHomeView.tsx:35`).
  `src/features/ratings-reports/views/ReviewFlowView.tsx` (258 lines, local `reviewDraft`) looks like an older preview flow; whether it is reachable is UNVERIFIED.
- **Fields:** 1 to 5 stars (`RatingScale`) plus optional text up to 2000 characters (`RentalReviews.tsx:34-35`). **No tags.**
  A live column search for tag/keyword/topic/sentiment on `public` and `rentlease_reviews` returned nothing.
- **Shown to other users:**
  - Listing detail, "Ratings & Reviews" with tabs Property / Landlord / Themes: `src/features/search-discovery/views/LiveSearchViews.tsx:85` using
    `RentalFeedbackSection.tsx:7-13`. Property tab = approved property reviews; Landlord tab = approved user reviews about the owner.
  - Ended tenancy details show published user reviews about both parties (`TenancyDetailsView.tsx:29`).
  - Own profile: `LandlordExperienceSection` titled "Landlord's experience with this user" (`ProfileView.tsx:68`, `LandlordExperienceSection.tsx:9-22`). It is the person's own profile; no other user sees it.
  - Reviews carry no reviewer name; rows have `reviewerRole` (landlord or tenant) since the applied patch.
- Read access rules: `get_published_rental_reviews` (`:93-105`): property reviews need a participant, owner or an active published listing (`:98`);
  user reviews need self, a shared ended tenancy, or the target being an owner with an active listing (`:100`).

### A5. The word cloud: it exists
- **Backend:** Edge Function `supabase/functions/review-wordcloud/` (`index.ts`, `handler.ts`, `README.md`). **Live: ACTIVE, version 2, `verify_jwt=true`**
  (`list_edge_functions`). It reads approved property reviews with the caller's JWT, then calls an external Python service
  (`NLP_API_URL=https://rentlease-ml.onrender.com`, per the README) and returns up to 24 terms. No table, column or SQL function stores terms.
- **Where the NLP runs:** `C:/dev/RentLease-Features/review-wordcloud/src/processor.py`, outside this repo. UNVERIFIED: that it is deployed, that `/wordcloud` exists on the
  Render host, that `NLP_SHARED_SECRET` is set on both sides. Docs say hosted live terms are not yet verified
  (`docs/features/RATINGS_REVIEWS.md`, T7B/T7C section).
- **Frontend:** `src/shared/components/PropertyReviewWordCloud.tsx`, `useReviewWordCloud.ts`, `reviewWordCloudService.ts`, `models/ReviewWordCloud.ts`.
  Rendered only in the **Themes** tab of listing detail (`RentalFeedbackSection.tsx:12`), property reviews only, never user reviews.
- **Trigger:** mounting that tab loads it, and returning the app to the foreground reloads it (`useReviewWordCloud.ts:14`). No background job.
- So it reaches a screen, but whether it works end to end depends on the unverified external service.

---

## B. Profiles and verification

### B1. Viewing another user's profile
- **No such screen.** `ProfileView` renders only the signed-in user (`src/features/authentication/views/ProfileView.tsx:34-35,68`; only mounted at
  `AuthProfilesFlowView.tsx:71`). Other users appear only as a nickname plus avatar (`PublicIdentityBadge`,
  `src/shared/components/PublicIdentityBadge.tsx:12`).
- The data comes from RPC `get_public_identities` (`publicIdentityService.ts`), gated by `public.can_read_public_identity`
  (`20261107134047_public_identity_nicknames_avatars.sql:41-47`): caller must be Tier 1 and the target must have an active listing or share a conversation.
  Exposed fields: `id`, `nickname`, `avatar_path` (parse in `publicIdentityService.ts`). Nickname/avatar only after the owner confirmed them.
- A landlord sees the applicant as the label "Renter" plus text "Tier 1 active ... Tier 2 approved." (`RentalReservationsView.tsx:19`).

### B2. How verification is stored
- Tier 1: auth email and phone both confirmed, set into `profiles.tier1_verified_at` by `sync_tier1_verification` (live function body).
- Tier 2 (`tier_2_identity`) and Tier 3 (`tier_3_property`): rows in `verification_submissions` (columns include tier, status, user_id, property_id, reviewed_by, reviewed_at).
  `verification_status` = pending, under_review, approved, rejected, cancelled, revoked; `verification_tier` = tier_2_identity, tier_3_property (live enums).
- **"Tier 2 approved"** = an Admin approved an identity submission via `review_verification_submission` (live), and the trigger
  `refresh_profile_verification_timestamps` sets `profiles.tier2_verified_at = max(reviewed_at)` of approved Tier 2 rows. Tier 3 is the
  property identity workflow (`rentlease_property_identity`, versioned review RPCs).
- `profiles` also holds `trust_score` (0.4 + 0.4 + 0.2 from the three timestamps), `suspended_until`, `suspension_reason`, `account_status` (live columns/default).
- **Readable by the client for OTHER users:** only through RPCs, not tables:
  `get_rental_reservations` (landlord sees applicant tier flags, `20261106130211_property_rental_reservations.sql:57-58`) and
  `get_recommendation_owner_verification` (owner Tier 2 flag per listing, consumed at `recommendationService.ts:16-18`).
- **What blocks direct reads:** `profiles_select_own` (live; only `auth.uid() = id`), `verification_submissions_read_owner_admin`
  (owner or admin), view `public_profiles` is `security_invoker` and returns NULL for bio, trust score, trust badge and created_at.

### B3. Verified badge in the UI today
- **No badge for other users.** Verification UI shows the user's own status (`VerificationStatusBadge.tsx`, `VerificationStatusIndicator`; used in
  `AccountVerificationSummary` on the own profile) and the owner's own property chip "Property verified" (`PortfolioCardPresentation.ts:15-24`).
- The only third-party display is the plain text "Tier 2 approved." to a landlord about an applicant (`RentalReservationsView.tsx:19`).
- Whether the recommendation flag is shown anywhere: no view string found by grep; it may only affect ordering. UNVERIFIED.

---

## C. Tenancy: states and the dead end

### C1. States and transitions
Reservation (`rental_reservations.status`, check constraint live: pending, approved, declined, cancelled, expired):

| From | To | By | Source |
|---|---|---|---|
| (none) | pending | tenant `request_rental_reservation` | `20261106130211...sql:78-109` |
| pending | approved / declined | landlord | `:135-143` |
| pending, approved | cancelled | either participant | `:143` |
| pending, approved | expired | either, once `expires_at` passed (approved expires at `end_date`, `:142`) | `:130-132` |
| declined, cancelled, expired | final | | `:129` |

Tenancy (`tenancy_status` live: proposed, pending_confirmation, active, ended, cancelled):

| From | To | By | Source |
|---|---|---|---|
| (reservation approved) | pending_confirmation | landlord `establish_tenancy` (never inserts `proposed`) | `20261110055859_tenancy_establishment.sql:76-77` |
| pending_confirmation | cancelled | either, action `cancel` | `:96` |
| pending_confirmation | active | tenant `confirm` if start date reached, else landlord/tenant `activate` after start | `:104-112` |
| proposed / pending_confirmation | owner `review` resets tenant confirmation | landlord | `:100-103` |
| active | ended | `complete` after expected end, or two-party `request_end`/`accept` | `20261110091413_tenancy_completion_termination.sql:72-91` |
| cancelled, ended | final (no RPC leaves them) | | `:95`, `:70` |

Side effects: `sync_listing_from_tenancy` sets the listing `rented` on `active`, and `archived` only when an `active` tenancy ends or is cancelled (live
function body), so cancelling a pending setup leaves the listing untouched. Ending requests: `rentlease_tenancy_end.requests` pending/accepted/rejected/withdrawn
(`:13`). Guard `aac_reservation_tenancy_commitment` blocks a tenancy overlapping someone else's approved reservation
(`20261106130211...sql:152-162`). Admin may write tenancies directly (`tenancies_admin_manage`, live policy).

### C2. A cancelled upcoming rental (Em Cee's case)
Em Cee's actual rows were not read (no row data, and the reservation above is off limits), so the state below is derived from the code: UNVERIFIED for that person.
- **State:** tenancy `cancelled` while its reservation is still `approved` (cancelling setup only updates the tenancy, `respond_tenancy_establishment:96`).
- **Where it shows:** Tenancy tab, section "Upcoming Rentals" (reservation card with the notice, `TenancyWorkspaceView.tsx:32`) **and** section "Cancelled Rentals"
  (`:33`), so it appears twice (`TenancyWorkspace.ts:8` keeps such reservations in `upcoming`; `CancelledRentals.ts:24-28` lists the tenancy).
- **Actions the UI offers:** the line "This rental was cancelled" plus one link: **"Request again"** (tenant) or **"Open conversation"** (landlord), which only opens the
  conversation (`CancelledRentals.ts:16-20`, `TenancyWorkspaceView.tsx:18`). The cancelled tenancy has no details link (rows in `:33` have none).
- **Why it is a dead end:**
  1. "Request again" lands in the conversation's reservation request. `request_rental_reservation` refuses while the old approved reservation is unexpired:
     `'Active overlapping reservation request already exists'` (23505, `:102`) and `'Unit already reserved for this period'` (23P01, `:104`). The app shows
     "An active reservation request already exists. Refresh to review it." (`reservationService.ts:21-22`), which does not say what to do.
  2. The landlord cannot re-establish: `establish_tenancy` fails with "This reservation already has a tenancy setup. Reload it." because the binding persists
     (`20261110055859...sql:72`; `rentlease_tenancy_setup.bindings` has `reservation_id` as primary key, `:14`).
- **What the backend allows:** `respond_rental_reservation` action `cancel` works for either participant on a pending or approved, unexpired reservation
  (`:117,:129,:134,:143`). The UI exposes it as "Cancel reservation" in the Approved list (`RentalReservationsView.tsx:14`, `RentalReservation.ts:38-40`), but nothing on the cancelled-rental notice points to it.
- **What the backend does not allow:** reviving a cancelled tenancy (`:95`); a second tenancy on the same reservation (`:72`); hiding or removing a cancelled
  rental from the list (no RPC or column for it); "find similar" is not a backend feature.
- **Possible, not implemented:** request again (after the reservation is cancelled), remove from list (needs storage), find similar (frontend navigation to discovery).

### C3. Batch 1D finding: confirmed
A cancelled tenancy's approved reservation blocks "Request again". Exact checks, `20261106130211_property_rental_reservations.sql`:
- `:102` `exists(... rental_reservations where property_id=property and tenant_id=actor and status in ('pending','approved') and expires_at>clock_timestamp() and daterange(...) && daterange(p_move_in_date, ending))` raises `Active overlapping reservation request already exists` (23505).
- `:104` the same without `tenant_id`, `status='approved'` only: `Unit already reserved for this period` (23P01). Tenancy rows only block when `proposed`, `pending_confirmation` or `active` (`:103`), so the cancelled tenancy does not.
- Block ends only when the reservation is cancelled or expires (approved reservations expire at their end date, `:142`).
Minimal fix options (none applied):
1. **Frontend only (S):** add "Cancel reservation" to the cancelled-rental notice, calling the existing `respond_rental_reservation(..., 'cancel')`; then "Request again" works. No backend change.
2. **Backend, atomic (M):** in `respond_tenancy_establishment` action `cancel` also set the reservation to `cancelled` in the same transaction (needs revision bump and an `rentlease_reservations.events` row). Migration required.
3. **Backend, relax the check (M):** make `:102`/`:104` ignore approved reservations whose bound tenancy is cancelled (join `rentlease_tenancy_setup.bindings`). Migration required.

### C4. What the tenancy screens show (tenant and landlord)
Both roles use the same screens; wording changes by role only. Files: `src/features/tenancy/views/TenancyWorkspaceView.tsx`, `TenancyDetailsView.tsx`.
- **List (`TenancyWorkspaceView.tsx`, in order):** header "Tenancy" (`:27`), intro text (`:28`), three summary tiles Upcoming / Active / History (`:29`), loading/error cards (`:30`),
  "Upcoming Rentals" (`:32`: pending setups as rows, then approved reservations with "Establish tenancy" for landlord or "Review tenancy setup" for tenant, or the cancelled notice),
  "Cancelled Rentals" (`:33`), "Active Rentals" (`:34`), "Rental History" (`:35`), "Maintenance Requests" card (`:36`), "What you can do here" panel (`:37`), bottom navigation.
- **Row card (`:26`):** 68dp photo, title, generalized location, other party's `PublicIdentityBadge`, date range, a grey box with "Status: <status>", agreed rent, next scheduled rent date, link "View tenancy details", and "Review tenancy setup" for pending ones.
- **Details (`TenancyDetailsView.tsx`):** header block with photo and "Your rental"/"Your property tenancy - <status>" (`:26`); "Rental information" card with button "Completion and ending history" (`:28`);
  "Participants" card with identity badges, and for ended tenancies "Leave a Review / Review Submitted" plus published reviews of both parties (`:29`); "Rent schedule" card with
  "Rent dates and maintenance" (`:30`); buttons "Open existing conversation", "View property information", "View reservation reference" (`:31`).
  Sub-panels: lifecycle (`TenancyLifecyclePanel`: complete / request end / accept / reject / withdraw), care (`TenancyCarePanel`: rent dates, recorded obligations, in-app reminders, maintenance requests).
- **Colors/components used:** `ui.panel` cards, `colors.primaryPale` tiles and icon backdrops, `colors.primaryAction` for every link and icon, `colors.surface` for the status box
  (`TenancyWorkspaceView.tsx:40`, `TenancyDashboardIcon.tsx:5-6`). Chips: none (status is plain text). Buttons: text links on the list; `AppButton` on details.

---

## D. Tenancy screen visuals

- **Sections in order:** see C4.
- **Status shown as:** plain grey text "Status: active/pending confirmation/ended" (`:26`), and "Tenancy status: ..." inside the details card (`TenancyDetailsView.tsx:28`).
- **Every status looks the same: true for the Tenancy tab.** One `card` style for every section, one tile color (`primaryPale`) for all three summaries (`:40`), one icon color for every
  section, one link style for every action, no status chip, no per-state accent.
- **Contrast with My Rentals:** the landlord portfolio card already separates states with pills and tones: neutral/positive/attention/info/danger
  (`PortfolioCardPresentation.ts:67-72`, `PortfolioRentalCard.tsx:15-20`). That pattern is not used on the Tenancy tab.
- **Tokens available (`src/shared/theme/colors.ts`):** success `#8BC34A`; warning `#9A6414` / `warningSurface`; restricted `#9B2C2C` / `restrictedSurface`;
  info (blue) `identityInk` / `identitySurface`; positive `primaryAction` / `primaryPale`; neutral `textSecondary` / `surface`; trusted and premium sets. Enough to separate
  pending (warning), active (positive), ended (neutral/info), cancelled (restricted/neutral).
- **Primary action per state today:** pending setup: "Review tenancy setup" (link); approved reservation: "Establish tenancy" or "Review tenancy setup" (link); cancelled: "Request again"/"Open
  conversation" (link); active and ended: "View tenancy details" (link). **No filled primary button on the list.** Details: "Open existing conversation" is the only filled button.

---

## E. Property management today

### E1. What a landlord can do after posting
| Action | Screen / ViewModel | One tap from landlord home? |
|---|---|---|
| See all properties, search, filter Published/Drafts/Rented | `PropertyDashboardView` ("My Rentals"), `usePropertyListingViewModel` | Yes (Listings tab) |
| Edit listing / edit property details | card primary and overflow menu (`PortfolioCardPresentation.ts:37-54`), the same 4-step wizard | Yes |
| Pause, reactivate, archive | `PublishedListingStatusView` "Manage Status" (`:31-38`), `lifecycleActions` (`ListingLifecycle.ts:11`) | Two taps (card menu > Manage status) |
| Create a new listing after archive | card primary "Create a new listing" | Yes |
| Delete | only unfinished posts (`UnfinishedPostDeletionAction`; Edge Function `delete-unfinished-post`, live ACTIVE) | Via the card |
| Property verification | card status row (`PortfolioRentalCard.tsx:58`) | Yes |
| View reservation/viewing requests | "Manage Requests" composed by the root (`PortfolioCardPresentation.ts:35`, `PortfolioRequestActivity`) | Yes (card) |
| View tenants / the tenancy | Tenancy tab (not linked to the property card) | One tap to the tab, none to a given property's tenancy |
| See ratings received | own profile section and Tenancy details (ended); no per-property view for the landlord | No |
| See rent or payment status | Tenancy details > "Rent dates and maintenance" (schedule and recorded obligations; no payment actions) | Three taps |
`ListingManagementView.tsx` (178 lines) is the older Figma-sample management screen ("Archived listings are retained only in this local preview", `:157`); not the real one.
The real "Manage Status" screen is flat: title, status text, completeness (drafts), one date, price estimate, "Edit Rental", lifecycle buttons, "Back" (`PublishedListingStatusView.tsx:26-38`).

### E2. Data for a manage-one-property dashboard
| Item | Queryable today? |
|---|---|
| Listing status, dates, completeness | Yes (`listings`, portfolio read) |
| Occupancy / current tenant | Yes, from `tenancies` (status active; RLS participants only) |
| Tenancy dates, agreed rent, due day | Yes (`tenancies`) |
| Rent due / paid | Partly: `rent_obligations` table exists (statuses upcoming, due, overdue, tenant_marked_paid, landlord_acknowledged, waived, disputed) and `get_tenancy_care` returns it, but **no RPC writes it** (`20261110072014_tenancy_rent_maintenance.sql:2` "No obligation/payment mutation"); whether rows exist is UNVERIFIED |
| Open maintenance requests | Yes (`get_tenancy_care`, `maintenance_requests`) |
| Pending reservation/viewing requests | Yes (root `requestActivity`) |
| Unread messages | Client has unread logic (`MessagingViewing.ts`, `MessagingCards.tsx`); server source not verified, UNVERIFIED |
| Ratings received (per property) | Yes (`get_published_rental_reviews('property', id)`); average and count included |
| Ratings received (landlord-level aggregate) | No RPC; would need new backend |
| Listing views | `listing_views` table exists (live); use UNVERIFIED |
A per-property dashboard can be composed from existing reads; payment tracking and a landlord-level summary need new backend.

### E3. Rent payment records, due dates, reminders
- Due dates: `tenancies.rent_due_day` (1 to 28) and the computed schedule (`TenancyCare.ts:33-37`); `rent_obligations` rows with `UNIQUE (tenancy_id, due_date)` (live).
- Payment records: **none written** by any RPC; the UI says "Payments, balances and overdue status are not tracked here" (`TenancyDetailsView.tsx:30`).
- Reminders: in-app only, created when the tenancy panel calls `check_reminder` (`write_tenancy_care`, `20261110072014...sql:87-91`); stated "does not send push notifications or run in the background" (`TenancyCarePanel.tsx`). No cron or push job found.

---

## F. What the changes cost

| # | Change | Size | Backend change? | Risk | Notes |
|---|---|---|---|---|---|
| 1 | One rating per tenancy per direction (tenant rates property, landlord rates tenant), repeatable on later tenancies, shown on profile and listings | **M** | Yes, small migration | Medium | Per-tenancy uniqueness already exists (`entries unique(tenancy_id,reviewer_id,kind)`). To keep exactly two directions, `submit_tenancy_review` must reject tenant `kind='user'` (today only the UI hides it): RPC change. Landlord-level and tenant-level summaries need new read RPCs. Reviews stay `pending` until Admin approval; Grab-style instant display would be a policy and RPC change |
| 2 | Viewable profile with Tier 2 badge and ratings summary | **L** | Yes: new RPC (and likely migration), RLS-safe | **High** (privacy) | `profiles` is own-row only and `public_profiles` NULLs trust fields. Needs a purpose-built RPC returning only: nickname, avatar, Tier 2 yes/no, review count/average. Must reuse `can_read_public_identity` rules. See surprises 2 and 3 |
| 3 | Landlord "Manage property" dashboard replacing the flat screen | **M** (L if payments) | No for status, tenancy, requests, maintenance, ratings; **yes** for payment status and landlord-level data | Low to medium | Composes existing reads. New screen replaces `PublishedListingStatusView`; keeps lifecycle actions |
| 4 | Restructured tenancy screen with distinct states and actions for cancelled/ended | **S to M** | Frontend only for status colors, chips, "Cancel reservation" on the cancelled notice, "Find similar", "Rent again". **Yes (M)** for atomic cancel (C3 option 2) or "remove from list" | Low (frontend), medium (backend) | Tokens exist (D). Remove-from-list needs a storage column or a local-only dismiss |

Migrations, RLS or Edge Function changes: items 1 (RPC), 2 (new RPC, possibly a view), 3 (only for payments), 4 (only for atomic cancel or remove-from-list). No item needs an Edge Function change;
the word cloud function and its external Python service are untouched by all four.
Protected components: none of the four needs edits to `ScreenContainer`, `PinnedFooter`, `RentLeaseBottomNavigation`, `FooterInsetContext`, `ShareWish` or `LocationShare`
unless a new bottom-navigation tab is added (item 3 or 4 may tempt that; avoid it).

---

## Surprises (not asked)

1. **Tenant to landlord rating is allowed by the backend but blocked only by the UI** (A2). A tenant calling `submit_tenancy_review(kind='user')` directly would succeed, which
   contradicts "one rating of the property by the tenant, one of the tenant by the landlord" at the data layer. The listing's "Landlord" tab (`RentalFeedbackSection.tsx:12`) can therefore
   only ever show such direct or legacy rows; the current UI cannot create them.
2. **Two SECURITY DEFINER functions are executable by `anon`** (live `has_function_privilege('anon', ..., 'execute') = true`): `is_tier1_verified(requested_user uuid)` and
   `can_access_tenancy(tenancy_uuid uuid, requested_user uuid)`. Anyone holding the app's public key could ask whether a given user id is Tier 1 verified, or is party to a given tenancy
   or an admin. Both need UUIDs, so exploitation is hard, but a public profile feature would make user ids easier to collect. Actual PostgREST exposure is UNVERIFIED. Also anon-executable:
   `update_my_profile` (guarded by `auth.uid() is null`) and trigger functions (not callable directly).
3. **`public_profiles` exposes `account_status`** (live `pg_get_viewdef`): any signed-in user allowed by `can_read_public_identity` can read whether a user is `restricted`, `suspended` or
   `deleted`. The view is not used by app code (`public_profiles` appears only in `database.types.ts`), so this is reachable only by direct client queries. A public profile must not build on it unchanged.
4. **`profiles` holds private fields next to public ones** (`suspension_reason`, `suspended_until`, `trust_score`, tier timestamps). Safe today because select is own-row only; any new
   profile RPC or view must whitelist columns.
5. **A cancelled setup appears twice** in Tenancy (Upcoming and Cancelled Rentals, C2).
6. **`20261114200000` header says "NOT APPLIED" but it is applied** live (md5 match). The repo's local-only claim is stale.
7. **Repo vs hosted schema drift**: `public.reviews` has no creating migration in the repo and `public.ratings` exists only in the repo (C-level reproducibility problem for any fresh environment).
8. **A legacy permissive policy `reviews_read_authenticated USING (true)` remains on `public.reviews`**; it is neutralized only by the restrictive `review_rpc_only`. If that restrictive policy were ever dropped, every
   signed-in user could read all raw reviews, including pending and rejected ones.
9. **`proposed` is a tenancy status that `establish_tenancy` never creates** (it inserts `pending_confirmation`); UI and constraints still carry it.
10. **Word cloud depends on an external Render service not in this repo and not verified**; the Themes tab will show an error state if it is down (docs: "unavailable deployments show an error").
