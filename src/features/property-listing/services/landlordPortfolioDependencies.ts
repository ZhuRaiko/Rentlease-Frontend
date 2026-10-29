import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createLandlordPortfolioService } from './landlordPortfolioService';
export const landlordPortfolioService = createLandlordPortfolioService(getSupabaseClient);
