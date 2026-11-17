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

/** What the My properties / Manage facts hold, plus whether any real result (read or cached) is on screen yet. */
export interface ManagementState<T, A, I> { owner: string | undefined; tenancies: T[]; activity: A; inbox: I | null; loaded: boolean; busy: boolean; error: string | null }
export interface ManagementData<T, A, I> { tenancies: T[]; activity: A; inbox: I | null }
/** The state to start from: the cached result for this user when there is one (shown at once), else an empty one that is still loading. */
export function seedManagement<T, A, I>(owner: string | undefined, cached: ManagementData<T, A, I> | null, empty: () => A): ManagementState<T, A, I> {
  return cached && owner ? { owner, ...cached, loaded: true, busy: true, error: null } : { owner, tenancies: [], activity: empty(), inbox: null, loaded: false, busy: !!owner, error: null };
}
/** A (re)read begins: data already on screen for the same user stays and only `busy` turns on; otherwise start from the seed. */
export function beginManagementRefresh<T, A, I>(prev: ManagementState<T, A, I>, owner: string | undefined, cached: ManagementData<T, A, I> | null, empty: () => A): ManagementState<T, A, I> {
  return prev.owner === owner && prev.loaded ? { ...prev, busy: true, error: null } : seedManagement(owner, cached, empty);
}
/** A read failed: with data on screen the data stays and the failure is quiet; with none, the existing error state. */
export function failManagementRefresh<T, A, I>(prev: ManagementState<T, A, I>, owner: string | undefined, message: string, empty: () => A): ManagementState<T, A, I> {
  return prev.owner === owner && prev.loaded ? { ...prev, busy: false, error: null } : { owner, tenancies: [], activity: empty(), inbox: null, loaded: false, busy: false, error: message };
}
