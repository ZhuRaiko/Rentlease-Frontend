import { geocodeAddress } from '../../../shared/services/maps/geocoding/geocodingService';
import { getMapTilerStyleUrl } from '../../../shared/services/maps/mapTiler/mapTilerConfig';
import { createPropertyLocationService } from './propertyLocationService';
export const propertyLocationService = createPropertyLocationService(geocodeAddress, getMapTilerStyleUrl);
