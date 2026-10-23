---
name: rentlease-implementation-artifact-organizer
description: Use when RENTLEASE implementation work produces reports, audits, investigations, database contract analyses or handoff notes, or when organizing existing implementation artifacts.
---

# RENTLEASE implementation artifact organizer

Keep temporary development reports separate from authoritative living documentation. Apply this policy when creating reports during any RENTLEASE implementation task and when explicitly organizing existing reports. Update the existing feature implementation history for ordinary phase completion. Create a separate report only for a genuinely separate audit/investigation explicitly requiring its own artifact; a final chat summary is still allowed.

## Classify by purpose

Inspect each candidate's name, contents and context. A Markdown extension or RENTLEASE prefix alone does not make a file disposable.

**Permanent context:** preserve `docs/features/**`, including `AUTHENTICATION_PROFILES.md`, `USER_VERIFICATION.md` and future living feature docs; `docs/architecture/**` if present; `docs/FEATURES.md`, `docs/ROUTES.md`, `docs/README.md`; and other living architecture/backend/frontend/context documents. Update these as behavior changes during implementation, but never move, delete or replace them with reports during artifact cleanup.

**Historical/separate artifacts:** existing one-pass implementation/completion summaries and phase reports, plus separately requested audits/investigations. Retain older database sanity/contract reports, coverage analyses, migration notes and technical handoffs; their existence does not authorize a new file per phase. Examples include `RENTLEASE_PHASE_*`, `RENTLEASE_DATABASE_*`, `RENTLEASE_UI_COVERAGE_*` and `RENTLEASE_UI_COV_*`. Historical reports never override current source, generated Supabase `database.types.ts`, current backend schema or current living feature documentation. Put durable behavioral knowledge in living docs instead.

## Destination

Create new temporary reports directly under `docs/implementation-reports/`, never the repository root:

| Primary purpose | Subfolder |
| --- | --- |
| One continuously updated implementation history/roadmap per feature | `phases/` |
| One continuously updated backend ledger per feature; explicitly separate database audits/investigations | `database/` |
| Architecture/code/implementation audit or investigation | `audits/` |
| UI/screen/frontend coverage audit | `ui/` |
| Other clearly temporary material | `misc/` |

Use primary purpose over filename prefix: a phase-named cold-launch investigation belongs in `audits/`. Avoid additional nesting. Existing root reports are precedent for cleanup, not permission to create more there.

## One continuously maintained record set per feature

MUST maintain one living feature document, one continuously updated implementation history/roadmap and one continuously updated backend ledger per feature. Reuse existing feature-scoped files; create a missing file once, not one file per phase. New phases become dated sections inside those files. Do not create separate Phase 3/4/5 implementation reports or backend-ledger files.

For every future Property & Listing phase update:

- `docs/features/PROPERTY_LISTING_MANAGEMENT.md`
- `docs/implementation-reports/phases/PROPERTY_LISTING_MANAGEMENT_IMPLEMENTATION.md`
- `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`

Keep backend actions in the ledger; if no new interaction occurred, record that honestly rather than implying a live check. Separate reports are appropriate only for genuinely separate audits/investigations explicitly requiring their own artifact. Preserve existing historical reports; do not rename or discard them without a separate request.

## Stable feature-scoped naming

Use stable `<FEATURE_NAME>_IMPLEMENTATION.md` and `<FEATURE_NAME>_BACKEND_LEDGER.md` filenames for the continuous records above. Dates and phase numbers belong in their sections, not new phase-specific filenames. Avoid ambiguous new names such as `RENTLEASE_PHASE_3_FINAL_REPORT.md`. Independently requested audits/investigations use descriptive dated feature/purpose names in the appropriate category. Ledger entry content follows [rentlease-implementation-ledger](../rentlease-implementation-ledger/SKILL.md).

## Organize safely

1. Inspect root candidates and `git status` before moving anything. Exclude source folders, tests, scripts, supabase, assets, README.md, AGENTS.md, package.json, package-lock.json, tsconfig.json, app.json, app.config.*, eas.json, .env*, .gitignore and other normal configuration/project files. Leave ambiguous living-context files in place and explain why.
2. Create the five category directories as needed. Resolve absolute source/destination paths and verify both stay inside this repository before moving. Never overwrite a destination collision; choose a nonconflicting name or ask if intent is unclear.
3. Move tracked reports with `git mv` when practical; move untracked reports with native filesystem operations. Preserve contents byte-for-byte, including existing edits. Do not reset or stage unrelated work. Do not delete reports merely because they are obsolete or disposable; retain them unless the user explicitly requests deletion or archiving. Never commit or push automatically.
4. Check references to moved paths. Preserve report contents and protected living docs during cleanup; when reference updates are authorized, update all affected references; otherwise disclose stale references rather than silently editing protected living documents.
5. Run `git status` and `git diff --check`. Verify moved file hashes match their originals. Report the skill/path used, directories created, every old/new path, files intentionally left in root, protected docs left untouched, validation results and any remaining reference issues.

Common mistakes: deleting obsolete reports, moving living feature docs, treating historical reports as current contracts, or saving a requested copy-paste report in root for convenience. Move historical artifacts; preserve living context; use the category folder even under time pressure.
