/** Bounded lifecycle checks; explicit recovery remains owned by the Auth ViewModel. */
export function createOnboardingStatusCheck(refresh: () => Promise<unknown>, now = Date.now) {
  let lastAttempt = -Infinity;
  let busy = false;
  let disposed = false;
  return {
    async check(eligible: boolean) {
      if (!eligible || disposed || busy || now() - lastAttempt < 30_000) return false;
      lastAttempt = now();
      busy = true;
      try { await refresh(); return !disposed; }
      catch { return false; } // The account coordinator owns safe error/retry presentation.
      finally { busy = false; }
    },
    dispose() { disposed = true; },
  };
}
