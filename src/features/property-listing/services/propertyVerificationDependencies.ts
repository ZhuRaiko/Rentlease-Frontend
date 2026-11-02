import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTierThreeVerificationService} from '../../user-verification/services/tierThreeVerificationService';
// Publication/ordinary entry reflects canonical identity, not a pending proposal.
const service=createTierThreeVerificationService(getSupabaseClient);
export const propertyVerificationService={getEligibleUserId:service.getEligibleUserId,fetchLatest:service.fetchCurrent};
