import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { assemblePortfolio, PortfolioError } from '../models/LandlordPortfolio';
import { PROPERTY_PHOTO_BUCKET, orderedPropertyPhotos, propertyPhotoObjectPath } from '../models/PropertyPhoto';
export function createLandlordPortfolioService(getClient: () => SupabaseClient<Database>) {
  const user = async () => {
    const { data, error } = await getClient().auth.getUser();
    if (error || !data.user) throw new PortfolioError('Sign in again to see your properties.', true);
    return data.user.id;
  };
  const assertUser = async (id: string) => { if (await user() !== id) throw new PortfolioError('Your account changed. Reload My Listings.', true); };
  return {
    user, assertUser,
    async load(ownerId: string) {
      await assertUser(ownerId); const client = getClient();
      const readAll = async <T>(read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
        const rows: T[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = await read(offset); await assertUser(ownerId);
          if (page.error || !page.data) throw new PortfolioError('Could not load your properties. Check your connection and try again.');
          rows.push(...page.data);
          if (page.data.length < 200) return { data: rows, error: null };
        }
      };
      const [properties, listings, verifications] = await Promise.all([
        readAll(offset => client.from('properties').select('id,landlord_id,property_type,city,barangay,bedrooms,bathrooms,floor_area_sqm,floor_number,total_floors,max_occupants,furnishing_status,is_active,created_at,updated_at').eq('landlord_id', ownerId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 199)),
        readAll(offset => client.from('listings').select('id,property_id,landlord_id,title,description,house_rules,rental_term,asking_rent_monthly,security_deposit_months,advance_rent_months,minimum_stay_months,available_from,status,completeness_score,created_at,updated_at,archived_at,paused_at,published_at,removed_at,removal_reason').eq('landlord_id', ownerId).order('id', { ascending: false }).range(offset, offset + 199)),
        readAll(offset => client.from('verification_submissions').select('id,user_id,property_id,tier,status,submitted_at,updated_at').eq('user_id', ownerId).eq('tier', 'tier_3_property').order('id', { ascending: false }).range(offset, offset + 199)),
      ]);
      await assertUser(ownerId);
      if (properties.error || listings.error || verifications.error || !properties.data || !listings.data || !verifications.data) throw new PortfolioError('Could not load your properties. Check your connection and try again.');
      if (properties.data.some(p => p.landlord_id !== ownerId) || listings.data.some(l => l.landlord_id !== ownerId) || verifications.data.some(v => v.user_id !== ownerId || v.tier !== 'tier_3_property')) throw new PortfolioError('Property ownership could not be confirmed.', true);
      const ids = properties.data.map(p => p.id), covers = new Map<string, { id: string; publicUrl: string }>();
      // Only owner-confirmed property IDs enter the photo query. No private location is read.
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await client.from('property_photos').select('id,property_id,storage_path,alt_text,sort_order,is_cover,created_at').in('property_id', ids.slice(offset, offset + 100)).eq('is_cover', true);
        await assertUser(ownerId);
        if (error || !data) throw new PortfolioError('Could not load property covers. Try refreshing My Listings.');
        for (const photo of orderedPropertyPhotos(data)) {
          if (!ids.includes(photo.property_id)) throw new PortfolioError('Photo ownership could not be confirmed.', true);
          if (covers.has(photo.property_id)) continue;
          try {
            const path = propertyPhotoObjectPath(photo.storage_path, ownerId, photo.property_id, photo.id);
            covers.set(photo.property_id, { id: photo.id, publicUrl: client.storage.from(PROPERTY_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl });
          } catch { /* An invalid cover path falls back to a property placeholder, never an unsafe URL. */ }
        }
      }
      await assertUser(ownerId);
      return assemblePortfolio(properties.data, listings.data, verifications.data, covers);
    },
  };
}
export type LandlordPortfolioService = ReturnType<typeof createLandlordPortfolioService>;
