# Public identity backend ledger

November 6, 2026; project cxfsbwbwmwmgtqfonqth. Status: prepared/local only.

Read-only catalog inspection checked profiles columns, column grants/RLS, public_profiles definition and numeric typmod, avatars bucket settings, Storage owner-folder policies and object metadata contract. Observed: ambiguous display_name, legacy avatar_path, public avatars bucket without MIME/size limits, own profile SELECT and column-scoped UPDATE, no existing avatar SELECT policy. No live data/schema/Storage mutation occurred for this feature.

Prepared migration: supabase/migrations/20261106133521_public_identity_nicknames_avatars.sql. Adds explicit public nickname/avatar consent, versioned owner saves, protected batch/own read and upload reconciliation contracts, sanitized compatible legacy public view, bounded immutable owner-scoped Storage paths. No legacy backfill, role changes or verification-document access. Rollback: supabase/test-support/public_identity_rollback.sql; disables consumer RPC access without restoring ambiguous-name disclosure.

Local disposable PostgreSQL: 212 checks passed with --viewings --reservations --public-identity, including existing UC-08/UC-09 workflows, privacy and Storage policy fixtures. No hosted writes or native Storage HTTP claims. Prior UC-09 deployed filename reconciliations are preserved unchanged. Deployment, backup and live verification require a separate authorization.

Skills applied: rentlease-feature-implementation, rentlease-frontend-mvvm-guard, rentlease-ui-ux-design, rentlease-supabase-contract-guard, rentlease-security-review, rentlease-implementation-ledger, rentlease-documentation-maintainer, rentlease-implementation-artifact-organizer, rentlease-test-runtime-verification; Supabase integration and verification guidance.

## Display Name revision, November 6

Read-only live query inspected auth.users INSERT triggers and pg_get_functiondef: on_auth_user_created calls public.handle_new_auth_user, inserting profiles(id,display_name) from user metadata/private fallback; trg_sync_tier1_verification independently synchronizes email/phone verification. Neither production function was modified. No permanent live backend mutation was performed in this phase.

Local prepared SQL revised at the same timestamp. A SECURITY DEFINER, empty-search-path, profile BEFORE INSERT trigger reads version-tagged acknowledged public Display Name from the newly inserted Auth row and sets only public nickname/consent fields. Trigger execution is revoked from public/anon/authenticated. It never grants identity authorization, reprocesses existing accounts, updates private names or follows later editable Auth metadata. Rollback removes only the added initialization trigger/function and retains existing privacy-preserving disable behavior. The atomic Auth/profile transaction avoids a post-verification client persistence gap.

Added synthetic signup/privacy/rollback PostgreSQL cases. Runner and fixture compile as Python, but database execution was blocked by automatic approval review usage-limit failure before execution. The previous 212 checks apply to the earlier revision only. Revised migration is NOT runtime-validated or deployment-ready. No live test signup/records or Storage writes were created.

Deployment order: validate revised SQL locally, then separately authorize reviewed backend deployment before releasing registration metadata consumers. Signups before deployment do not initialize this new public-name projection; no ambiguous legacy data is migrated automatically. Avatar interruption cleanup remains session-scoped, not a durable journal.

Skill files read for this revision: .codex/skills/rentlease-feature-implementation/SKILL.md; rentlease-frontend-mvvm-guard/SKILL.md; rentlease-ui-ux-design/SKILL.md; rentlease-supabase-contract-guard/SKILL.md; rentlease-security-review/SKILL.md; rentlease-test-runtime-verification/SKILL.md; rentlease-documentation-maintainer/SKILL.md; rentlease-implementation-ledger/SKILL.md; rentlease-implementation-artifact-organizer/SKILL.md. Also user-level using-superpowers, brainstorming, test-driven-development, verification-before-completion and Supabase integration skill. Existing docs/architecture/UI references were reused; no Figma/artifact generation was needed.

## Local validation completed, November 7, 2026

Supersedes the previous approval-blocked status for the revised migration. Local Docker Desktop desktop-linux only, disposable rentlease-messaging-test-display-name, PostgreSQL image public.ecr.aws/supabase/postgres:17.6.1.141, networking disabled and no mounts or host ports. Existing synthetic runner: --public-identity passed 101 checks / 0 failures; --public-identity --viewings --reservations passed 223 checks / 0 failures, both exit 0. Migration SHA-256: 85a613f5246c983f18546eb7183a984ab9190dd00986efc5cc063925133634cc. The initial startup-only createdb failure was resolved by waiting for the final server after image initialization; no source edits were needed. Both runs include migration application, privacy/authorization safeguards and rollback checks. Container stopped and --rm removal verified. No production queries, records, deployment or permanent live backend mutation occurred. Revised SQL is locally validated; live deployment and native Android/Storage HTTP verification remain separately pending.
