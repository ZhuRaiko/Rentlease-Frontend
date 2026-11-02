import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createPropertyIdentityService} from './propertyIdentityService';
export const propertyIdentityService=createPropertyIdentityService(getSupabaseClient,AsyncStorage,randomUUID);
