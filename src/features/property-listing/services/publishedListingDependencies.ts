import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createPublishedListingService} from './publishedListingService';
export const publishedListingService=createPublishedListingService(getSupabaseClient,AsyncStorage);
