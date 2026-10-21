# Routes

No navigation dependency is installed, so `App` is the Expo application root rather than a named navigation route. The Authentication & Profiles ViewModel restores the Supabase session, loads the authoritative profile and complete role set, and owns the onboarding screen state. Non-active accounts are blocked. An active Admin goes to Admin Moderation based on the backend-loaded `admin` role; ordinary Tenant/Landlord accounts need confirmed email and Tier 1 before entering a marketplace workspace.

| Page | Path / Route | Component | Feature Folder | Auth Required |
|---|---|---|---|---|
| Application root | Expo root | `App` | N/A | No |
| Welcome / App Entry | Feature state: `welcome` | `WelcomeView` | Authentication & Profiles | No |
| Sign In | Feature state: `signIn` | `SignInView` | Authentication & Profiles | No |
| Create Account / Registration | Feature states: `registrationName`, `registrationNickname`, `registrationEmail`, `registrationPassword` | `RegistrationView` | Authentication & Profiles | No |
| Email Confirmation | Feature state: `emailConfirmation` | `RegistrationView` | Authentication & Profiles | No |
| Mobile Number Confirmation | Feature state: `mobileConfirmation` | `RegistrationView` | Authentication & Profiles | Yes |
| Account Verification Pending | Feature state: `verificationPending` | `RegistrationView` | Authentication & Profiles | Yes, Auth phone confirmed but Tier 1 pending |
| Role Selection | Feature state: `roleSelection` | `RegistrationView` | Authentication & Profiles | Yes, Tier 1 complete |
| User Profile | Feature state: `profile` | `ProfileView` | Authentication & Profiles | Yes |
| Edit Profile | Feature state: `editProfile` | `EditProfileView` | Authentication & Profiles | Yes |
| Account / Profile Settings | Feature state: `settings` | `SettingsView` | Authentication & Profiles | Yes |
| Account Restricted / Suspended | Feature state: `restricted` | `RestrictedAccountView` | Authentication & Profiles | Yes, blocked from workspace |

After authoritative checks, ordinary sign-in or completed onboarding opens `SearchDiscoveryFlowView` at Home / For You. Any active account whose role set contains `admin` opens Admin Moderation first, including accounts that also have Tenant or Landlord roles. The authenticated Profile state remains underneath the root-owned workspace. Matching Preferences are optional for ordinary accounts. Sign-out confirmation is rendered as a modal owned by `AuthProfilesFlowView`, and sign-out clears the workspace. See `docs/AUTH_SUPABASE_INTEGRATION.md` for the backend routing contract and unvalidated assumptions.

## User Verification feature states

Profile Verification and the Notifications verification action open `UserVerificationFlowView` in the existing root workspace/Modal for permitted ordinary marketplace accounts. It uses the real Tier 2 ViewModel/service and a separate Tier 3 property workflow for Tier 1-verified landlords. Tier 2 is not required for Tier 3. Admin routing, account restrictions, email/Tier 1 onboarding and role-selection precedence are unchanged. See [User Verification](features/USER_VERIFICATION.md).

| Flow | Production feature state | Component | Behavior |
| --- | --- | --- | --- |
| Verification levels | `overview` | `VerificationOverviewView` | Tier 1 read-only; Tier 2 available; Tier 3 owned-property entry for eligible landlords |
| Identity selection/review | `tier2Intro`, `tier2IdType`, `tier2Upload`, `tier2Review` | `TierTwoVerificationView` | Four supported ID types, real file selection and submission |
| Existing/resulting status | `tier2Status` | `VerificationStatusView` | Exact backend statuses; contextual recovery or reopen to reload; no resubmission |
| Property verification | Tier 3 `intro`, `property`, `documentType`, `document`, `review`, `status` | `TierThreeVerificationView` | Own properties -> four document types -> local file -> explicit submission confirmation; existing backend workflow; no resubmission |

Feature Back follows the active tier's sequence. Tier 3 intro Back returns to verification levels; Tier 3 status Back returns to owned-property selection. Overview Back/Close returns to Profile. Android Modal Back delegates to guarded feature navigation; picker/submission actions cannot be dismissed through those controls while active. Returning from Tier 3 to overview clears its local draft and invalidates asynchronous results without removing mounted subscriptions. No second navigation framework was added.

Tier 3's Submit for review action opens `review` as confirmation without writes. Confirm and submit invokes the existing workflow; Cancel/Back returns to local file selection with property/type/file retained. Document Back returns to `documentType`. The root `App.tsx` workspace composition and Auth routing are unchanged.

Legacy Tier 1/3 prototype route names remain disconnected; the production Tier 3 View now consumes the real property ViewModel. Fake Tier 1 completion, local approval controls and Tier 3 actor promotion are not connected. Landlord selection remains a backend role operation; Tier 2/3 grants no role. Admin review for both tiers uses the existing backend RPC described below.

## Property & Listing Management feature states

The Profile My Properties action and the Listing tab open `PropertyListingFlowView` in the root-owned full-screen workspace only when the backend-loaded roles include Landlord. Tenant-only accounts see the same universal five-item toolbar, but Listing and Post do not open landlord-only screens. The landlord Post action enters the Figma posting-type selection, while Discover remains available. The shared toolbar remains visible throughout authenticated Discovery and Property/Listing workspace states, including nested creation and preview screens; it is not rendered on Authentication/Profile screens.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| My Listings dashboard and empty state | `dashboard`, `empty` | `PropertyDashboardView` | Landlord |
| Property creation and photos | `postingType`, `photoUpload`, `photoManager` | `CreateListingView` | Landlord |
| Property information | `basicInfo`, `specifications`, `amenities`, `address`, `mapConfirm` | `CreateListingView` | Landlord |
| Listing terms and content | `rentTerms`, `description`, `rules`, `availability` | `CreateListingView` | Landlord |
| Preview, requirements and publication | `preview`, `missingRequirements`, `publishConfirmation` | `ListingPreviewView` | Landlord |
| Published listing detail | `published` | `ListingDetailView` | Landlord |
| Listing management | `management`, `editListing` | `ListingManagementView` | Landlord |
| Listing status actions | `pauseConfirmation`, `reactivateConfirmation`, `unavailableConfirmation`, `archiveConfirmation` | `ListingManagementView` | Landlord |

These states are frontend-local. Supabase listing persistence, Storage photo upload, MapTiler/MapLibre map interaction, geocoding and real publishing remain disconnected.

## Search & Discovery feature states

The Profile Discover Properties action opens `SearchDiscoveryFlowView` in a root-owned full-screen modal. Authoritative sign-in/onboarding opens Home / For You. The Profile Matching Preferences action opens the existing presentation-only preference editor; it is not a mandatory registration destination.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Tenant discovery home | `home` | `TenantDiscoveryView` | Tenant / Landlord-as-tenant |
| City and location search | `searchLocation` | `SearchLocationView` | Tenant / Landlord-as-tenant |
| Search results | `resultsList`, `resultsMap` | `TenantDiscoveryView` | Tenant / Landlord-as-tenant |
| Filters and sorting | `filters`, `sort` | `DiscoveryFilterView` | Tenant / Landlord-as-tenant |
| Initial and editable matching preferences | `matchingPreferences` | `DiscoveryFilterView` | Tenant / Landlord-as-tenant; recommended after account setup and editable from Profile |
| Current-location permission presentation | `locationPermission` | `SearchLocationView` | Tenant / Landlord-as-tenant |
| Property detail | `propertyDetails` | `PropertyDiscoveryDetailView` | Tenant / Landlord-as-tenant |
| Gallery, amenities, nearby places and location | `photoGallery`, `propertyAmenities`, `nearbyPlaces`, `propertyLocation` | `PropertySupplementaryView` | Tenant / Landlord-as-tenant |
| Saved listings | `savedListings` | `TenantDiscoveryView` | Tenant / Landlord-as-tenant |
| Search recovery states | `noResults`, `searchError` | `TenantDiscoveryView` | Tenant / Landlord-as-tenant |

These states are frontend-local. Supabase/PostGIS search, MapTiler/MapLibre map rendering, MapTiler geocoding, Android location permission acquisition and OpenStreetMap Overpass queries remain disconnected. Landlord-capable marketplace accounts can browse Discovery; Tenant/Landlord roles are backend-loaded capabilities and the active mode is a UI preference, not a Tier 3 promotion.

## Rental Price Estimation feature states

Tenant entry opens from a Discovery property detail for fair-rent comparison. Landlord entry opens from a listing detail or listing management for asking-rent guidance. `App` swaps the active workspace to `RentalPriceEstimationFlowView` and returns to the corresponding Discovery or Property workspace when the estimator is closed. The universal toolbar remains present throughout this authenticated feature.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Introduction and property selection | `introduction`, `selectProperty` | `RentalPriceEstimationView` | Tenant / Landlord |
| Property information review and estimate request | `propertyReview`, `loading` | `RentalPriceEstimationView` | Tenant / Landlord |
| Landlord estimate result | `landlordResult` | `RentalPriceEstimationView` | Landlord |
| Suggested rental range | `suggestedRange` | `RentalPriceEstimationView` | Landlord |
| Asking-rent comparison | `landlordComparison` | `RentalPriceEstimationView` | Landlord |
| Fair-rent comparison | `tenantComparison` | `RentalPriceEstimationView` | Tenant |
| Methodology, disclaimer and dated estimates | `estimateInformation`, `estimateHistory` | `RentalPriceEstimationView` | Tenant / Landlord |
| Unavailable and retryable error states | `unavailable`, `error` | `RentalPriceEstimationView` | Tenant / Landlord |

The current result data and loading transition are local presentation previews. No request is sent through `priceEstimationClient`, and no estimate or property data is read from or written to Supabase.

## Messaging & Viewing Schedules feature states

The Chat item in the universal toolbar opens `MessagingViewingFlowView` at the inbox for both Tenant and Landlord accounts. The Message Landlord action in a Discovery property detail opens the same flow at a new listing inquiry. `App` owns these workspace transitions, while the feature ViewModel owns conversation and viewing-schedule state. Discover, landlord Listing/Post and Chat navigation remain available from the same universal safe-area toolbar.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Messages and empty inbox | `inbox`, `emptyInbox` | `MessagingInboxView` | Tenant / Landlord |
| Conversation and listing inquiry | `conversation`, `newInquiry` | `MessagingConversationView` | Tenant / Landlord |
| Message attachment presentation | `attachment` | `MessagingConversationView` | Tenant / Landlord |
| Viewing proposal setup | `proposeViewing`, `selectDate`, `selectTime`, `reviewProposal` | `ViewingScheduleView` | Tenant / Landlord |
| Proposal response states | `proposalPending`, `proposalAccepted`, `proposalDeclined`, `counterProposal` | `ViewingScheduleView` | Tenant / Landlord |
| Confirmed viewing and upcoming appointment | `viewingDetails`, `upcomingViewing` | `ViewingScheduleView` | Tenant / Landlord |
| Viewing cancellation and completion | `cancelViewing`, `viewingCancelled`, `viewingCompleted` | `ViewingScheduleView` | Tenant / Landlord |
| Unavailable listing conversation | `listingUnavailable` | `MessagingConversationView` | Tenant / Landlord |

All message sending, attachments, schedule proposals and schedule decisions are local frontend previews. Supabase database persistence, Realtime subscriptions, Storage uploads, push notification delivery and server-authoritative availability checks remain disconnected.

## Maintenance Requests feature states

The Tenancy item in the universal toolbar currently opens `MaintenanceRequestsFlowView` for Tenant and Landlord accounts. `App` owns the workspace transition, while `useMaintenanceRequestsViewModel` owns the request draft, lifecycle status, repair schedule, rejection and dispute presentation state. This provides an authenticated entry for Maintenance without introducing a navigation dependency; the separate Tenancy Management cohort remains scaffolded.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Request list and empty state | `requests`, `empty` | `MaintenanceListView` | Tenant / Landlord |
| Request creation and issue details | `create`, `issueDetails`, `priority`, `photoUpload` | `MaintenanceRequestFormView` | Tenant / Landlord-as-tenant |
| Review and submission | `review`, `submitted` | `MaintenanceRequestFormView` | Tenant / Landlord-as-tenant |
| Tenant request details and submitted tracking | `requestDetails`, `submittedStatus` | `MaintenanceDetailView` | Tenant |
| Landlord review and acknowledgement | `landlordDetails`, `acknowledge` | `MaintenanceDetailView` | Landlord / lifecycle preview |
| Information request and tenant follow-up | `requestMoreInfo`, `tenantAddInfo` | `MaintenanceDetailView` | Landlord / Tenant |
| Inspection and repair scheduling | `scheduleRepair`, `scheduled` | `MaintenanceDetailView` | Landlord / Tenant |
| Repair progress and resolution | `inProgress`, `markResolved`, `resolutionPending`, `confirmResolution`, `reopen` | `MaintenanceDetailView` | Landlord / Tenant |
| Rejection and tenant response | `landlordReject`, `rejectionReason`, `rejectionResponse` | `MaintenanceDetailView` | Landlord / Tenant |

All maintenance requests, photo references, status transitions, schedule details, resolution notes, rejections and disputes are local frontend previews. Supabase persistence, Storage upload, Realtime subscriptions, push notification delivery and server-authoritative tenancy or role checks remain disconnected.

## Ratings & Reports feature states

The Ratings & Reports Profile action opens `RatingsReportsFlowView` in the root-owned authenticated workspace for Tenant and Landlord accounts. `App` owns transitions between this workspace and the universal Discover, landlord Listing/Post, Tenancy and Chat destinations. `useRatingsReportsViewModel` owns all review drafts, report drafts, local status changes and preview outcomes without accessing a backend client.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Ratings and reports hub | `home` | `RatingsReportsHomeView` | Tenant / Landlord |
| Available reciprocal review | `reviewAvailable`, `rateParticipant` | `ReviewFlowView` | Tenant rating Landlord / Landlord rating Tenant |
| Rating and written feedback | `starRating`, `writtenReview`, `reviewConfirmation` | `ReviewFlowView` | Tenant / Landlord |
| Review submission and publication | `reviewSubmitted`, `awaitingPublication` | `ReviewFlowView` | Tenant / Landlord |
| User reviews and rating summary | `reviewsSummary` | `ReviewFlowView` | Tenant / Landlord |
| Report entry and target selection | `reportMenu`, `reportUser`, `reportListing`, `reportMessage` | `ReportFlowView` | Tenant / Landlord |
| Report reason, details and evidence | `reportReason`, `reportDetails`, `evidenceUpload` | `ReportFlowView` | Tenant / Landlord |
| Report review and submission | `reviewReport`, `reportSubmitted` | `ReportFlowView` | Tenant / Landlord |
| Report tracking and moderator follow-up | `reportStatus`, `moreInfoRequested` | `ReportFlowView` | Tenant / Landlord |
| Report outcomes | `outcomeDismissed`, `outcomeActionTaken` | `ReportFlowView` | Tenant / Landlord |

All reviews, rating aggregates, review eligibility, publication waiting, reports, evidence references, report statuses and moderation outcomes are local frontend previews. Supabase persistence, Storage uploads, server-authoritative reciprocal review publication, moderation access, enforcement actions and notifications remain disconnected.

## Admin & Moderation feature states

Only an active account with a backend-loaded Admin role can enter `AdminModerationFlowView`; ordinary Profile navigation does not expose Admin Preview. Admin bypasses ordinary Tenant/Landlord onboarding. The admin workspace retains Dashboard, Queues, Actions and Audit navigation. Outside connected verification reads, private image viewing and Tier 2/3 review, its content/actions remain local previews. This navigation gate does not implement backend review authorization or persistence, which remain server-owned.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Dashboard and review queue overview | `dashboard`, `reviewQueues` | `AdminDashboardView`, `AdminQueueView` | Admin preview |
| Verification queue and submission | `verificationQueue`, `verificationDetails` | `AdminQueueView`, `VerificationModerationView` | Admin; real active queue/metadata |
| Verification document metadata | `verificationDocument`, legacy `approveVerification`, `rejectVerification`, `requestVerificationInfo` | `VerificationModerationView` | Admin; real reads, Tier 2/3 decisions use inline Modals |
| Reports queue and report details | `reportsQueue`, `reportDetails` | `AdminQueueView`, `ReportModerationView` | Admin preview |
| Report evidence and subject context | `evidenceViewer`, `reportedUserDetails`, `reportedListingDetails`, `reportedMessageContext` | `ReportModerationView` | Admin preview |
| Report follow-up and dismissal | `requestReportInfo`, `dismissReport` | `ReportModerationView` | Admin preview |
| Moderation action selection | `moderationAction` | `EnforcementView` | Admin preview |
| User and listing enforcement | `warnUser`, `restrictAccount`, `suspendAccount`, `removeListing`, `permanentRemoval` | `EnforcementView` | Admin preview |
| Confirmation, restrictions and restoration | `moderationConfirmation`, `activeRestrictions`, `restoreAccount` | `EnforcementView` | Admin preview |
| Audit and case history | `auditHistory`, `caseHistory` | `AuditView` | Admin preview |

Admin entry uses the authoritative Auth/profile/role snapshot. Verification queue and submission/document metadata load through the Admin-gated get_admin_verification_queue RPC and document SELECT; no hardcoded verification dataset or local decisions remain. Private JPEG/PNG/WebP image viewing uses an on-demand signed-URL Modal and is user-reported Android PASS. Close, Android Back and navigation clear temporary preview state. Tier 2/3 detail opens confirmation/rejection Modals for Start review (Pending), then Approve/Reject (Under review), using review_verification_submission. Terminal success returns to the refreshed active queue; disappearance is expected. Feature navigation/Modal Back is blocked while saving and refreshing; Cancel clears unsubmitted drafts. No new named route or navigation dependency was added. Tier 2 approval is user-reported development-build PASS; Tier 3 actions remain Android RUNTIME-UNVERIFIED. Non-image viewing, reports/enforcement/restoration/audit persistence and notifications remain deferred or preview. See [Admin Verification](features/ADMIN_VERIFICATION.md).

## Notifications feature states

The Notifications Profile action opens `NotificationsFlowView` in the root-owned authenticated workspace for Tenant and Landlord accounts. `App` owns cross-feature transitions from a notification into the existing Messages, Maintenance, Verification, landlord Listings, Ratings & Reports and Discovery workspaces. `useNotificationsViewModel` owns category selection, read state, empty-state presentation and permission-preview state without accessing the Expo Notifications service or a backend client.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Notification Center, grouped categories and read/unread items | `center` | `NotificationCenterView` | Tenant / Landlord |
| Empty notifications | `empty` | `NotificationCenterView` | Tenant / Landlord |
| Push notification permission introduction | `permissionPrompt` | `NotificationPermissionView` | Tenant / Landlord |
| Permission denied and settings guidance | `permissionDenied` | `NotificationPermissionView` | Tenant / Landlord |
| Android push-notification presentation reference | `androidExample` | `NotificationPermissionView` | Tenant / Landlord |

All notification items, unread counts, category groupings and permission outcomes are local frontend previews. Device permission requests, Expo push-token generation, backend token registration, push delivery through FCM, notification persistence and deep-link payload contracts remain disconnected.
