# Tier 2 recommendation privacy and disclosure review

November 8, 2026. Predeployment checkpoint review; not research ethics approval or a determination of legal basis. **Deployment remains blocked.** No production query, change or deployment was performed during this review.

## Evidence available

Reviewed PRODUCT.md, current Authentication/Profile, User Verification and Property Recommendations feature documents, the existing Tier 2 contract audit, RegistrationView.tsx, PublicIdentityEditor.tsx, TierTwoVerificationView.tsx and the verification flow's disclosure/consent references. Repository filename/content searches found no app privacy notice, approved informed-consent form, research data-use notice or adviser/ethics approval covering this new use. Materials outside this repository may exist; absence here is not proof that they do not exist.

Registration says private first/last names are used for account and verification requirements. Public identity acknowledgement covers the selected Display Name/photo, not verification-status disclosure or ranking. TierTwoVerificationView's introduction describes optional Tier 2 and a Trusted badge after Admin review. That is evidence of intended credibility presentation, but not proof of a consented secondary ranking purpose, approved research disclosure, or authorization for a batch status endpoint. Existing technical privacy safeguards are not participant notice/approval.

| Processing/disclosure | Finding |
| --- | --- |
| Internal ranking | A confirmed approved owner signal supplies 10% of the existing experimental 80/10/10 score. Existing disclosures reviewed do not explicitly explain this use or its effect on visibility. |
| Disclosure to authenticated users | The prepared RPC sends listing ID, its actual owner ID and a nullable status to active Tier 1 callers for eligible public listings. This is disclosure even without a badge: an authorized app user can inspect API responses. Batching and access restrictions minimize exposure but do not establish legal basis. |
| Public-facing verification badge | Existing Tier 2 introduction mentions one; this implementation adds no badge/profile disclosure. That wording alone cannot authorize this endpoint. Anonymous users cannot call it. |
| Documents and private identity | The RPC returns no document, legal name, reviewer, reason, application ID/history or private coordinates. Internal approved-row/cache checks do not grant direct table access. These protections must remain regardless of notice outcome. |

## Proposed participant-facing disclosure - DRAFT FOR REVIEW ONLY

> RentLease uses rental preferences and listing information to order property recommendations. It may also use whether the listing's actual owner has a currently confirmed approved Tier 2 identity verification as a small credibility factor. In the proposed ranking, preference relevance contributes 80%, confirmed owner Tier 2 verification 10%, and stored listing completeness 10%. These are experimental weights, not scientifically optimized results or a guarantee about a property or person. Eligible listings can still appear without confirmed Tier 2 verification.
>
> For eligible published listings, RentLease's recommendation service makes a limited listing-linked verification result available to signed-in users with active Tier 1 eligibility. The result can confirm approval, indicate that approval is not confirmed, or be unknown when evidence cannot be determined reliably. It is used for ranking; this change does not add a public verification badge. Tier 2 identity verification does not establish property ownership, safety, suitability or Tier 3 property approval.
>
> This service does not disclose verification documents, private legal names, reviewer identities, rejection reasons, application histories or exact property locations. Private verification evidence remains restricted to existing authorized verification processes. No extra preference permission, account role or property-management permission is granted by a ranking result.

This draft is not installed in the app and must not be treated as accepted consent. It intentionally makes no promise of an opt-out, withdrawal control, retention period or contact channel that has not been established. The team must attach its approved notice/contact/rights process rather than inventing one in code.

## Required release decisions and evidence

1. Research team and relevant adviser/ethics reviewer must confirm the applicable approved data-use basis for both ranking and disclosure, and decide whether the study protocol/notice needs amendment.
2. Supply the actual approved privacy notice and informed-consent materials, including version/date and recorded scope. Decide how existing owners with prior approvals will be notified and whether new acknowledgement is required; do not assume legacy verification constitutes consent.
3. Approve final wording and where/when it is shown. Confirm rights/contact, retention and withdrawal/objection handling under the team's actual process; any new product control needs separately scoped implementation.
4. Record approval or an explicitly approved alternative. Internal-only ranking would require a different server-side design; removing badges alone would not make this client-readable RPC internal-only. Do not deploy the present endpoint under that assumption.
5. After privacy coverage is resolved, obtain separate deployment authorization, fresh source-drift/backup review, hosted permission checks and Android acceptance.

## Technical checkpoint conclusion

No material implementation/security defect found in the reviewed scope. The migration requires active Tier 1 callers, checks supplied batches before deduplication, restricts public discovery eligibility and actual ownership, and returns only the three specified fields. Unknown/malformed/failed results receive no bonus; no existing verification workflow, RLS or 80/10/10 weights change. Rollback drops only the new RPC without CASCADE. This technical conclusion does not resolve the privacy release blocker.

Previously observed validation remains 79 PostgreSQL checks and 175 focused frontend tests, with TypeScript/whitespace/security scans. This checkpoint freshly reruns the 49 recommendation scoring/service/workflow tests and TypeScript; SQL and broad suites are not repeated because the reviewed implementation is unchanged. No hosted or physical Android acceptance is claimed.
