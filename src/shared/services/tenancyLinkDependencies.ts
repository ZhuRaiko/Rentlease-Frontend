import {getSupabaseClient} from './supabase/client';
import {createTenancyLinkService} from './tenancyLinkService';

export const tenancyLinkService = createTenancyLinkService(getSupabaseClient);
