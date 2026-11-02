import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createPropertyRoutineService} from './propertyRoutineService';
export const propertyRoutineService=createPropertyRoutineService(getSupabaseClient,AsyncStorage,randomUUID);
