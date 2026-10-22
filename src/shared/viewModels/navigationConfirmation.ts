// Owns only a pending navigation intent, not a second feature draft.
export function createNavigationConfirmation(hasUnsavedWork: () => boolean) {
  let pending: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => pending !== null,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request(action: () => void) {
      if (pending) return;
      if (!hasUnsavedWork()) { action(); return; }
      pending = action; notify();
    },
    cancel() { pending = null; notify(); },
    confirm() { const action = pending; pending = null; notify(); action?.(); },
  };
}
