# RentLease: Claude Code instructions

@AGENTS.md

`AGENTS.md` is authoritative for architecture rules, the frontend-only boundary, file extensions, and the repo-local skill protocol. Nothing below relaxes it.

## Authoritative documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): MVVM and integration boundaries
- [docs/FRONTEND_CONTEXT.md](docs/FRONTEND_CONTEXT.md): stack and technologies not to introduce
- [docs/FIGMA_WORKFLOW.md](docs/FIGMA_WORKFLOW.md): Figma and wireframe workflow
- [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md): visual direction and product context
- Feature documents under `docs/features/`

## Design work

Platform is **Android-first React Native + Expo + TypeScript (MVVM)**, never web. Use `.claude/skills/rentlease-ui-ux-design/` for any UI work. It is the primary design authority and defines how the supporting skills may be used.

Priority order: approved wireframes/screenshots/Figma, then DESIGN.md + PRODUCT.md + the RentLease skill, then existing components and `src/shared/theme` tokens, then supporting skills in this order: Impeccable (refine/critique), UI/UX Pro Max (usability research), Hallmark (generic-AI detection), Frontend Design (creative direction). A supporting skill never overrides approved RentLease branding.

Rules for design skills:

- Implement only with existing React Native components and theme tokens. Do not add Tailwind, shadcn/ui, CSS, HTML, WebView, a web framework, fonts, or dependencies because a skill suggests it.
- Preserve View → ViewModel → Service → Backend. Views never call Supabase or external APIs.
- Do not let a skill create or replace `PRODUCT.md`, `DESIGN.md`, `design-system/`, `.impeccable/`, or root files without showing the change and getting approval.
- Tell Impeccable the platform is `android`. On this Windows machine run UI/UX Pro Max scripts with `python`, not `python3`.
- Verify layouts at about 411dp/100% and 320dp/150% font. Report what was and was not verified.

Details: `.claude/skills/rentlease-ui-ux-design/references/`.

## Language

Use American English (en-US) for new or modified user-facing text, accessibility labels, tests, and documentation.

## Git

Commit, push, merge, and reset only when asked. Leave `.vscode/` alone.
