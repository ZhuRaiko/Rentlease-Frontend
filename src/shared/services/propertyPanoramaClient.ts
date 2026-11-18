import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';

/**
 * THE ONE TYPED BOUNDARY for the room tour backend objects (table property_panoramas, RPCs set_property_panorama and remove_property_panorama).
 * The migration 20261119100000_property_panoramas.sql is applied, but the generated database.types.ts does not know these objects yet.
 * TODO(after apply): regenerate database.types.ts, delete this file and use the generated types directly in publicPropertyPanoramas.ts and propertyPanoramaService.ts.
 */
export interface PanoramaRpcError { code?: string; message?: string }
export interface PanoramaRpcResult { data: unknown; error: PanoramaRpcError | null }
export interface PanoramaTableQuery { select(columns: string): PanoramaTableQuery; eq(column: string, value: string): PanoramaTableQuery; limit(count: number): PanoramaTableQuery; abortSignal(signal: AbortSignal): PanoramaTableQuery; then: PromiseLike<PanoramaRpcResult>['then'] }
export interface PanoramaClient {
  from(table: 'property_panoramas'): PanoramaTableQuery;
  rpc(name: 'set_property_panorama', args: { p_property_id: string; p_side: string; p_storage_path: string; p_width: number; p_height: number }): PromiseLike<PanoramaRpcResult>;
  rpc(name: 'remove_property_panorama', args: { p_property_id: string; p_side: string }): PromiseLike<PanoramaRpcResult>;
  storage: SupabaseClient<Database>['storage'];
}
/** The single cast. Everything else in the room tour code is typed against PanoramaClient. */
export const panoramaClient = (client: SupabaseClient<Database>): PanoramaClient => client as unknown as PanoramaClient;
