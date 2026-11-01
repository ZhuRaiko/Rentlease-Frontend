import {measureHydration} from './draftHydrationDiagnostics';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {PropertyAmenityError,type PropertyAmenity} from '../models/PropertyAmenity';
export function createPropertyAmenityService(getClient:()=>SupabaseClient<Database>) {
  const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user)throw new PropertyAmenityError('Sign in to load property amenities.',true);return data.user.id;};
  const assertUser=async(id:string)=>{if(await user()!==id)throw new PropertyAmenityError('Your account changed. Reopen the property.',true);};
  return {assertUser,async load(propertyId:string|null){
    const id=await user(),client=getClient();
    if(propertyId){const {data,error}=await client.from('properties').select('id,landlord_id').eq('id',propertyId).eq('landlord_id',id).maybeSingle();if(error)throw new PropertyAmenityError('Could not check property access. Retry loading amenities.');if(!data||data.landlord_id!==id)throw new PropertyAmenityError('This property is no longer available to your account.',true);}
    // Owner validation precedes these independent authorized reads; no shared identity cache.
    const [catalogResult,selected,location]=await measureHydration('amenities',()=>Promise.all([
      client.from('amenities').select('id,name,category,is_active').eq('is_active',true).order('category').order('name'),
      propertyId?client.from('property_amenities').select('amenity_id').eq('property_id',propertyId):Promise.resolve({data:[],error:null}),
      propertyId?client.from('property_private_locations').select('property_id').eq('property_id',propertyId).limit(1).maybeSingle():Promise.resolve({data:null,error:null}),
    ]));
    if(catalogResult.error)throw new PropertyAmenityError('Amenities could not load. Check your connection and retry.');
    if(selected.error)throw new PropertyAmenityError('Saved amenities could not load. Retry to check them.');
    if(location.error)throw new PropertyAmenityError('Saved property details could not be checked. Retry loading.');
    const catalog=(catalogResult.data??[]).filter((item):item is PropertyAmenity=>item.is_active&&Number.isSafeInteger(item.id)&&item.id>0&&!!item.name.trim());
    const selectedIds=[...new Set((selected.data??[]).map(item=>item.amenity_id))],hasPrivateLocation=!!location.data;
    await assertUser(id);return {userId:id,catalog,selectedIds,hasPrivateLocation};
  }};
}
export type PropertyAmenityService=ReturnType<typeof createPropertyAmenityService>;
