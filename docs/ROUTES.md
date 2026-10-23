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

After authoritative checks, Tenant-capable accounts (including dual-role accounts) initially open Discovery in Tenant mode; Landlord-only accounts open the existing property dashboard in Landlord mode. An active eligible Admin opens Admin Moderation first, including accounts with other roles. The authenticated Profile state remains underneath the root-owned workspace. A confirmed signup records a device-local, account-scoped pending introduction marker. Optional Matching Preferences is offered only after email confirmation, Tier 1 and backend-loaded role membership, including after restart. Workspace entry waits for the marker read, with contextual Retry on failure. Explicit Save/Skip records done; merely opening or leaving via another tab does not. Returning accounts without a marker are not inferred to be new. Sign-out clears workspace/preference contents but retains this minimal marker. See [Authentication & Profiles](features/AUTHENTICATION_PROFILES.md) for continuity limits.

### Marketplace navigation refinement Phase 2

Status: **IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED** (2026-10-22; baseline `bfe567d` plus uncommitted changes; 202 automated tests and typecheck passed). `App.tsx` retains workspace state and the fullscreen Modal. `shared/models/marketplaceNavigation.ts` contains pure entry/mode mappings, not another router or an authorization layer. `getWorkspaceDestination() === 'discovery'` remains the existing ordinary-marketplace eligibility signal; App chooses its actual workspace from the permitted mode. No Auth routing precedence changed.

The original Listings inconsistency was a source-level mismatch: toolbar consumers received `accountRole === 'landlord'` (selected mode), while Profile My Properties used actual Landlord membership. Thus a dual-role account in default Tenant mode could open My Properties but not Listings. Toolbar fallback text also incorrectly required Tier 3. Feature toolbar consumers receive `auth.hasLandlordRole`. The duplicate My Properties Profile row has since been removed; the Profile toolbar uses the same root `openProperties('dashboard')` as Listings elsewhere. Post uses `postingType` and the existing creation preview. Listings/Post also select Landlord mode. Tenant-only accounts receive an explanation rather than a landlord transition; Tier 3 grants no role.

Profile's prominent mode switcher has been removed. Its root-supplied marketplace toolbar provides Discover, Listings/Post, Tenancy and Chat without duplicating those destinations as account rows. Discovery workspace entry selects Tenant perspective for Tenant-capable accounts; Listings/Post selects Landlord perspective. Chat/Maintenance consume that in-memory perspective. No role RPC is invoked. Landlord-only users retain Discover browsing. There is no persistent mode storage. Backend role loss prevents property entry and returns an already-open property workspace to Discovery. Pending forms are protected through the existing feature ViewModels before workspace exit.

Android Modal Back delegates only to the current account/workspace registered feature action. Verification, Discovery, Listings, Notifications, Messaging, Maintenance, Ratings & Reports, Price Estimation and Admin each register feature-owned Back with cleanup. Nested screens use their existing ViewModel history before parent dismissal. Discovery hardware Back follows nested feature history first; at Home it requests native Android exit confirmation (Cancel stays; Exit invokes BackHandler.exitApp). Its explicit Profile control remains separate. Listings hardware Back follows wizard/detail history, then dashboard, then Discovery. The Post postingType root exits to Discovery through the existing draft guard. My Listings has no redundant Back to Profile strip. Unsaved listing edits or Matching Preferences require Stay/Leave confirmation before guarded exits. Back on that dialog cancels navigation. This is one pending intent, not another navigation history. Notifications Back returns to Discovery, its current entry origin; permission screens return to the notification center first. Price Estimation retains its Discovery/Listing parent. Chat inbox and Tenancy/Maintenance roots use hardware Back to Discovery; their explicit Profile entry callbacks remain separate. Ratings & Reports retains its Profile parent. Profile-entered Matching Preferences Back uses the same guarded parent exit as Close; introduction Save/Skip behavior remains unchanged.

The common toolbar also appears on eligible ordinary Profile, with no selected tab; Admin/onboarding/restricted screens do not expose it. It has 48dp targets, readable labels and existing safe-area handling. Only the actual selected tab is highlighted; Post is not always marked active. Matching Preferences, Notifications, Ratings/Reports and the separate estimator tool have no falsely selected main tab. Existing Tenancy navigation still opens Maintenance preview.

## User Verification feature states

Profile Verification and the Notifications verification action open `UserVerificationFlowView` in the existing root workspace/Modal for permitted ordinary marketplace accounts. It uses the real Tier 2 ViewModel/service and a separate Tier 3 property workflow for Tier 1-verified landlords. Tier 2 is not required for Tier 3. Admin routing, account restrictions, email/Tier 1 onboarding and role-selection precedence are unchanged. See [User Verification](features/USER_VERIFICATION.md).

| Flow | Production feature state | Component | Behavior |
| --- | --- | --- | --- |
| Verification levels | `overview` | `VerificationOverviewView` | Tier 1 read-only; Tier 2 available; Tier 3 owned-property entry for eligible landlords |
| Identity selection/review | `tier2Intro`, `tier2IdType`, `tier2Upload`, `tier2Review` | `TierTwoVerificationView` | Four supported ID types, real file selection and submission |
| Existing/resulting status | `tier2Status` | `VerificationStatusView` | Exact backend statuses; rejected correction or incomplete pending recovery enters existing ID/file/review steps locally; explicit confirmation calls begin/resume RPC; contextual Check Status reconciles uncertainty |
| Property verification | Tier 3 `intro`, `property`, `documentType`, `document`, `review`, `status` | `TierThreeVerificationView` | Own properties -> four document types -> local file -> explicit submission confirmation; existing backend workflow; no resubmission |

Feature Back follows the active tier's sequence. Tier 3 intro Back returns to verification levels; Tier 3 status Back returns to owned-property selection. Overview Back/Close returns to Profile. Android Modal Back delegates to guarded feature navigation; picker/submission actions cannot be dismissed through those controls while active. Returning from Tier 3 to overview clears its local draft and invalidates asynchronous results without removing mounted subscriptions. No second navigation framework was added.

Tier 3's Submit for review action opens `review` as confirmation without writes. Confirm and submit invokes the existing workflow; Cancel/Back returns to local file selection with property/type/file retained. Document Back returns to `documentType`. The root `App.tsx` workspace composition and Auth routing are unchanged.

Legacy Tier 1/3 prototype route names remain disconnected; the production Tier 3 View now consumes the real property ViewModel. Fake Tier 1 completion, local approval controls and Tier 3 actor promotion are not connected. Landlord selection remains a backend role operation; Tier 2/3 grants no role. Admin review for both tiers uses the existing backend RPC described below.

## Property & Listing Management feature states

The Profile My Properties action and Listings tab open the same `PropertyListingFlowView` dashboard only for marketplace-eligible Landlord members, independent of selected mode. Post opens posting-type selection with an empty local draft. Its physical-property action now enters propertySetup; listing-only steps remain previews. The redundant dashboard Back to Profile action is removed. Hardware Back at dashboard/empty returns to Discovery; explicit nested Close retains its existing Profile destination. Creation/review selects Post; dashboard/detail/management selects Listings. Leaving an edited draft, including editListing Back to Management, requires explicit discard confirmation; ordinary wizard Back preserves the draft. Local Save/Publish remains preview-only. The shared toolbar remains visible throughout supported marketplace workspaces and is not rendered on Authentication/Profile screens.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| My Listings dashboard and empty state | `dashboard`, `empty` | `PropertyDashboardView` | Landlord |
| Physical property setup | `postingType`, `propertySetup` with details/address/review/created steps | `CreateListingView` / `PropertySetupView` | Active Tier 1 Landlord; Tier 3 not required |
| Legacy preview photos | `photoUpload`, `photoManager` | `CreateListingView` | Landlord; not persisted |
| Property information | `basicInfo`, `specifications`, `amenities`, `address`, `mapConfirm` | `CreateListingView` | Landlord |
| Listing terms and content | `rentTerms`, `description`, `rules`, `availability` | `CreateListingView` | Landlord |
| Preview, requirements and publication | `preview`, `missingRequirements`, `publishConfirmation` | `ListingPreviewView` | Landlord |
| Published listing detail | `published` | `ListingDetailView` | Landlord |
| Listing management | `management`, `editListing` | `ListingManagementView` | Landlord |
| Listing status actions | `pauseConfirmation`, `reactivateConfirmation`, `unavailableConfirmation`, `archiveConfirmation` | `ListingManagementView` | Landlord |

Listing states remain frontend-local. Physical property setup now has a typed creation RPC, but UI saving is blocked pending the separately developed location workflow. Listing persistence/publication, photos and MapLibre remain disconnected.

## Search & Discovery feature states

Discover on the Profile toolbar opens `SearchDiscoveryFlowView` at Home. The Profile Matching Preferences account row opens the existing local preference editor. An eligible account with a pending device-local signup marker can open this editor with an optional introduction and Skip for now; it does not interrupt email/phone/role onboarding. Save or Skip continues to Discovery for Tenant mode or the property dashboard for Landlord mode. Saved choices remain editable through Profile and are scoped to the account in App memory until sign-out/restart; no preference persistence or recommendation service is connected. Skip/discard does not save edited values. The introduction marker survives restart; preference contents do not. Older accounts without a marker are not guessed new; Profile editing remains available.

| Flow | Feature states | Component | Actor |
|---|---|---|---|
| Tenant discovery home | `home` | `TenantDiscoveryView` | Tenant / Landlord-as-tenant |
| City and location search | `searchLocation` | `SearchLocationView` | Tenant / Landlord-as-tenant |
| Search results | `resultsList`, `resultsMap` | `TenantDiscoveryView` | Tenant / Landlord-as-tenant |
| Filters and sorting | `filters`, `sort` | `DiscoveryFilterView` | Tenant / Landlord-as-tenant |
| Optional introduction and editable matching preferences | `matchingPreferences` | `DiscoveryFilterView` | Eligible accounts with a device-local pending marker get an optional introduction; all permitted ordinary accounts can edit from Profile; local preview only |
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

## Phase 2 corrections: draft and publication boundary

A Tier 1 Landlord may enter the existing local listing draft preview without Tier 3. This preview creates no persisted property ID; Tier 3 requires an existing owned backend property. Future real publication must require qualifying approved Tier 3 for that specific property, in addition to other requirements. An account tier3_verified_at/trust indication is insufficient. Local preview `published` is not backend listing `active`. Publication remains disconnected. Read-only inspection on 2026-10-22 found that current listing policies/triggers enforce ownership, draft-first activation and completeness, but not this property-specific Tier 3 rule. That backend enforcement gap must be resolved before real publication integration; no backend changes were made.

### UX refinement navigation evidence (2026-10-22)

Baseline `976d13d` plus uncommitted UX changes. Typecheck and 223/223 automated tests passed; Android RUNTIME-UNVERIFIED. Shared compact Back/Close presentation changes no feature Back callback or fullscreen viewer lifecycle. Account options reveals the existing onboarding switch-account action. Bounded Tier 1 lifecycle checks may advance only through authoritative account routing. Matching Preferences Save/Skip remains guarded and uses the same destination rules. Admin verification queue uses pull-to-refresh through its ViewModel, with contextual retry rather than a normal refresh button. No router or backend workflow was added.

### Targeted Profile return and Discovery header (2026-10-22)

Profile keeps one account-scoped top-level predecessor/actor mode: Discovery home, Listings dashboard, Chat inbox, Maintenance or Admin dashboard. Dismissed Verification, Ratings & Reports, Notifications, Matching Preferences and Price Estimation are not Profile history. Returning from a child preserves a valid earlier predecessor; absent one, Profile Back uses the current authorized landing (Discovery, landlord Listings or Admin). Visible and hardware Profile Back share this action, consume the predecessor and revalidate identity, roles, restrictions and Admin precedence. Tab selection replaces workspaces without a stack. Nested screens/drafts are not restored after dismissal. Hardware Back in Edit Profile/Settings uses the existing Auth goBack action and is consumed while loading; sign-out and feature confirmation/preview Modals retain priority. Account/ineligibility changes clear stale workspace state. Role loss also removes inaccessible landlord/Admin workspaces.

Discovery home has a larger padded brand header with Notifications and Profile targets. Notifications uses the existing ViewModel navigation guard and root notifications preview; no push/persistence integration. The redundant Notifications Profile menu row is removed. Discover/For You remain their existing search/home actions. Typecheck/231 tests pass; ordinary-user Android acceptance remains required. Agent observed Admin Exit -> Profile -> hardware Back -> Admin Dashboard only.

## Navigation Back audit correction (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. Baseline `9d9e9c9` plus uncommitted navigation corrections. Typecheck PASS; 267/267 tests PASS, zero failures/skips/cancellations. Model tests exercise predecessor filtering/normalization, dismissed-child sequences and authorization fallbacks; source-wiring checks cover Modal delegation/cleanup, feature ViewModel adapters, settings and Matching Preferences. Stay/Leave intent tests and existing verification/preview/Admin regressions remain. These checks do not execute native Android navigation.

Back follows active feature history, then its designated root Back policy. Bottom-tab roots return to Discovery; Discovery Home requests Android exit confirmation. Profile-origin tools retain their parent. Close uses its explicit destination (and respects existing draft guards), independent of hardware root Back. Tabs replace top-level workspaces. Cancel remains owned by the operation/confirmation. Root Modal ignores an absent/stale callback rather than bypassing feature guards. No new router, unlimited root stack, dependency, Auth workflow or backend change was introduced. Existing feature-local preview histories remain; dismissed workspace remounting starts its supported entry screen, not a draft snapshot.

Android checklist: Profile ? Verification ? nested Tier 2/Tier 3 Back ? overview ? Profile ? Back; repeat Ratings & Reports and Matching Preferences, expecting no dismissed tool reopening. Check Discovery/Profile and Listings/Profile returns, Notifications/permission Back to Discovery, nested Chat/Maintenance/report/estimator/Admin Back against visible controls, repeated tab switches, Edit Profile/Settings and sign-out Cancel. Exercise dirty preferences/listing Stay/Leave with hardware Back, fullscreen document Back, active submission/review guards, logout/account switch/restriction/role loss and Admin precedence. Confirm none of these root Profile paths exits to Expo unexpectedly. No Android acceptance is claimed in this pass.

### Bottom-navigation Back correction (2026-10-22)

IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED, baseline `9d9e9c9` plus the preserved uncommitted navigation audit and this correction. Root cause: feature Back actions still received openProfile as their root exit callback. Root composition now supplies separate onRootBack and onClose callbacks for Discovery, Listings, Messaging and Maintenance. Discovery's ViewModel selects root exit only at Home, after introduction/nested navigation handling. Other bottom roots return to Discovery; Post first-step Back always uses its guarded root exit rather than stale tab history. Deeper Post wizard Back remains internal. Existing Profile predecessor validation/normalization is preserved, including Listings ? explicit Profile entry ? Back ? dashboard.

The shared marketplaceExitConfirmation coordinator prevents duplicate prompts and validates current workspace/account/marketplace eligibility before exiting. useMarketplaceExitConfirmation invalidates pending responses on context change/unmount. androidAppExitService uses a native cancelable Alert with Cancel/Exit and BackHandler.exitApp only after confirmation, on Android. No session is signed out or database modified. Other platforms do not exit through this Android service. Native dialog dismissal and Cancel leave navigation untouched. A stale dialog may remain visible after background eligibility changes, but its response cannot exit the new context. Existing native preview/confirmation Modals take Back first.

Typecheck and full suite: 274/274 PASS, zero failures/skips/cancellations; whitespace check PASS. New tests cover native-dialog wiring, cancel/confirm/duplicate/stale response orchestration, separate root/Profile callbacks, dashboard action removal, nested Back and Post Stay/Leave. Earlier audit tests retain account/role/Admin and Profile-origin coverage. Node tests do not execute native Alert or BackHandler.exitApp.

Android acceptance: on Discovery Home press Back, Cancel, then Back/Exit (expect app exit, not sign-out); reopen and inspect normal session restoration. Repeat from nested Discovery and dirty preferences to ensure those handle Back before exit. At Listings, Chat and Tenancy roots expect Discovery without Profile; at Post root test clean and edited drafts, Stay versus Leave, plus deeper wizard Back retaining draft. Test explicit Listings ? Profile ? Back, Verification/preferences/reports parent exits, zoom/confirmation Back, rapid Back, account switch/restriction/role loss with an outstanding exit dialog, and Admin isolation. All new native behavior remains RUNTIME-UNVERIFIED.

## Phase 1 physical property creation (2026-10-23)

Status: RPC/service/workflow/form foundation IMPLEMENTED / AUTOMATED-TESTED / Android RUNTIME-UNVERIFIED. **The user chose blocked save pending integration with the separately developed MapTiler/location workflow.** This branch does not implement Maps, GPS, address search, public-coordinate derivation or manual coordinate entry. Full runtime property persistence is pending that integration.

Post ? A physical property ? propertySetup retains the existing workspace, toolbar and wizard scaffold. The ViewModel composes a testable propertyCreationWorkflow with the feature service. Details collect nine generated property-type values, three Cavite cities, structured barangay/address/private access text, separate exact/public point concepts, bedrooms/bathrooms, optional floor area/floor number/total floors/max occupants and three furnishing values. Floor area is not land area. Labels are separate from domain identifiers. Legacy ListingDraft/PropertyType remain explicitly preview-only and are never sent as the property contract.

The service contract requires four explicit finite, range-validated numbers: exactLatitude, exactLongitude, publicLatitude and publicLongitude. Incomplete draft state uses null. The future location workflow can call provideConfirmedLocation(location, expectedAddressRevision); address edits clear all four values and increment locationRevision so stale address confirmations are ignored. This seam accepts supplied values without deriving, fabricating or copying coordinates. No production caller supplies them yet. The review step remains available, but Confirm and save is disabled with the non-error notice "Confirm the property location before saving." Opening/reviewing the form cannot create a property. The shared geocoding service and MapTiler configuration are unchanged.

Creation calls only create_property_setup. Generated required arguments: p_property_type, p_city, p_barangay, p_address_line_1, p_public_lat/lng and p_exact_lat/lng. Optional text/numbers are mapped explicitly, blanks omitted to use RPC defaults; p_amenity_ids is [] and furnishing uses backend values. Amenities/photos are not persisted. The backend derives ownership and creates property/private location/amenity associations transactionally. No listings row, media, Tier 3 submission or publication is created. No frontend table INSERT, schema, policy or function change.

The service validates {status:'created', property_id:<UUID>}. The workflow retains the returned propertyId; successful states and continuation into local listing terms are implemented for an approved valid location input. Tier 3's unchanged owner-filtered property query can find that record later, without cross-feature ViewModel coupling. The My Listings dashboard still shows listing previews, not a newly invented real listing/property feed. To inspect a real physical property after creation, use its receipt and the existing Tier 3 property selector.

Synchronous operation guards and account/epoch checks protect writes and stale results. An account-scoped AsyncStorage journal records pending before sending the RPC, then only a confirmed UUID receipt, never address/coordinates/tokens. Remount restores a confirmed own property through an owner-filtered read. Unknown network/invalid-result outcomes retain the pending marker and prohibit blind retries, including after restart; checking at most ten recent own properties and explicitly recognizing one reconciles it through an ownership recheck. No record matching is automatic and this is not complete history. If no record can be identified, backend/manual outcome confirmation is still needed before another create. A known PostgreSQL validation/authorization/constraint error is a rejected/rolled-back operation and allows explicit correction. No idempotency key or cross-device property deduplication contract exists; frontend guards cannot provide those guarantees. Explicit Set up another property clears only a confirmed receipt, not an uncertain attempt.

Navigation continues through feature-owned Back and Stay/Leave. Busy operations block workspace/draft exits; ordinary internal Back preserves the draft. Local-progress actions now say Keep local progress and explicitly do not claim a backend save. New properties cannot be recreated by moving backward/forward because propertyId and confirmed receipt remain. Leaving before creation discards local form data after confirmation; the journal is not a full saved wizard draft.

Android/live tests still required: eligible Tier 1 landlord without Tier 3 -> details/address -> review; expect saving blocked with zero create RPCs and the location notice. Test narrow screens/font scaling, numeric errors, Back and Stay/Leave. After the separate location workflow supplies confirmed exact and approved generalized public points, test address-change invalidation, explicit creation, one real owned UUID/private-location row, no listing, unchanged Tier 3 selector visibility, double taps, network failures, account switching and durable uncertain-outcome recovery. Use new test records and preserve existing verification fixtures. No live write tests were performed by the agent.

Phase 1 validation evidence (2026-10-23): npm run typecheck PASS; npm test 310/310 PASS, 0 failed/skipped/cancelled; git diff --check PASS. The previous navigation test's blanket service-import prohibition was narrowed to permit the Property ViewModel's own service composition; Views still cannot import data-access/services and no ViewModel imports the raw Supabase client. Existing verification/navigation/preview regressions remain. Expo install --check FAIL reports pre-existing patch drift: expo 57.0.30 (expected ~57.0.31), expo-location 57.0.21 (expected ~57.0.22), expo-notifications 57.0.23 (expected ~57.0.24). The final online recheck was blocked by network EACCES; offline checking reports up to date but explicitly warns it is unreliable. No dependency versions changed. Android runtime and live create from the app remain unverified; separate location integration remains pending. The working tree was clean on feature/property-listing-management at the start, so there were no pre-existing uncommitted edits to overwrite.

Before the final removal of address-search integration, Android JavaScript/Hermes export also passed (940 modules) to a temporary directory outside the repository. This is bundle validation, not an APK/device/live Supabase test. The blocked-save decision is confirmed; the app cannot complete a new property save until the separate location feature is integrated.
