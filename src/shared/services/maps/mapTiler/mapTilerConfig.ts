import { env, requireEnvironmentValue } from '../../../../config/env';

export function getMapTilerStyleUrl(style = 'streets-v2'): string {
  const key = requireEnvironmentValue(env.mapTilerApiKey, 'EXPO_PUBLIC_MAPTILER_API_KEY');
  return `https://api.maptiler.com/maps/${encodeURIComponent(style)}/style.json?key=${encodeURIComponent(key)}`;
}
