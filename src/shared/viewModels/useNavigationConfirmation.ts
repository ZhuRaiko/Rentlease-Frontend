import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createNavigationConfirmation } from './navigationConfirmation';

export function useNavigationConfirmation(hasUnsavedWork: boolean) {
  const dirty = useRef(hasUnsavedWork);
  dirty.current = hasUnsavedWork;
  const [guard] = useState(() => createNavigationConfirmation(() => dirty.current));
  const navigationConfirmation = useSyncExternalStore(guard.subscribe, guard.getSnapshot);
  useEffect(() => () => guard.cancel(), [guard]);
  return { navigationConfirmation, requestNavigation: guard.request, cancelNavigation: guard.cancel, confirmNavigation: guard.confirm };
}
