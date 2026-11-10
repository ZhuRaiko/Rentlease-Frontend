import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {manualSearchService} from './manualSearchDependencies';
import {createRecommendationService} from '../../property-recommendations/services/recommendationService';
export const recommendationService=createRecommendationService(manualSearchService,getSupabaseClient);
