import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { requestCurrentLocation, openLocationSettings } from '../../../shared/services/location/deviceLocation';
import { createGpsProximityService } from './gpsProximityService';
export const gpsProximityDependencies = {
  ...createGpsProximityService(getSupabaseClient),
  locate: requestCurrentLocation,
  settings: openLocationSettings,
};
