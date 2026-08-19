import { env, requireEnvironmentValue } from '../../../config/env';

export async function requestPriceEstimate<TRequest extends object, TResponse>(
  endpoint: string,
  payload: TRequest,
): Promise<TResponse> {
  const baseUrl = requireEnvironmentValue(env.fastApiBaseUrl, 'EXPO_PUBLIC_FASTAPI_BASE_URL');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Price estimation request failed (${response.status}).`);
  return response.json() as Promise<TResponse>;
}
