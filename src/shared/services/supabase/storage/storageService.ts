import { getSupabaseClient } from '../client';

export function getStorageClient() {
  return getSupabaseClient().storage;
}
