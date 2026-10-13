import type { AppError } from '../shared/errors/AppError';

export interface PublicEnvironment {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  mapTilerApiKey: string | undefined;
  fastApiBaseUrl: string | undefined;
}

export const env: PublicEnvironment = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  mapTilerApiKey: process.env.EXPO_PUBLIC_MAPTILER_API_KEY,
  fastApiBaseUrl: process.env.EXPO_PUBLIC_FASTAPI_BASE_URL,
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.supabaseUrl?.startsWith('https://') &&
      !env.supabaseUrl.includes('your-project-id') &&
      env.supabaseAnonKey &&
      !env.supabaseAnonKey.startsWith('replace-with-'),
  );
}

export function requireEnvironmentValue(
  value: string | undefined,
  variableName: keyof NodeJS.ProcessEnv,
): string {
  if (value) return value;
  const error: AppError = {
    code: 'configuration',
    message: `Missing required environment variable: ${variableName}`,
  };
  throw error;
}
