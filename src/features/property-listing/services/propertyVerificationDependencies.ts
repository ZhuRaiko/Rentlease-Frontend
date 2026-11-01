import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTierThreeVerificationService} from '../../user-verification/services/tierThreeVerificationService';
// Reuse the verification feature's ownership and authorization reads; no new contract.
export const propertyVerificationService=createTierThreeVerificationService(getSupabaseClient);
