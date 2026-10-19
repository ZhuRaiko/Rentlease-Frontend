---
name: rentlease-security-review
description: Use when RENTLEASE work crosses authentication, authorization, verification, Admin actions, ownership, private locations/data, Storage, reports, tenancy or account restrictions.
---

# RENTLEASE implementation security review

Perform a lightweight development review of the changed flow. This does not replace formal thesis OWASP MASVS/MASTG evaluation or establish compliance.

## Inspect enforcement, not presentation

- MUST identify which backend RLS policy/function enforces each sensitive read/write. Hidden buttons, navigation checks and generated types alone do not prove access control. Inspect available policies/contracts read-only; label unavailable/live behavior unverified.
- Check authenticated identity and ownership. A client-supplied user, landlord, property or Admin identifier is an input, not authorization. Backend data and authenticated context must establish permission; inspect denied/non-owner paths.
- Check role escalation: users must not self-assign Admin; role writes use approved backend operations/policies; verification tier must not implicitly grant unrelated roles. Never invent policy to make a flow pass.
- Check restrictions and privileged/status fields. Ordinary clients must not freely set `reviewed_by`, approval state, trust score, Admin status, protected account status or equivalent backend-owned values. Legitimate review actions use confirmed authorized backend interfaces.

## Private data, Storage and secrets

Verify bucket privacy, read/write rights and owner/submission/property namespace against the current contract. Do not assume private documents have public URLs or that delete/replace access exists. Check unintended disclosure of private property locations and sensitive reports/tenancy/account data. Use [rentlease-supabase-contract-guard](../rentlease-supabase-contract-guard/SKILL.md) for exact contracts and partial-operation risks.

MUST NOT put service-role keys, Supabase secret keys, private tokens, credentials or passwords in React Native source, documentation, logs or committed files. Client-safe public Supabase configuration does not confer authorization. Debug traces must exclude access/refresh tokens, passwords, OTPs, document contents and unnecessary sensitive identifiers; do not paste secrets into a report while describing a finding.

MUST NOT bypass/weaken RLS or alter schema, policies, backend functions/infrastructure in this frontend repository. Preserve View → ViewModel → service boundaries; service placement alone does not guarantee authorization.

## Report proportionately

For each material finding, identify the affected action/path, evidence, impact and minimal correction or exact backend confirmation needed. Distinguish a confirmed vulnerability from a suspected risk or unverified policy assumption. Continue supported frontend work without inventing backend fixes. Record authorized runtime tests for owner/non-owner, ordinary/privileged and restricted states where relevant; do not perform destructive/live security testing without authorization.

Use [rentlease-test-runtime-verification](../rentlease-test-runtime-verification/SKILL.md) for evidence language and [rentlease-documentation-maintainer](../rentlease-documentation-maintainer/SKILL.md) for durable limitations. MUST NOT claim formal MASVS compliance or validated production security from this review or passing unit tests.
