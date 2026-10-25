import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createListingLifecycleService } from './listingLifecycleService';
export const listingLifecycleService = createListingLifecycleService(getSupabaseClient, AsyncStorage);
