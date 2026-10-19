---
name: rentlease-implementation-artifact-organizer
description: Use when RENTLEASE implementation work produces reports, audits, investigations, database contract analyses or handoff notes, or when organizing existing implementation artifacts.
---

# RENTLEASE implementation artifact organizer

Keep temporary development reports separate from authoritative living documentation. Apply this policy when creating reports during any RENTLEASE implementation task and when explicitly organizing existing reports. Create a report only when useful or requested; a final chat summary is still allowed.

## Classify by purpose

Inspect each candidate's name, contents and context. A Markdown extension or RENTLEASE prefix alone does not make a file disposable.

**Permanent context:** preserve `docs/features/**`, including `AUTHENTICATION_PROFILES.md`, `USER_VERIFICATION.md` and future living feature docs; `docs/architecture/**` if present; `docs/FEATURES.md`, `docs/ROUTES.md`, `docs/README.md`; and other living architecture/backend/frontend/context documents. Update these as behavior changes during implementation, but never move, delete or replace them with reports during artifact cleanup.

**Temporary artifacts:** one-pass implementation/completion summaries, phase reports, database sanity/contract reports, investigations, audits, coverage analyses, migration notes and generated technical handoffs. Examples include `RENTLEASE_PHASE_*`, `RENTLEASE_DATABASE_*`, `RENTLEASE_UI_COVERAGE_*` and `RENTLEASE_UI_COV_*`. Historical reports never override current source, generated Supabase `database.types.ts`, current backend schema or current living feature documentation. Put durable behavioral knowledge in living docs instead.

## Destination

Create new temporary reports directly under `docs/implementation-reports/`, never the repository root:

| Primary purpose | Subfolder |
| --- | --- |
| Phase implementation/completion | `phases/` |
| Database/schema/Supabase sanity or contract | `database/` |
| Architecture/code/implementation audit or investigation | `audits/` |
| UI/screen/frontend coverage audit | `ui/` |
| Other clearly temporary material | `misc/` |

Use primary purpose over filename prefix: a phase-named cold-launch investigation belongs in `audits/`. Avoid additional nesting. Existing root reports are precedent for cleanup, not permission to create more there.

## Organize safely

1. Inspect root candidates and `git status` before moving anything. Exclude source folders, tests, scripts, supabase, assets, README.md, AGENTS.md, package.json, package-lock.json, tsconfig.json, app.json, app.config.*, eas.json, .env*, .gitignore and other normal configuration/project files. Leave ambiguous living-context files in place and explain why.
2. Create the five category directories as needed. Resolve absolute source/destination paths and verify both stay inside this repository before moving. Never overwrite a destination collision; choose a nonconflicting name or ask if intent is unclear.
3. Move tracked reports with `git mv` when practical; move untracked reports with native filesystem operations. Preserve contents byte-for-byte, including existing edits. Do not reset or stage unrelated work. Do not delete reports merely because they are obsolete or disposable; retain them unless the user explicitly requests deletion or archiving. Never commit or push automatically.
4. Check references to moved paths. Preserve report contents and protected living docs during cleanup; disclose any stale references for a separately authorized update rather than silently editing those documents.
5. Run `git status` and `git diff --check`. Verify moved file hashes match their originals. Report the skill/path used, directories created, every old/new path, files intentionally left in root, protected docs left untouched, validation results and any remaining reference issues.

Common mistakes: deleting obsolete reports, moving living feature docs, treating historical reports as current contracts, or saving a requested copy-paste report in root for convenience. Move historical artifacts; preserve living context; use the category folder even under time pressure.
