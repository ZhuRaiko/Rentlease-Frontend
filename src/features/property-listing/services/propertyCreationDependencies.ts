import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { createPropertyCreationService } from './propertyCreationService';
export const propertyCreationService = createPropertyCreationService(getSupabaseClient, AsyncStorage);
