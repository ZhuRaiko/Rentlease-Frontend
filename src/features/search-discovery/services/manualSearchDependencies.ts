import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createManualSearchService } from './manualSearchService';
export const manualSearchService = createManualSearchService(getSupabaseClient);
