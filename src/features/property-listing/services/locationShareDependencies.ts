import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createRentalLocationApprovalService} from '../../../shared/services/rentalLocationApprovalService';
/** The existing rental-location approval service, unchanged: get_rental_location_approval and set_rental_location_approval. */
export const locationShareService=createRentalLocationApprovalService(getSupabaseClient);
/** The signed-in account, for the actor check the approval service makes on every call. */
export const currentActorId=async():Promise<string|null>=>{const {data,error}=await getSupabaseClient().auth.getUser();return error?null:data.user?.id??null;};
