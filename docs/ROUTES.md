# Routes

No navigation dependency is installed, so `App` is the Expo application root rather than a named navigation route. The Authentication & Profiles feature currently uses a feature-local, ViewModel-owned screen state so the complete frontend flow remains testable without introducing an unapproved navigation framework.

| Page | Path / Route | Component | Feature Folder | Auth Required |
|---|---|---|---|---|
| Application root | Expo root | `App` | N/A | No |
| Welcome / App Entry | Feature state: `welcome` | `WelcomeView` | Authentication & Profiles | No |
| Sign In | Feature state: `signIn` | `SignInView` | Authentication & Profiles | No |
| Create Account / Registration | Feature states: `registrationName` through `registrationComplete` | `RegistrationView` | Authentication & Profiles | No |
| Email Confirmation | Feature state: `emailConfirmation` | `RegistrationView` | Authentication & Profiles | No |
| Mobile Number Confirmation | Feature state: `mobileConfirmation` | `RegistrationView` | Authentication & Profiles | No |
| User Profile | Feature state: `profile` | `ProfileView` | Authentication & Profiles | Preview only |
| Edit Profile | Feature state: `editProfile` | `EditProfileView` | Authentication & Profiles | Preview only |
| Account / Profile Settings | Feature state: `settings` | `SettingsView` | Authentication & Profiles | Preview only |
| Account Restricted / Suspended | Feature state: `restricted` | `RestrictedAccountView` | Authentication & Profiles | Preview only |

Successful frontend sign-in opens `SearchDiscoveryFlowView` at the Home / For You feed. The authenticated Profile state remains underneath the root-owned workspace so closing Home returns to Profile. New account completion still opens Matching Preferences first and proceeds to Home after those preferences are saved. Sign-out confirmation is rendered as a modal owned by `AuthProfilesFlowView`. Replace the feature-local screen state with the approved application navigator when one is selected; preserve the ViewModel action boundaries and role separation.

## User Verification feature states

The Profile Verification action opens `UserVerificationFlowView` in a root-owned full-screen modal. This preserves Authentication/Profile state while keeping feature Views and ViewModels isolated.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Verification overview and level selection | `overview` | `VerificationOverviewView` | Tenant / Landlord |
| Tier 1 introduction and contact confirmation | `tier1Intro`, `tier1Email`, `tier1Mobile`, `tier1Complete` | `TierOneVerificationView`, `VerificationStatusView` | Tenant / Landlord |
| Tier 2 ID verification | `tier2Intro`, `tier2IdType`, `tier2Upload`, `tier2Review` | `TierTwoVerificationView` | Tenant / Landlord |
| Tier 2 review states | `tier2Pending`, `tier2Approved`, `tier2Rejected`, `tier2Resubmission` | `VerificationStatusView`, `TierTwoVerificationView` | Tenant / Landlord |
| Tier 3 property and document verification | `tier3Intro`, `tier3Property`, `tier3Document`, `tier3Review` | `TierThreeVerificationView` | Verified Tier 2 user seeking Landlord status |
| Tier 3 review states | `tier3Pending`, `tier3Approved`, `tier3Rejected` | `VerificationStatusView` | Landlord applicant |

These are frontend-local route states. New accounts default to Tenant, and the local profile changes to Landlord only after Tier 3 approval. Supabase submission, Storage upload, and admin review remain disconnected.

## Property & Listing Management feature states

The Profile My Properties action and the Listing tab open `PropertyListingFlowView` in the root-owned full-screen workspace only when the current local profile role is Landlord. Tenant profiles see the same universal five-item toolbar, but Listing and Post explain the Tier 3 requirement instead of opening landlord-only screens. The landlord Post action enters the Figma posting-type selection, while Discover returns to tenant discovery without changing the earned Landlord capability. The shared toolbar remains visible throughout authenticated Discovery and Property/Listing workspace states, including nested creation and preview screens; it is not rendered on Authentication/Profile screens.

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

The Profile Discover Properties action opens `SearchDiscoveryFlowView` in a root-owned full-screen modal. Completing the local registration preview opens the same flow at Matching Preferences, and the Profile Matching Preferences action can edit those presentation-only choices later.

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

These states are frontend-local. Supabase/PostGIS search, MapTiler/MapLibre map rendering, MapTiler geocoding, Android location permission acquisition and OpenStreetMap Overpass queries remain disconnected. Landlord accounts retain Tenant discovery access because Landlord is an earned capability rather than a mutually exclusive account type.

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

The Profile screen exposes an explicitly labeled `Admin Moderation Preview` entry so this frontend-only repository can evaluate the admin interface before an authoritative admin session exists. `App` opens `AdminModerationFlowView` in the root-owned full-screen workspace. This entry is not an authorization check and must be replaced or guarded by backend-derived admin claims and RLS before production use. The admin workspace has its own Dashboard, Queues, Actions and Audit navigation because it is separate from Tenant/Landlord application navigation.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Dashboard and review queue overview | `dashboard`, `reviewQueues` | `AdminDashboardView`, `AdminQueueView` | Admin preview |
| Verification queue and submission | `verificationQueue`, `verificationDetails` | `AdminQueueView`, `VerificationModerationView` | Admin preview |
| Verification documents and decisions | `verificationDocument`, `approveVerification`, `rejectVerification`, `requestVerificationInfo` | `VerificationModerationView` | Admin preview |
| Reports queue and report details | `reportsQueue`, `reportDetails` | `AdminQueueView`, `ReportModerationView` | Admin preview |
| Report evidence and subject context | `evidenceViewer`, `reportedUserDetails`, `reportedListingDetails`, `reportedMessageContext` | `ReportModerationView` | Admin preview |
| Report follow-up and dismissal | `requestReportInfo`, `dismissReport` | `ReportModerationView` | Admin preview |
| Moderation action selection | `moderationAction` | `EnforcementView` | Admin preview |
| User and listing enforcement | `warnUser`, `restrictAccount`, `suspendAccount`, `removeListing`, `permanentRemoval` | `EnforcementView` | Admin preview |
| Confirmation, restrictions and restoration | `moderationConfirmation`, `activeRestrictions`, `restoreAccount` | `EnforcementView` | Admin preview |
| Audit and case history | `auditHistory`, `caseHistory` | `AuditView` | Admin preview |

All admin session details, verification/report queues, secure files, evidence, decisions, enforcement, restoration and audit entries are local frontend previews. Supabase Auth/JWT admin claims, RLS authorization, database persistence, secure Storage retrieval, Edge Functions, immutable audit logging, notifications and production moderation policy enforcement remain disconnected.

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
