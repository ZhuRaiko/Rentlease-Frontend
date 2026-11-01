import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/services/supabase/database.types';
import { PROPERTY_PHOTO_BUCKET, propertyPhotoObjectPath } from '../../property-listing/models/PropertyPhoto';
import { cityLabels, locationQuery, ManualSearchError, parseSearchListing, record, validateSearchInput, type AvailableLocation, type SearchDetail, type SearchInput, type SearchListing, type SearchPhoto } from '../models/ManualSearch';
import { searchDiagnostic, traceSearchDiagnostic, type SearchDiagnostic } from './searchDiagnostics';

const LISTING_FIELDS = 'id,property_id,title,description,asking_rent_monthly,available_from,published_at,house_rules,rental_term,minimum_stay_months,security_deposit_months,advance_rent_months,status';
const PROPERTY_FIELDS = 'id,landlord_id,city,barangay,property_type,bedrooms,bathrooms,floor_area_sqm,furnishing_status,is_active';
export function searchAvailabilityDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year','month','day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function createManualSearchService(getClient: () => SupabaseClient<Database>, diagnose: (event:SearchDiagnostic)=>void = traceSearchDiagnostic) {
  const user = async () => { const { data,error } = await getClient().auth.getUser(); if (error || !data.user) throw new ManualSearchError('Sign in again to search rentals.',true); return data.user.id; };
  const identity = async (owner: string) => { if (await user() !== owner) throw new ManualSearchError('Your account changed. Start a new search.',true); };
  const photoRows = async (owner: string, listings: SearchListing[], signal?: AbortSignal) => {
    if (!listings.length) return [];
    let query = getClient().from('property_photos').select('id,property_id,storage_path,alt_text,sort_order,is_cover,created_at').in('property_id', [...new Set(listings.map(r => r.propertyId))]).order('is_cover',{ ascending:false }).order('sort_order').order('id').limit(200);
    if (signal) query = query.abortSignal(signal);
    const { data,error } = await query; await identity(owner); if (error || !data) throw new ManualSearchError('Could not load rental photos. Please retry.');
    const photos: { propertyId: string; photo: SearchPhoto }[] = [];
    for (const row of data) {
      const parent = listings.find(r => r.propertyId === row.property_id); if (!parent) continue;
      try { const path = propertyPhotoObjectPath(row.storage_path,parent.ownerId,parent.propertyId,row.id); const url = getClient().storage.from(PROPERTY_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl; photos.push({ propertyId: row.property_id, photo: { id: row.id, url, alt: row.alt_text } }); } catch { /* Invalid path gets a neutral placeholder, never an arbitrary URL. */ }
    }
    return photos;
  };
  const base = (select: string) => getClient().from('listings').select(select).eq('status','active').eq('properties.is_active',true).or(`available_from.is.null,available_from.lte.${searchAvailabilityDate()}`);
  const geographic = <T extends { or(filters: string, options: { referencedTable: string }): T; ilike(column: string, value: string): T }>(query: T, text: string): T => {
    if (!text.trim()) return query;
    const geo = locationQuery(text);
    return geo.city ? query.or(`city.eq.${geo.city},barangay.ilike.${JSON.stringify(geo.pattern)}`,{ referencedTable:'properties' }) : query.ilike('properties.barangay',geo.pattern.replace(/\*/g,'%'));
  };
  return {
    user,
    async search(owner: string, input: SearchInput, signal?: AbortSignal): Promise<SearchListing[]> {
      validateSearchInput(input); await identity(owner);
      const f = input.filters;
      let query = base(`${LISTING_FIELDS},properties!inner(${PROPERTY_FIELDS}${f.amenityIds.length ? ',property_amenities!inner(amenity_id)' : ''})`);
      query = geographic(query,input.query);
      if (f.city) query = query.eq('properties.city',f.city);
      if (f.types.length) query = query.in('properties.property_type',f.types);
      if (f.minRent !== null) query = query.gte('asking_rent_monthly',f.minRent);
      if (f.maxRent !== null) query = query.lte('asking_rent_monthly',f.maxRent);
      if (f.minBeds) query = query.gte('properties.bedrooms',f.minBeds);
      if (f.minBaths) query = query.gte('properties.bathrooms',f.minBaths);
      if (f.minFloorArea !== null) query = query.gte('properties.floor_area_sqm',f.minFloorArea);
      if (f.furnishing) query = query.eq('properties.furnishing_status',f.furnishing);
      if (f.amenityIds.length) query = query.in('properties.property_amenities.amenity_id',f.amenityIds);
      query = query.order(input.sort === 'Recently Listed' ? 'published_at' : 'asking_rent_monthly',{ ascending: input.sort === 'Price: Low to High', nullsFirst:false }).order('id').range(input.offset,input.offset+19);
      if (signal) query = query.abortSignal(signal);
      const { data,error } = await query; await identity(owner); if (error || !data) throw new ManualSearchError();
      const rows = (data as unknown[]).map(parseSearchListing), photos = await photoRows(owner,rows,signal);
      return rows.map(row => ({ ...row, thumbnailUrl: photos.find(p => p.propertyId === row.propertyId)?.photo.url ?? null }));
    },
    async locations(owner: string, text: string, offset: number, signal?: AbortSignal) {
      await identity(owner); let query = geographic(base('id,properties!inner(city,barangay,is_active)'),text).order('id').range(offset,offset+19);
      if (signal) query = query.abortSignal(signal);
      // Debounced searches and screen cleanup intentionally abort superseded reads.
      const assertNotCanceled = () => { if(signal?.aborted) { const error=new Error('Location request canceled.'); error.name='AbortError'; throw error; } };
      let result: Awaited<typeof query>;
      try { result=await query; }
      catch(error) { assertNotCanceled(); diagnose(searchDiagnostic('available_locations',error)); throw new ManualSearchError('Could not load available locations. Please retry.'); }
      assertNotCanceled();
      const { data,error } = result; await identity(owner);
      if (error) {
        diagnose(searchDiagnostic('available_locations', error));
        throw new ManualSearchError('Could not load available locations. Please retry.');
      }
      if (!Array.isArray(data)) {
        diagnose(searchDiagnostic('available_locations', null, 'response'));
        throw new ManualSearchError('Could not read available locations. Please retry.');
      }
      // A successful zero-row query is a genuine empty result, never a retry error.
      if (data.length === 0) return { locations: [], received: 0 };
      const unique = new Map<string,AvailableLocation>();
      for (const item of data as unknown[]) { const p = record(record(item).properties); if (typeof p.city !== 'string' || typeof p.barangay !== 'string') throw new ManualSearchError(); const city = p.city, barangay = p.barangay;
        unique.set(city,{ key:city, city, barangay:'', label:`${cityLabels[city] ?? city}, Cavite`, query:cityLabels[city] ?? city });
        unique.set(`${city}:${barangay}`,{ key:`${city}:${barangay}`,city,barangay,label:`${barangay}, ${cityLabels[city] ?? city}`,query:barangay });
      }
      return { locations:[...unique.values()], received:data.length };
    },
    async catalogue() { const { data,error } = await getClient().from('amenities').select('id,name').eq('is_active',true).order('name').limit(100); if (error || !data) throw new ManualSearchError('Could not load property amenities.'); return data; },
    async detail(owner: string, id: string, signal?: AbortSignal): Promise<SearchDetail> {
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ManualSearchError('Choose a valid listing.');
      await identity(owner); let query = base(`${LISTING_FIELDS},properties!inner(${PROPERTY_FIELDS})`).eq('id',id).limit(1); if (signal) query = query.abortSignal(signal);
      const { data,error } = await query; await identity(owner); if (error || !data?.length) throw new ManualSearchError('This rental is no longer available or could not be loaded.');
      const row = parseSearchListing(data[0]), photos = await photoRows(owner,[row],signal);
      let amenityQuery = getClient().from('property_amenities').select('amenity:amenities(name)').eq('property_id',row.propertyId).limit(100); if (signal) amenityQuery = amenityQuery.abortSignal(signal);
      const { data: amenities,error: amenityError } = await amenityQuery; await identity(owner); if (amenityError || !amenities) throw new ManualSearchError('Could not load rental amenities. Please retry.');
      const names = amenities.flatMap(item => item.amenity ? [item.amenity.name] : []);
      return { ...row,thumbnailUrl:photos[0]?.photo.url ?? null,photos:photos.map(p => p.photo),amenities:names };
    },
  };
}
export type ManualSearchService = ReturnType<typeof createManualSearchService>;
