/**
 * The signed-in user read from the LOCAL stored session (supabase-js getSession): no network call. Read paths use it for the "same account
 * before and after the read" check, which costs one local read instead of a round trip to the Auth server each time.
 *
 * The result has the shape of auth.getUser() ({data:{user},error}) so every caller keeps its own comparison and its own error text.
 * A missing session is `{data:{user:null},error}`, as getUser reports it. A revoked or deleted account is NOT noticed until the session is
 * refreshed (getSession refreshes an expired access token itself), so a WRITE, a sign-in/out, a profile or verification action, and anything
 * else where a stale session matters keeps the network `auth.getUser()` instead. A client without a local session store (a test double that only
 * implements getUser) falls back to getUser.
 */
export interface SessionUser { id: string }
type SessionClient = { auth: { getSession?: () => Promise<{ data: { session: { user: SessionUser } | null }; error: unknown }>; getUser: () => Promise<{ data: { user: SessionUser | null }; error: unknown }> } };
export async function readSessionUser(client: unknown): Promise<{ data: { user: SessionUser | null }; error: unknown }> {
  const auth = (client as SessionClient).auth;
  if (typeof auth.getSession !== 'function') return auth.getUser();
  try {
    const { data, error } = await auth.getSession();
    if (error) return { data: { user: null }, error };
    if (!data.session) return { data: { user: null }, error: new Error('No signed-in session.') };
    return { data: { user: data.session.user }, error: null };
  } catch (error) { return { data: { user: null }, error }; }
}
/** The signed-in user id from the local session, or null when there is none. */
export async function getSessionUserId(client: unknown): Promise<string | null> {
  const { data, error } = await readSessionUser(client);
  return error || !data.user ? null : data.user.id;
}
