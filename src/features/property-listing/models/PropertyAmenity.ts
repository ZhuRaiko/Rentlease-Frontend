import type {Database} from '../../../shared/services/supabase/database.types';
export type PropertyAmenity=Pick<Database['public']['Tables']['amenities']['Row'],'id'|'name'|'category'|'is_active'>;
export class PropertyAmenityError extends Error { constructor(message:string,public readonly identity=false){super(message);} }
export function togglePropertyAmenity(ids:number[],id:number,catalog:PropertyAmenity[]):number[] {
  if(!catalog.some(item=>item.is_active&&item.id===id))return ids;
  return ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
}
