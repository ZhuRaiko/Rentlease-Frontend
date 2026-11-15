# Identity / tenancy gate: lock order and design notes

Prepared 2026-11-12; **applied to the hosted project 2026-11-12 about 17:08 UTC** (see the HOSTED_MIGRATION entry in `docs/implementation-reports/database/PROPERTY_LISTING_MANAGEMENT_BACKEND_LEDGER.md`). Files: `supabase/migrations/20261112164000_identity_tenancy_gate.sql`, `supabase/test-support/identity_tenancy_gate_rollback.sql`, `supabase/test-support/identity_tenancy_gate_baseline.sql` (live pre-migration bodies, fixture only), `supabase/tests/run_identity_tenancy_gate.py`.

Open tenancy = `status in ('proposed','pending_confirmation','active')`, the definition `rentlease_property_identity.promote` already uses. `promote` is unchanged and still the last line of defense.

## The one lock

Every path takes `pg_advisory_xact_lock(hashtextextended(<property_id>::text, 0))` **first**, before any row lock, and holds it to the end of the transaction. It is the lock the existing identity, reservation, tenancy and completeness guards use (see the comment in `request_rental_reservation`). Advisory locks are re-entrant inside one session, so the explicit locks the migration adds are no-ops when a helper already took it; they exist so each new check does not silently depend on a helper's internals.

| Function | Order of operations (new steps in bold) |
| --- | --- |
| `manage_property_identity` | `lock_owner(property)` = READ COMMITTED check, Tier 1 check, **advisory lock**, owner/active check → `require_ready` → receipt replay and version checks → branch. In the `same_property_correction` branch: **explicit advisory lock (re-entrant)** → **open-tenancy check (raise 22023)** → existing "already open" check, identity validation, inserts. The `cancel` branch is untouched: row lock on the correction (`for update`), cancel. |
| `begin_property_identity_verification` | `lock_owner(property)` (**advisory lock** first) → `require_ready` → read current identity and correction → revision check → return an already-open submission if one exists (idempotent, allowed) → "already verified" check → **explicit advisory lock (re-entrant)** → **open-tenancy check (raise 22023)** → insert the submission and update the correction. |
| `establish_tenancy` | `rentlease_tenancy_setup.context(reservation)` = Tier 1, read reservation, **advisory lock on the reservation's property**, then `for share` on reservation, property, listing, conversation, binding, tenancy → receipt replay and eligibility/version checks → read the reservation → **explicit advisory lock (re-entrant)** → **pending-identity-review check (raise 22023)** → insert the tenancy (its triggers take the same advisory lock again). |
| `get_admin_property_identity_review` | No lock. It is a read; `open_tenancy` is display information. Authority stays in `review_property_identity_verification`, which locks the property before calling `promote`. |
| `promote` | Unchanged. Runs under the review function's lock and refuses with an open tenancy. |

Ordering rule that keeps it deadlock-free: advisory lock on the property, then row locks, and no path takes an advisory lock after a row lock on a different property. All three functions lock the same key, so a submit and a propose on one property are serialized; the second waits, then (READ COMMITTED, new statement snapshot) sees the first one's committed rows and refuses.

Evidence (disposable container, 66 checks): a probe holds the property key in one session and each function is shown to wait for it (2.8 to 3.0 s); 8 concurrent begin-vs-propose rounds always produce exactly one winner (both orders occurred) and never an open tenancy together with a begun verification.

## Decisions to review

1. **What blocks a proposal.** A correction that is `submitted`, under review, **or has begun verification** (its submission is pending or under review). "Begun" is included on purpose: a correction becomes `submitted` only when evidence is finalized, so a narrower rule would let a tenancy be proposed between *begin* and *finalize*, and the two gates could not be mutually exclusive. A plain draft correction (no verification begun) does not block a proposal; its owner then cannot begin (submission gate) and can cancel. If you want only `submitted` or under review, change the predicate in step 3 and the harness expectations.
2. **What the submission gate blocks.** Only the action that starts a correction (`same_property_correction`) and only the creation of a *new* verification submission. An exact retry that returns an already-existing submission, reads, and `cancel` stay allowed.
3. **Finalize is not gated.** The function that sets a correction to `submitted` was not in scope. It is only reachable after `begin`, which is gated, and the reverse gate prevents a tenancy while that begun submission is pending, so the window is closed. If a legacy row were already in the overlap state, Approve is disabled in the admin UI (via `open_tenancy`) and `promote` would refuse anyway.
4. **Live state on 2026-11-12:** 1 correction in total (status `applied`), 0 open tenancies, no overlap.

## Byte-level note (important for applying)

The hosted bodies of these five functions contain carriage returns (they were applied from CRLF files). The md5 pins are over those exact bytes. Therefore the patches are single-line (no dependence on line endings), and the harness reads every SQL file as bytes. Do not "normalize" line endings of the baseline fixture.

## After applying (same direct method as the admin-access migration)

Back up immediately before (tenancy rows change constantly), confirm the five md5 pins on the live project, run only this file with `supabase.cmd db query --linked -f`, then `supabase.cmd migration repair --status applied 20261112164000`. Never `db push` (known history drift is recorded in the ledger).
