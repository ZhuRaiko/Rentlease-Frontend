import { readSessionUser } from '../../../shared/services/supabase/sessionUser';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import type {RentalRelationship} from '../models/TenancyWorkspace';

/** Same column list the tenancy workspace reads, so a card and its details can never disagree on a field. */
const COLUMNS='id,property_id,listing_id,conversation_id,tenant_id,landlord_id,status,start_date,expected_end_date,actual_end_date,agreed_monthly_rent,rent_due_day,tenant_confirmed_at,landlord_confirmed_at';
/** Open means a rental that is running or still being set up; ended and cancelled rentals are history. */
export const OPEN_STATUSES=['active','proposed','pending_confirmation'] as const;
/** Bounded read: the most recent rentals only. */
export const LANDLORD_TENANCY_LIMIT=200;

export class LandlordTenanciesError extends Error{constructor(message:string,readonly identity=false){super(message);}}

/**
 * The landlord's own open tenancies, read-only. RLS limits rows to participants; the service also asserts the signed-in user is the one
 * asked for and that every row names that user as landlord, so a different account's rows are never returned.
 */
export function createLandlordTenanciesService(client:()=>SupabaseClient<Database>){
  const identity=async(actor:string,signal:AbortSignal)=>{
    const {data,error}=await readSessionUser(client());
    if(error||data.user?.id!==actor||signal.aborted)throw new LandlordTenanciesError('Your account changed. Reload My properties.',true);
  };
  return {
    async open(actor:string,signal:AbortSignal):Promise<RentalRelationship[]>{
      await identity(actor,signal);
      const {data,error}=await client().from('tenancies').select(COLUMNS).eq('landlord_id',actor).in('status',[...OPEN_STATUSES]).order('created_at',{ascending:false}).range(0,LANDLORD_TENANCY_LIMIT-1).abortSignal(signal);
      if(error||!data)throw new LandlordTenanciesError('Tenancies could not load.');
      await identity(actor,signal);
      if(data.some(t=>t.landlord_id!==actor))throw new LandlordTenanciesError('Rental access could not be verified.',true);
      return data as RentalRelationship[];
    },
  };
}
export type LandlordTenanciesService=ReturnType<typeof createLandlordTenanciesService>;
