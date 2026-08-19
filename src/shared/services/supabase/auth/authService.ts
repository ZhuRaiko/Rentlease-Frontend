import { getSupabaseClient } from '../client';

export async function getCurrentSession() {
  return getSupabaseClient().auth.getSession();
}

export async function signOut() {
  return getSupabaseClient().auth.signOut();
}
