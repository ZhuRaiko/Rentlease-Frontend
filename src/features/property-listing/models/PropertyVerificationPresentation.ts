import type {Enums} from '../../../shared/services/supabase/database.types';
import type {LandlordPortfolioItem} from './LandlordPortfolio';
export function propertyVerificationActionLabel(status:Enums<'verification_status'>|'not_submitted'|null){
 return status===null||status==='approved'?null:status==='not_submitted'?'Verify This Property':status==='rejected'?'View Verification Feedback':'View Verification Status';
}
// A review entry point, never a replacement for publish_listing authorization.
export function canReviewPortfolioPublication(item:LandlordPortfolioItem){
 const row=item.currentListing;
 return !item.tier3.requiresRepair&&item.tier3.identityBindingAvailable!==false&&item.tier3.identityBound!==false&&item.property.is_active&&item.tier3.status==='approved'&&row?.status==='draft'&&Number.isFinite(row.completeness_score)&&row.completeness_score>=0.80;
}
