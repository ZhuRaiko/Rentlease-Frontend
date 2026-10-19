---
name: rentlease-supabase-contract-guard
description: Use whenever RENTLEASE work touches Supabase queries, tables, enums, RPCs, Auth, Storage, Realtime, Edge Functions or RLS-dependent behavior.
---

# RENTLEASE Supabase contract guard

Prevent structural contract drift and unsupported backend assumptions. This frontend consumes backend contracts; it does not redesign or administer them.

## Establish the contract

- MUST inspect canonical `src/shared/services/supabase/database.types.ts` for exact table names, Row/Insert/Update shapes, required/optional/null fields, relationships, enum values, RPC arguments and return shapes. The singleton `getSupabaseClient()` in `client.ts` is typed with `Database`; do not create a duplicate client or hand-authored schema contract.
- Generated types describe structure, not RLS, triggers, business transitions, Admin authorization or side effects. Read relevant `docs/BACKEND_CONTEXT.md`, feature docs and available current migrations, SQL functions, policies, triggers, Edge Functions and bucket configuration. Inspect these read-only where available; local `supabase/config.toml` alone does not prove live policies. If unavailable, label the exact security/business fact unconfirmed.
- MUST NOT invent columns, requiredness, enum/status values, RPC existence/argument names or return shapes. Respect optional versus nullable arguments and object versus array/row returns. Do not cast around a mismatch to force compatibility.

## Apply exact values and identity

Use generated enums and explicit UI/domain mappings. If a UI option has no supported representation, remove/disable it within scope or surface the mismatch as unresolved. MUST NOT silently substitute `other` or another supported value without confirmed policy.

Use authenticated Supabase identity where appropriate; a View-supplied owner/user/Admin ID is not authorization evidence. Backend RLS is authoritative. Never bypass it, embed service-role/secret credentials or replace authorization with frontend role gates. Apply [rentlease-security-review](../rentlease-security-review/SKILL.md) for sensitive paths; keep calls in services under [rentlease-frontend-mvvm-guard](../rentlease-frontend-mvvm-guard/SKILL.md).

## Storage and multi-step workflows

Verify bucket name, privacy, object namespace, overwrite/upsert setting and access/ownership assumptions from the actual contract. MUST NOT invent deletion/replacement rights, MIME allowlists or maximum sizes. Auth, Realtime and Edge Function entry points likewise require confirmed APIs and access assumptions, not convenient guesses.

A database insert → Storage upload → metadata insert sequence is not atomic without a backend mechanism covering all steps. Report partial success truthfully, expose recoverable state and orphan risks, and perform compensation only when existing rights/contracts support it. Do not invent cleanup permissions or unsafe retries.

When historical reports conflict with current generated types/backend schema, use the current contract. If current types, schema or source disagree, investigate drift and report the exact discrepancy rather than silently picking an invented compromise. Continue only supported independent work. MUST NOT change schema, policies, functions or infrastructure in this frontend task. Record unresolved runtime/business checks through [rentlease-documentation-maintainer](../rentlease-documentation-maintainer/SKILL.md).
