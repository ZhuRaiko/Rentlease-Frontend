interface ExitDependencies {
  showConfirmation: (confirm: () => void, cancel: () => void) => void;
  exit: () => void;
}

/** One pending native confirmation. A delayed response cannot exit a different workspace/account. */
export function createMarketplaceExitConfirmation({ showConfirmation, exit }: ExitDependencies) {
  let pending: object | null = null;
  return {
    request(isCurrent: () => boolean) {
      if (pending || !isCurrent()) return;
      const attempt = {}; pending = attempt;
      const cancel = () => { if (pending === attempt) pending = null; };
      showConfirmation(() => {
        if (pending !== attempt) return;
        pending = null;
        if (isCurrent()) exit();
      }, cancel);
    },
    invalidate() { pending = null; },
  };
}
