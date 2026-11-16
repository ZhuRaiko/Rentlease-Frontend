import { createContext, useContext } from 'react';
import type { ProfileRole } from '../models/PublicProfile';

/**
 * How a screen asks to open someone's profile. The root (App.tsx) owns the profile screen and provides this; screens only ever call open(userId, role),
 * where role is the block the entry point is about (the person's role in this listing, chat, request or tenancy). Without a provider, open does nothing.
 */
export interface ProfileNavigation { open: (userId: string, prefer: ProfileRole) => void }
export const ProfileNavigationContext = createContext<ProfileNavigation | null>(null);
export const useProfileNavigation = (): ProfileNavigation | null => useContext(ProfileNavigationContext);
