import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createListingPublicationService } from './listingPublicationService';
export const listingPublicationService = createListingPublicationService(getSupabaseClient, AsyncStorage);
