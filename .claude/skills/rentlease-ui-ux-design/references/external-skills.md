# External design skills: roles and guardrails

All five are supporting tools. [../SKILL.md](../SKILL.md) is the authority. Installed project-level under `.claude/skills/` on 2026-11-12.

| Skill | Source | Installed by | Role in RentLease |
| --- | --- | --- | --- |
| rentlease-ui-ux-design | `.codex/skills/` (this repo) | adapted by hand | Primary authority |
| impeccable (4.8.2) | github.com/pbakaus/impeccable | `npx impeccable install --project --providers=claude-code --no-hooks` | Refinement, critique, audit |
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | `npx ui-ux-pro-max-cli init --ai claude --offline` | Usability research, pattern checks |
| hallmark (2.0.0) | github.com/Nutlope/hallmark | `npx skills add nutlope/hallmark --agent claude-code --skill hallmark --copy --yes` | Detect generic AI design |
| frontend-design | github.com/anthropics/claude-plugins-official (`plugins/frontend-design`) | direct file download | Supplementary creative direction |

Frontend Design's original location in `anthropics/claude-code` (`plugins/frontend-design/skills/frontend-design/`) no longer exists; that repo's plugin README points to `claude-plugins-official`, which is the same organization.

## Impeccable

- Use for `critique`, `audit`, `polish`, `layout`, `typeset`, `clarify`, `adapt`, `harden`. Tell it the platform is `android` and load `reference/android.md`, `reference/audit.native.md`, `reference/adapt.native.md`. `impeccable detect` and `live` are web/browser tools and do not apply to the native app.
- `PRODUCT.md` has no `## Platform` section. Impeccable treats a missing platform as `web`. Until the user approves adding `## Platform` / `android`, state the platform explicitly in every invocation.
- Do not run `init`, `document`, `extract`, or `new-work` flows that would write `PRODUCT.md`, `DESIGN.md`, or `.impeccable/` without showing the user what changes and getting approval. Redesign flows replace DESIGN.md; RentLease refines.
- Installed with `--no-hooks`: no provider hook manifests. The installer also placed four helper agents in `.claude/agents/` (`impeccable-*`) and a prebuilt engine binary at `.claude/skills/impeccable/scripts/bin/windows-x64/impeccable.exe`; its SHA-256 was checked against `engine-checksums.txt`.
- It has anonymous telemetry that is on by default (`impeccable telemetry status`). It was disabled for the install process via environment variables only; the persistent setting is unchanged. Turning it off permanently is the user's call.

## UI/UX Pro Max

- Python scripts run as `python` on this Windows machine (3.11.4); `python3` is not on PATH. Replace `python3` in the skill's examples.
- Useful: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<intent>" --domain ux -n 5` and `--stack react-native`. Verify the returned domain and top result fit the product before using it; retry once with narrower terms.
- Do not use `--persist` or `--output-dir`: they write `design-system/` into the repo. Do not follow its web-oriented style/palette/font recommendations over RentLease tokens.
- The installer also created six unrequested companion skills (`banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`). They were moved out of `.claude/skills/` because they are web or marketing oriented (`ui-styling` is shadcn/Tailwind; `design` references Gemini image generation) and conflict with the RentLease rules. They were not deleted: copies are in the session scratchpad and can be restored by re-running the installer.

## Hallmark

- Describes itself as for websites and new pages, and says never to use it on an existing design unless named. In RentLease use it only for audit-style questions such as "does this screen look AI-generated?" and `/hallmark audit <path>`.
- Do not use `redesign`, imagery generation, or the edit-time hook. `scripts/imagegen.mjs` calls Together AI only if `TOGETHER_API_KEY` is set (it is not set here); `scripts/install-hook.mjs` was not run. Browser capture needs puppeteer-core and Chrome, neither of which was installed.
- `skills-lock.json` was created at the repo root by the `skills` CLI to record this install.

## Frontend Design

- Guidance on distinctive typography, restraint, and avoiding templated defaults. It is web-flavored (heroes, CSS). Take the principles, skip the page-level advice.
- Some of its tell-list items (ALL-CAPS eyebrow labels, `A · B · C` meta strings) appear in RentLease's current spotlight estimate. DESIGN.md and approved wireframes outrank that advice; raise it as an observation, do not change approved screens on its basis.

## Updating

Re-running an installer can overwrite its own folder. Inspect before using `--force` or `update`. Never let an update touch `.codex/skills/`, `PRODUCT.md`, or `DESIGN.md`.
