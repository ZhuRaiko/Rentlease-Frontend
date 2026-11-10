import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';

// Account-display enrichment only. The account loader supplies the confirmed Auth
// identity; its existing coordinator invalidates stale reads on account changes.
export async function readAccountOwnership(client: SupabaseClient<Database>, userId: string): Promise<boolean | undefined> {
  try {
    const { data, error } = await client.from('properties').select('id,landlord_id')
      .eq('landlord_id', userId).limit(1);
    if (error || !data || data.length > 1 || data.some(row => row.landlord_id !== userId)) return undefined;
    return data.length === 1;
  } catch {
    // An unavailable ownership indication must not block Auth or claim ownership.
    return undefined;
  }
}
