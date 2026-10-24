import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createListingDraftService } from './listingDraftService';
export const listingDraftService = createListingDraftService(getSupabaseClient, AsyncStorage);
