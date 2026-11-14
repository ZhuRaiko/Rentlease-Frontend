# reviewerRole in published reviews (migration 20261114200000)

**Status: prepared locally, NOT applied.** Apply only after review, a fresh predeploy backup and live-source reconfirmation. Apply with `supabase db query --linked -f`, then `migration repair --status applied 20261114200000`. Never `db push`.

## Why
`get_published_rental_reviews('user', id)` returns every approved person-review about the user, from either side, and its rows do not say who wrote them. The profile section "Landlord's experience with this user" could therefore show a tenant's rating of a landlord.

## What changes
Each returned row gains one key, `reviewerRole`: `'landlord'` when the author is the landlord of the review's tenancy (`entries.reviewer_id = tenancies.landlord_id`), otherwise `'tenant'`. A property review is always written by the tenant. The value is a role, not an identity; no reviewer id is added. Count, average, ordering, paging, filters and access checks are untouched.

The function is patched in `pg_get_functiondef` text, two anchors, each exactly once:
- A1 `select x.* from rentlease_reviews.entries x` becomes `select x.*,(x.reviewer_id=t.landlord_id) as reviewer_is_landlord from rentlease_reviews.entries x`
- A2 `'moderatedAt',q.moderated_at)` becomes `'moderatedAt',q.moderated_at,'reviewerRole',case when q.reviewer_is_landlord then 'landlord' else 'tenant' end)`

The migration aborts unless the live source md5 is the pin, checks the edit is exactly reversible, the result matches the recorded md5, and owner, ACL, security-definer flag, config, volatility, return type and argument list are identical afterward.

## Pins (hosted, read-only, 2026-11-14)
| | md5(prosrc) |
|---|---|
| `get_published_rental_reviews(text,uuid,integer)` before | `7f0847017fc4547576efd9e8eb16960a` |
| after | `e0ba690c49e865d6e8c1f33b9aa209ea` |

The "before" value was also recomputed from the repo migration `20261110125450_tenancy_ratings_reviews.sql` and matches, so the repo text is the hosted text.

## Rollback
`published_reviews_reviewer_role_rollback.sql` restores the original source (checked back to the "before" md5), is idempotent, refuses an unknown source, and re-checks the ACL. Reviews are untouched either way.

## Tests
`python supabase/tests/run_published_reviews_reviewer_role.py` (Docker; no network, mounts or ports; the hosted project is never contacted). `--migration <copy>` / `--rollback <copy>` for mutation checks.

Proves: the function and `rentlease_reviews.actor` are extracted byte-for-byte from the repo migration and the function matches the hosted md5; a property review reads `tenant`; a user review written by the landlord reads `landlord`; one written by the tenant reads `tenant`, including a user who is a tenant in one tenancy and a landlord in another; every result equals the original function's apart from the new key (count, average, order, existing keys, paging); the same refusals as the original for a stranger, an invalid kind, a negative offset and no signed-in user; the rollback restores the exact md5; every test body is rolled back.

Does NOT prove: hosted data, hosted RLS or the real `public.reviews` link (`user_review_id` is a plain column in the fixture); the tables other than `entries` are minimal stand-ins.

## Frontend
`reviewerRole` is parsed strictly (`landlord` or `tenant`; anything else is unknown). The profile section shows only rows with `reviewerRole === 'landlord'` and computes its count and average from those rows (the loaded page: at most the 20 newest published user reviews), not from the server totals, which include tenants' reviews.
