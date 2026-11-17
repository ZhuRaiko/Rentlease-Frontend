/**
 * The Tenancy tab / Manage read order: the maintenance inbox starts together with the tenancies (it does not depend on them), the
 * activity read still waits for the tenancies, and the caller sets state once, after all three, behind its own stale-response guard.
 * A failed inbox read is null (the maintenance facts stay hidden); it never rejects, so it cannot become an unhandled rejection when the
 * tenancy read fails first.
 */
export async function readManagementFacts<T, A, I>(deps: { tenancies: () => Promise<T>; activity: (tenancies: T) => Promise<A>; inbox: () => Promise<I> }): Promise<{ tenancies: T; activity: A; inbox: I | null }> {
  const inbox = deps.inbox().then<I | null, null>(rows => rows, () => null);
  const tenancies = await deps.tenancies();
  const activity = await deps.activity(tenancies);
  return { tenancies, activity, inbox: await inbox };
}
