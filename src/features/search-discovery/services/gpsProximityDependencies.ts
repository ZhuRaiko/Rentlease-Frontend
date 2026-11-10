import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { requestCurrentLocation, openLocationSettings } from '../../../shared/services/location/deviceLocation';
import { createGpsProximityService } from './gpsProximityService';
import { manualSearchService } from './manualSearchDependencies';
import {getMapTilerStyleUrl} from '../../../shared/services/maps/mapTiler/mapTilerConfig';
export const gpsProximityDependencies = {
  mapStyle:getMapTilerStyleUrl,
  ...createGpsProximityService(getSupabaseClient),
  thumbnails: manualSearchService.nearbyThumbnails,
  locate: requestCurrentLocation,
  settings: openLocationSettings,
};
