/**
 * In-memory "last result" caches for the screens that open often (My properties, the Tenancy tab, Messages). Memory only: nothing is
 * written to disk, and a cache lives only as long as the app process.
 *
 * One slot per cache, keyed by the signed-in user id: `peek` returns a value only for the same user, so one account can never see another's
 * data. `begin()` hands a reader a token before it starts reading; `set` refuses the result when the cache was invalidated in between, so a read
 * that started before the user's own action can never put old data back. `accountCaches.invalidateAll()` empties every cache: it runs on
 * sign-out, on an account switch, and around every write the app sends (see instrumentMutations in the Supabase client).
 */
export interface AccountCache<T> {
  /** The cached value for this user, or null. */
  peek(owner: string | null | undefined): T | null;
  /** Call before starting a read; pass the token to `set` with the result. */
  begin(): number;
  /** Stores the result unless the cache was invalidated since `begin`. Returns whether it was stored. */
  set(owner: string, value: T, token: number): boolean;
  clear(): void;
}
const registry = new Set<AccountCache<unknown>>();
export function createAccountCache<T>(): AccountCache<T> {
  let entry: { owner: string; value: T } | null = null, epoch = 0;
  const cache: AccountCache<T> = {
    peek: owner => (owner && entry && entry.owner === owner ? entry.value : null),
    begin: () => epoch,
    set: (owner, value, token) => { if (token !== epoch || !owner) return false; entry = { owner, value }; return true; },
    clear: () => { epoch++; entry = null; },
  };
  registry.add(cache as AccountCache<unknown>);
  return cache;
}
export const accountCaches = { invalidateAll: () => { registry.forEach(cache => cache.clear()); } };

/** A read-only RPC keeps the caches; every other RPC is a write (write_, manage_, start_, send_, respond_, set_, publish_, establish_ ...). */
export const isMutatingRpc = (name: string): boolean => !/^(get|search|list)_/.test(name);

type Thenable = { then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => unknown };
/**
 * Wraps `client.rpc` so a write empties the caches when it is sent and again when it finishes (a read that began in between is refused by
 * `set`). Reads pass through untouched.
 */
export function instrumentMutations(client: { rpc: (name: string, ...rest: unknown[]) => unknown }, invalidate: () => void = accountCaches.invalidateAll): void {
  const rpc = client.rpc.bind(client);
  client.rpc = (name: string, ...rest: unknown[]) => {
    const builder = rpc(name, ...rest);
    if (!isMutatingRpc(name)) return builder;
    invalidate();
    const thenable = builder as Thenable | null;
    if (thenable && typeof thenable.then === 'function') {
      const then = thenable.then.bind(thenable);
      thenable.then = (onFulfilled, onRejected) => then(
        value => { invalidate(); return onFulfilled ? onFulfilled(value) : value; },
        reason => { invalidate(); if (onRejected) return onRejected(reason); throw reason; });
    }
    return builder;
  };
}
