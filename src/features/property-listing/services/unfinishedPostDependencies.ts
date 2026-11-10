import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createUnfinishedPostService} from './unfinishedPostService';
export const unfinishedPostService=createUnfinishedPostService(getSupabaseClient,AsyncStorage);
