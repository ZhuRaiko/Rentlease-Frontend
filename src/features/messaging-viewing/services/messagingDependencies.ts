import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createMessagingService} from './messagingService';
export const messagingService=createMessagingService(getSupabaseClient);
export const messageId=randomUUID;
export const messagingForeground=()=>AppState.currentState==='active';
