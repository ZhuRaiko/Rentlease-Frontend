import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import { PROPERTY_PANORAMA_BUCKET, isPanoramaSide, propertyPanoramaObjectPath, type PublicPropertyPanorama } from '../models/PropertyPanorama';
import { panoramaClient } from './propertyPanoramaClient';
export type { PublicPropertyPanorama } from '../models/PropertyPanorama';
export interface PanoramaParent { propertyId: string; ownerId: string }

/**
 * One bounded, RLS-protected read of a property's room tour (at most two rows, one per side). Row access is decided by the backend (can_view_property);
 * this never signs private or arbitrary paths: every stored path is confirmed against the owner and property first, and an unconfirmed row is skipped.
 * Returns the sides in Front, Back order. A failed read throws; callers that treat the tour as optional catch it.
 */
export async function readPublicPropertyPanoramas(client: SupabaseClient<Database>, parent: PanoramaParent, signal?: AbortSignal): Promise<PublicPropertyPanorama[]> {
  const typed = panoramaClient(client);
  let query = typed.from('property_panoramas').select('side,storage_path,width,height,updated_at').eq('property_id', parent.propertyId).limit(2);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new Error('Could not load the room tour.');
  const found: PublicPropertyPanorama[] = [];
  for (const row of data as Record<string, unknown>[]) {
    if (!row || !isPanoramaSide(row.side) || found.some(p => p.side === row.side)) continue;
    const { width, height } = row;
    if (typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) continue;
    try {
      const path = propertyPanoramaObjectPath(row.storage_path, parent.ownerId, parent.propertyId);
      found.push({ side: row.side, url: typed.storage.from(PROPERTY_PANORAMA_BUCKET).getPublicUrl(path).data.publicUrl, width, height });
    } catch { /* Invalid or foreign path: the side is treated as absent. */ }
  }
  return found.sort((a, b) => (a.side === 'front' ? 0 : 1) - (b.side === 'front' ? 0 : 1));
}
