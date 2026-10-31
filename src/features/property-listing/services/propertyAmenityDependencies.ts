import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createPropertyAmenityService} from './propertyAmenityService';
export const propertyAmenityService=createPropertyAmenityService(getSupabaseClient);
