import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { toSearchNearbyListingsRpcParams, mapSearchNearbyListingsRpcResponse } from '@rentlease/gps-local/rpc';
import type { SearchOptions } from '@rentlease/gps-local';
import { GpsError, gpsErrorMessages } from '../models/GpsProximity';
import { searchDiagnostic, traceSearchDiagnostic, type SearchDiagnostic } from './searchDiagnostics';

export function createGpsProximityService(getClient: () => SupabaseClient<Database>, diagnose: (event: SearchDiagnostic) => void = traceSearchDiagnostic) {
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
          const event = searchDiagnostic('gps_rpc', error);
          diagnose(event);
          if(error.code==='22023')throw new GpsError('parameters',error.message==='Radius must be 1, 3, or 5 km'?'This distance needs the nearby-search server update. For now, choose 1, 3, or 5 km.':gpsErrorMessages.parameters);
          const kind = event.classification === 'eligibility' || event.classification === 'backend_permission' || event.classification === 'identity' ? event.classification : 'network';
          throw new GpsError(kind, gpsErrorMessages[kind]);
        }
        try { return mapSearchNearbyListingsRpcResponse(data); }
        catch { throw new GpsError('response', gpsErrorMessages.response); }
      } catch (error) {
        if (error instanceof GpsError) throw error;
        diagnose(searchDiagnostic('gps_rpc', error));
        throw new GpsError('network', gpsErrorMessages.network);
      }
    },
  };
}
