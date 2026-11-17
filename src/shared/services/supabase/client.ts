import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env, requireEnvironmentValue } from '../../../config/env';
import type { Database } from './database.types';
import { traceAuthBoot } from '../../utils/authBootTrace';
import { instrumentMutations } from '../../utils/accountCache';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(
      requireEnvironmentValue(env.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
      requireEnvironmentValue(env.supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      },
    );
    // Every write the app sends empties the in-memory screen caches (My properties, Tenancy tab, Messages) so a stale list is never shown after it.
    instrumentMutations(client as unknown as Parameters<typeof instrumentMutations>[0]);
    traceAuthBoot('SUPABASE_CLIENT_CREATED', { appState: AppState.currentState });

    const currentClient = client;

    AppState.addEventListener('change', (state) => {
      traceAuthBoot('APP_STATE', { appState: state });
      if (state === 'active') currentClient.auth.startAutoRefresh();
      else currentClient.auth.stopAutoRefresh();
    });
  }

  return client;
}
