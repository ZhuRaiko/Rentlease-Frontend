import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabaseClient } from '../client';

export function createRealtimeChannel(channelName: string): RealtimeChannel {
  return getSupabaseClient().channel(channelName);
}

export async function removeRealtimeChannel(channel: RealtimeChannel): Promise<void> {
  await getSupabaseClient().removeChannel(channel);
}
