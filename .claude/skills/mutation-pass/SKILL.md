---
name: mutation-pass
description: >
  Use only when the user says "run the mutation pass", before a demo freeze, or
  after a final design pass. Runs a small, scoped mutation check on the
  high-risk logic and reports what the tests missed.
---

# Mutation pass

Run this only when asked (see the Testing policy in CLAUDE.md). Never run it for layout, wording, styling or navigation work.

## Scope

Only these areas, and only if they changed since the last tagged checkpoint (`git diff <last-tag> --stat` shows it):

- Location consent and sharing: ShareWish, LocationShare, and the confirm card.
- The property creation marker and duplicate-save protection.
- Anything that deletes, archives or reinstates data.

An area with no changes since the last tag is skipped and reported as skipped.

## Rules

- At most 10 mutants per area.
- Mutate real logic: conditions, guards, comparisons, early returns. Do not mutate strings, copy or styles.
- Run only the relevant test files for each mutant. Apply one mutant at a time in a single process (never two runs at once), restore the source after each one, and use a script that restores in a `finally` block.
- When finished, confirm `git status` shows no leftover edits from the mutants.
- Never leave source files modified, and never commit while mutants are applied.

## Report

- Mutants run, caught, survived (per area).
- For each survivor: add a real behavior test, or say why none is reasonable.
