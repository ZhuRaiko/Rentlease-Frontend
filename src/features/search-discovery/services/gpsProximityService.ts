import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { toSearchNearbyListingsRpcParams, mapSearchNearbyListingsRpcResponse } from '@rentlease/gps-local/rpc';
import type { SearchOptions } from '@rentlease/gps-local';
import { GpsError, gpsErrorMessages } from '../models/GpsProximity';

export function createGpsProximityService(getClient: () => SupabaseClient<Database>) {
  const user = async () => {
    try {
      const { data, error } = await getClient().auth.getUser();
      if (error || !data.user) throw new GpsError('identity', gpsErrorMessages.identity);
      return data.user.id;
    } catch { throw new GpsError('identity', gpsErrorMessages.identity); }
  };
  const assertUser = async (owner: string) => { if (await user() !== owner) throw new GpsError('identity', gpsErrorMessages.identity); };
  return {
    user,
    async search(owner: string, options: SearchOptions, signal = new AbortController().signal) {
      const params = toSearchNearbyListingsRpcParams(options);
      await assertUser(owner);
      try {
        const { data, error } = await getClient().rpc('search_nearby_listings', params).abortSignal(signal);
        await assertUser(owner);
        if (error) {
          const kind = error.code === '42501' ? 'eligibility' : error.code === '28000' || error.code === 'PGRST301' ? 'identity' : 'network';
          throw new GpsError(kind, gpsErrorMessages[kind]);
        }
        try { return mapSearchNearbyListingsRpcResponse(data); }
        catch { throw new GpsError('response', gpsErrorMessages.response); }
      } catch (error) {
        if (error instanceof GpsError) throw error;
        throw new GpsError('network', gpsErrorMessages.network);
      }
    },
  };
}
