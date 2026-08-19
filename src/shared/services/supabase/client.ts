import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, requireEnvironmentValue } from '../../../config/env';

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      requireEnvironmentValue(env.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
      requireEnvironmentValue(env.supabaseAnonKey, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    );
  }
  return client;
}
