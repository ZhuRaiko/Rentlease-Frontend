import {getSupabaseClient} from './supabase/client';
import {createReviewsOverviewService} from './reviewsOverviewService';

export const reviewsOverviewService = createReviewsOverviewService(getSupabaseClient);
