import { getSupabaseClient } from './supabase/client';
import { createPublicProfileService } from './publicProfileService';

/** The app's one profile service (and so one cache), bound to the Supabase client. Kept apart from the factory so tests need no native modules. */
export const publicProfileService = createPublicProfileService(getSupabaseClient);
/** The public URL of a confirmed avatar path (already validated by the profile parser). */
export const publicAvatarUrl = (path: string | null): string | null => (path ? getSupabaseClient().storage.from('avatars').getPublicUrl(path).data.publicUrl : null);

