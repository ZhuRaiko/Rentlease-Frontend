import { useMemo } from 'react';
import type { ProfileRole } from '../../../shared/models/PublicProfile';
import { publicAvatarUrl } from '../../../shared/services/publicProfileClient';
import { usePublicProfile } from '../../../shared/viewModels/usePublicProfile';
import { screenView, UNAVAILABLE, type ScreenView } from '../models/ProfileScreen';

export type ProfileScreenState =
  | { phase: 'loading' }
  | { phase: 'unavailable'; message: string }
  | { phase: 'error'; message: string; retry: () => void }
  | { phase: 'ready'; view: ScreenView; idVerified: boolean; avatarUrl: string | null; id: string };

/** The profile screen's state: one cached read, then the block the entry point asked for (or the other one, or identity only). */
export function usePublicProfileScreenViewModel(accountId: string | undefined, userId: string, prefer: ProfileRole | null): ProfileScreenState {
  const state = usePublicProfile(accountId, userId);
  return useMemo((): ProfileScreenState => {
    if (state.status === 'denied') return { phase: 'unavailable', message: UNAVAILABLE };
    if (state.status === 'error') return { phase: 'error', message: state.message, retry: state.retry };
    if (state.status !== 'ready') return { phase: 'loading' };
    return { phase: 'ready', view: screenView(state.profile, prefer), idVerified: state.profile.idVerified, avatarUrl: publicAvatarUrl(state.profile.avatarPath), id: state.profile.id };
  }, [state, prefer]);
}
