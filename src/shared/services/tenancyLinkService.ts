import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from './supabase/database.types';
import {readSessionUser} from './supabase/sessionUser';
import {parseActiveTenancyLinks, type ActiveTenancyLink} from '../models/TenancyLink';

/** One read of the signed-in user's ACTIVE tenancies, so Chat can say who is renting without a request per conversation. */
export function createTenancyLinkService(client: () => SupabaseClient<Database>) {
  return {
    async activeLinks(owner: string, signal: AbortSignal): Promise<ActiveTenancyLink[]> {
      const before = await readSessionUser(client());
      if (signal.aborted || before.error || before.data.user?.id !== owner) throw new Error('Account changed.');
      const r = await client().from('tenancies').select('id,conversation_id,tenant_id,landlord_id,property_id')
        .or('tenant_id.eq.' + owner + ',landlord_id.eq.' + owner).eq('status', 'active').order('created_at', {ascending: false}).order('id').limit(100).abortSignal(signal);
      const after = await readSessionUser(client());
      if (signal.aborted || after.error || after.data.user?.id !== owner) throw new Error('Account changed.');
      if (r.error) throw new Error('Tenancy links could not load.');
      return parseActiveTenancyLinks(r.data, owner);
    },
  };
}
export type TenancyLinkService = ReturnType<typeof createTenancyLinkService>;
