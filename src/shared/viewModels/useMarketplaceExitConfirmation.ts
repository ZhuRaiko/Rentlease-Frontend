import { useEffect, useRef, useState } from 'react';
import type { AppWorkspace } from '../models/marketplaceNavigation';
import { androidAppExitService } from '../services/androidAppExitService';
import { createMarketplaceExitConfirmation } from './marketplaceExitConfirmation';

export function useMarketplaceExitConfirmation(workspace: AppWorkspace, userId: string | null, allowed: boolean) {
  const context = useRef({ workspace, userId, allowed });
  context.current = { workspace, userId, allowed };
  const [confirmation] = useState(() => createMarketplaceExitConfirmation(androidAppExitService));
  useEffect(() => () => confirmation.invalidate(), [confirmation, workspace, userId, allowed]);
  return () => confirmation.request(() => {
    const current = context.current;
    return allowed && current.allowed && !!userId && current.userId === userId
      && current.workspace === workspace && workspace?.type === 'discovery';
  });
}
