# RENTLEASE Frontend — UI Coverage Audit for Supabase Integration

Inspection date: 2026-10-18.

Scope: Authentication, Profiles, Tier 1, Tier 2, Tier 3, Admin verification review, and the minimal property selector needed by Tier 3.

## Main finding

**The existing UI can support the baseline integration without new screens.** Most work is rewiring existing controls, correcting prototype behavior, and adding small loading/error/status elements.

This was source inspection only. No source files, dependencies, routes, or backend settings changed. No device or live Supabase flows were tested. This Markdown report was subsequently saved at the user's request.

## UI coverage matrix

Paths below are relative to `src/features/`. ViewModel abbreviations:

- Auth VM: `authentication/viewModels/useAuthProfilesViewModel.ts`.
- Verification VM: `user-verification/viewModels/useUserVerificationViewModel.ts`.
- Admin VM: `admin-moderation/viewModels/useAdminModerationViewModel.ts`.

### Authentication and Profile

| BACKEND / WORKFLOW ITEM | EXISTING UI | SOURCE FILE(S) | CURRENT BEHAVIOR | CLASSIFICATION | IMPLEMENTATION ACTION |
| --- | --- | --- | --- | --- | --- |
| Sign-in | Email/password form | authentication/views/SignInView.tsx; Auth VM | Real Supabase sign-in; busy/error feedback | KEEP | Runtime-test; preserve layout |
| Signup | Name, display name, email, password steps | authentication/views/RegistrationView.tsx; Auth VM | Real signup; names become display-name metadata, not invented columns | KEEP | Validate real signup/profile creation |
| Email confirmation | Waiting screen and I confirmed my email | RegistrationView.tsx | Supabase confirmation link; manual return/sign-in | KEEP | Validate confirmation and return behavior |
| Resend confirmation | Cooldown/button | RegistrationView.tsx | Real Auth resend operation | KEEP | Runtime-test cooldown/error recovery |
| Session bootstrap | Connecting state and Retry | authentication/views/AuthProfilesFlowView.tsx | Restores session and loads account | KEEP | Stabilize account synchronization in VM/services |
| Phone entry | Philippine number field, send/change controls | RegistrationView.tsx | Real phone_change request | KEEP | Runtime-test |
| Phone OTP | Six-digit field, verify/resend/refresh | RegistrationView.tsx | Real OTP verification and account refresh | KEEP | Existing UI sufficient |
| Tier 1 pending synchronization | Checking account verification | RegistrationView.tsx | Refresh and account-switch controls | KEEP | Preserve backend-derived status |
| Tier 1 completion | Profile/Settings verified label; onward routing | ProfileView.tsx, SettingsView.tsx; Auth VM | Uses tier1_verified_at | KEEP | No standalone completion screen required |
| Role selection | Tenant/Landlord checkboxes; both allowed | RegistrationView.tsx | Calls set_user_roles | KEEP | Preserve roles collection |
| Profile editing | Display name/bio form | authentication/views/EditProfileView.tsx | Updates own profile; email/phone read-only | KEEP | Validate persistence and reapply routing after refresh |
| Tenant/Landlord mode | Two Profile mode buttons | ProfileView.tsx; root App.tsx | Local presentation preference | KEEP | Keep separate from authorization |
| Sign-out | Settings action and confirmation modal | SettingsView.tsx, AuthProfilesFlowView.tsx | Real device-local sign-out and cleanup | KEEP | Runtime-test |
| Restricted/suspended/deleted | Generic access-limited screen | authentication/views/RestrictedAccountView.tsx | Displays actual status; offers sign-out | KEEP | Adjust copy: promises profile access but provides no profile action |
| Admin routing | Role-gated Admin destination | authentication/models/accountRouting.ts; root App.tsx | Active Admin bypasses ordinary onboarding | KEEP | No new routing screen required |
| Avatar editing | Initials avatar; no upload control | ProfileView.tsx, EditProfileView.tsx | avatar_path is not rendered/edited | NOT REQUIRED | Defer unless explicitly in baseline scope |

Auth UI already has its principal loading/error controls. Known synchronization concerns are implementation issues, not missing screens.

### User Verification and Admin review

| BACKEND / WORKFLOW ITEM | EXISTING UI | SOURCE FILE(S) | CURRENT BEHAVIOR | CLASSIFICATION | IMPLEMENTATION ACTION |
| --- | --- | --- | --- | --- | --- |
| Verification entry | Profile row; tier overview exists | authentication/views/ProfileView.tsx; user-verification/views/VerificationOverviewView.tsx | Profile shows limitation notice; flow unmounted | REWIRE | Reconnect existing entry after preview logic is replaced |
| Tier 2 document selection | ID options list | user-verification/views/TierTwoVerificationView.tsx; models/Verification.ts | Display labels only | REWIRE | Explicit enum mapping |
| Tier 2 upload | Selection button, preview, filename | TierTwoVerificationView.tsx; components/DocumentPreviewPicker.tsx | Bundled sample selection | REWIRE | Retain shell; connect real device selection and private upload |
| Tier 2 submit | Review and submit button | TierTwoVerificationView.tsx; Verification VM | Sets local pending state | REWIRE | Create submission/upload/metadata; show success only after completion |
| Tier 2 status | Pending/approved/rejected presentation | user-verification/views/VerificationStatusView.tsx | Local state and fixed messages | REWIRE | Load backend status/rejection reason |
| Tier 3 property selection | Selectable property rows | user-verification/views/TierThreeVerificationView.tsx | Three static properties using title/address | REWIRE | Load caller-owned properties and derive labels |
| Tier 3 property loading/empty/error | No such states | TierThreeVerificationView.tsx | Always renders static rows | NEEDS SMALL ADDITION | Inline loading, no-properties, error/retry states |
| Tier 3 document selection | Ownership-document rows | TierThreeVerificationView.tsx; models/Verification.ts | Three display-label choices | REWIRE | Map supported choices; add approved options only as needed |
| Tier 3 upload | Existing preview/selection component | TierThreeVerificationView.tsx; DocumentPreviewPicker.tsx | Bundled ownership image | REWIRE | Reuse with real file selection |
| Tier 3 submit/status | Review, submit, status screens | TierThreeVerificationView.tsx, VerificationStatusView.tsx | Local pending/decision mutations | REWIRE | Backend submission and status retrieval |
| Submission loading/failure | Notice area exists, no submission busy state | Tier 2/3 Views; Verification VM | Synchronous preview actions | NEEDS SMALL ADDITION | Disable duplicate submit; progress/error/retry |
| Admin queue | Queue cards and tier labels | admin-moderation/views/AdminQueueView.tsx; components/AdminCards.tsx | Static submissions; filter buttons have no handlers | REWIRE | Query real queue; derive counts; wire or disable optional filters |
| Admin detail/applicant/tier | Detail rows and status pill | admin-moderation/views/VerificationModerationView.tsx | Preview applicant/document/property data | REWIRE | Adapt actual submission, applicant and document rows |
| Admin document view | Existing document-view state | VerificationModerationView.tsx | Bundled images | REWIRE | Authenticated private retrieval; actual document list |
| Admin under_review | No action exists | VerificationModerationView.tsx; Admin VM | Approve/reject available directly | NEEDS SMALL ADDITION | Start review button for pending submissions |
| Admin approval | Confirmation screen/button | VerificationModerationView.tsx | Local status mutation | REWIRE | Review RPC; gate by actual lifecycle/document availability |
| Admin rejection | Confirmation screen/button | VerificationModerationView.tsx | Local status mutation | REWIRE | Review RPC with rejection reason |
| Admin rejection reason | Presets and multiline input | VerificationModerationView.tsx:110 | REJECTION NOTE; minimum ten characters in UI | REWIRE | Existing input sufficient; map to requested_rejection_reason |
| Admin review note | No separate general review-note field | VerificationModerationView.tsx | verificationNote currently serves rejection/correction flows | NOT REQUIRED | Optional RPC argument does not require a new input |
| Refresh/back | Back navigation exists; header supports action slot | components/AdminScaffold.tsx; Admin queue/detail Views | No server refresh action | NEEDS SMALL ADDITION | Existing header action for Refresh and inline failures |
| cancelled | No current branch | VerificationStatusView.tsx | Would fall through incorrect existing logic if added naively | NEEDS SMALL ADDITION | Generic label/message; no cancellation control required |
| revoked | No current branch | VerificationStatusView.tsx | No representation | NEEDS SMALL ADDITION | Generic label/message; no revoke control required |
| Additional information requested | Admin correction action/form/status | VerificationModerationView.tsx; Admin VM | Invented verification transition | REMOVE/ISOLATE | Do not connect to Supabase |
| Tier 1 submission | Legacy preview only | TierOneVerificationView.tsx | Fake contact verification | NOT REQUIRED | Keep active Auth onboarding; no submission row/UI |

## Tier 1 findings

Active `RegistrationView` covers:

- Unconfirmed email: confirmation-link waiting/resend.
- Unconfirmed phone: phone entry and SMS request.
- OTP: six-digit entry, resend, change number, refresh.
- Auth-confirmed phone awaiting Tier 1: dedicated pending-sync presentation.
- Completion: backend timestamp drives onward routing and verified labels.

**The six-digit UI is sufficient.**

Four-digit fake email/mobile verification remains in `TierOneVerificationView.tsx`, using `src/shared/components/OtpCodeInput.tsx`. Its parent `UserVerificationFlowView` is not mounted by the current application. It is not reachable through active onboarding.

Do not reconnect that legacy Tier 1 path. Tier 1 has no verification_submissions enum value or submission workflow.

## Verification status mapping

| Backend/presentation state | Minimum presentation | Existing coverage/action |
| --- | --- | --- |
| pending | Submitted; waiting for review | Reuse pending layout; remove fake decision controls |
| under_review | Being reviewed | Same layout with distinct label/message |
| approved | Verified | Reuse approved layout with backend-derived copy |
| rejected | Rejected plus rejection_reason | Reuse message area; replace Correction required assumption |
| cancelled | Submission cancelled | Generic status presentation; Back/Refresh only |
| revoked | Verification revoked | Generic status presentation; no invented reapplication action |
| notStarted | Eligible, no submission started | Valid derived UI state |
| inProgress | Local draft being completed | Valid draft state; do not confuse with under_review |
| locked | Prerequisite not met | Valid derived state using correct eligibility |

No backend status needs a dedicated new screen. User-facing controls genuinely missing are refresh/retry; Admin additionally needs Start review.

Correct and resubmit must remain disabled/isolated until the rejected-resubmission contract is confirmed.

## Exact document-label mapping

| Current visible label | Backend value | Assessment |
| --- | --- | --- |
| Driver’s License | drivers_license | Supported |
| UMID | umid | Supported |
| Passport | passport | Supported |
| National ID | philsys_id | Supported |
| SSS ID | No dedicated value | Block from production selection pending product decision; mapping to other requires explicit acceptance |
| Student’s ID | No dedicated value | Same; do not silently treat as accepted identity document |
| Land Title | land_title | Supported |
| Home-Owners Association Document | hoa_document | Supported |
| Notarized Authorization to Lease | authorization_to_lease | Supported |
| Tax Declaration — currently absent | tax_declaration | Can be added as another existing selector row |
| Other — currently absent | other | Can be added if acceptance rules are confirmed |

Missing enum options do not automatically block a baseline supporting an approved subset. Do not invent enums or automatically remove unsupported labels during inspection.

## Minimum UI changes required for baseline

| Addition/change | Why needed and location | Form | New dependency? |
| --- | --- | --- | --- |
| Real file selection | DocumentPreviewPicker selects bundled assets only | Retain button; invoke native picker and show actual filename/preview | SMALL UI/DEPENDENCY ADDITION REQUIRED |
| Upload/submission feedback | Tier 2/3 review cannot represent asynchronous failures or partial completion | Busy label, disabled submit, inline error/retry | No additional UI dependency |
| Property loading/empty/error | Tier 3 assumes properties always exist | Inline states in TierThreeVerificationView | No |
| Backend status refresh | Existing status controls simulate decisions | Replace with Refresh; display backend reason/status | No |
| Admin Start review | No pending → under_review control | Button in existing submission detail | No |
| Admin query/action feedback | Static Admin UI lacks fetch/action loading/recovery | Loading/error/empty states and header Refresh | No |
| Actual document presentation | Admin hard-codes sample images and counts | Actual metadata/documents in existing viewer | Depends on accepted formats |
| Status labels | Existing component lacks under_review/cancelled/revoked branches | Labels/messages in existing status component | No |

No new rejection-reason input is needed. No separate Tier 1 completion screen, role screen, property creation screen, or optional review-note field is required.

For non-image files, the existing Image viewer is insufficient. Whether baseline needs an authenticated PDF-opening action or additional viewer capability depends on confirmed accepted MIME types.

## Minimum Tier 3 property model

The selector needs only:

```ts
type VerificationPropertyOption = Pick<
  Database["public"]["Tables"]["properties"]["Row"],
  "id" | "property_type" | "city" | "barangay"
>;
```

The existing SelectionRow can display:

- Label: formatted property type.
- Detail: barangay and formatted city.
- Selection identity: id.

A small ViewModel display adapter can produce existing label/detail strings. It must not query nonexistent properties.title or properties.address.

Bedrooms, bathrooms, and floor area are optional refinements, not baseline requirements.

**No public_location, private address, property_private_locations, or exact_location is needed.** No full Property & Listing integration is required. Ownership lookup uses properties.landlord_id.

## Storage / picker coverage

- No direct picker dependency is declared in package.json.
- No real device-picker usage was found in application source.
- DocumentPreviewPicker receives a bundled image and locally manufactured filename.
- The button, filename area, and preview container are reusable.
- Bundled instructional illustrations may remain as guidance; they must not represent the user's uploaded document.

Private upload, metadata insertion, and authorized retrieval belong behind services/ViewModels.

## Backend values / operations that should remain internal

| Value/operation | Appropriate use |
| --- | --- |
| Submission user_id | Ownership/query association; display applicant name instead |
| reviewed_by | Reviewer association; no raw identifier control |
| reviewed_at, submitted_at, updated_at | Optional formatted dates/freshness information |
| Submission/document/property IDs | Selection, query, navigation, relationships; existing case reference can remain if useful |
| storage_path | Private object lookup; never expose as a document link |
| Document submission_id | Metadata relationship |
| mime_type | Validation and viewer selection |
| file_name | Existing filename label appropriate; no dedicated screen |
| properties.landlord_id | Caller-owned filtering; no editable ownership field |
| RPC names/argument names | Service implementation only |
| Storage bucket/object naming | Service configuration only |
| Role RPC return details | Refresh authoritative role state |
| Trust-score side effects | Reload backend profile; never locally calculate authoritative verification |

review_note should not automatically become applicant-visible text; its audience must follow confirmed policy.

## Current UI behavior with no backend equivalent

| Source | Unsupported behavior |
| --- | --- |
| TierOneVerificationView.tsx; Verification VM | Four-digit preview contact verification and local Tier 1 completion |
| VerificationStatusView.tsx | Ordinary-user preview approval/rejection buttons |
| Verification VM | Local statuses reset on mount instead of loading submissions |
| Verification VM startTier | Requires Tier 2 before Tier 3 |
| Verification VM previewTierThreeDecision | Sets local actor to landlord and invokes onLandlordVerified |
| VerificationOverviewView.tsx | Says Tier 3 is Required to become a Landlord |
| TierThreeVerificationView.tsx | Says Tier 3 qualifies user as landlord; static properties |
| VerificationStatusView.tsx; VerificationTierCard.tsx | Assumes rejection means correction/resubmission available |
| VerificationModerationView.tsx; Admin VM | Request-corrected-information form and invented status |
| Admin VM | Local approval/rejection and fabricated audit success |
| Admin document/detail Views | Assumes Tier 3 has two documents including government ID, rather than actual submission documents |
| Admin queue/cards | Static priority/workload metadata without confirmed derivation |
| Approval CheckItem elements | Decorative checked indicators, not evidence of document review |

The Tier 2/3 flow is currently unreachable from the app shell. Its layouts are reusable, but business logic must be replaced before reconnection.

The Admin flow is reachable by authorized Admin routing, although review data/actions remain previews.

No authoritative local trust-score mutation was found in the inspected cohort. Trust score is loaded by Auth; verification success is simulated visually in the disconnected preview.

## Recommended implementation order

1. Preserve and stabilize existing Auth/Profile UI: verify sessions, Admin routing, account refresh, profile saves, and sign-out.
2. Establish file/Storage boundary: confirm bucket, MIME/size restrictions, and private retrieval; add compatible device selection.
3. Integrate Tier 2 using existing screens: replace samples, submissions, statuses, and fake decisions; reconnect existing verification entry.
4. Integrate Admin verification using existing screens: real queue/documents, Start review, approval/rejection, existing rejection input, refresh/error handling. This enables an end-to-end Tier 2 test.
5. Integrate Tier 3: replace static property options, correct eligibility/copy, remove landlord promotion, reuse established document/status flow.

Add simple cancelled/revoked labels during status wiring. Defer action workflows, optional filters, avatar editing, and resubmission refinements.

## Audit status

**AUDIT STATUS: BLOCKED BY MISSING UI / CONTRACT**

Concrete blockers to a complete live verification workflow:

- No real device-file picker integrated; small dependency addition required.
- Exact private Storage bucket, accepted MIME/size limits, and authorized document-access mechanism remain unconfirmed.
- Admin Start review and asynchronous loading/error/retry controls are missing small UI additions.

There is no blocker requiring a new screen, full property-management implementation, or UI for every database field.
