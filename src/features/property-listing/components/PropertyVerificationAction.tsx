import {Text} from 'react-native';
import {FeedbackNotice} from '../../../shared/components/FeedbackNotice';
import {ui} from '../../../shared/theme/ui';
import {ListingButton} from './ListingButton';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PropertyVerificationAction({viewModel:vm}:{viewModel:PropertyListingViewModel}){
 const state=vm.propertyVerificationState;if(!vm.workspacePropertyId||!state||state.propertyId!==vm.workspacePropertyId)return null;
 return <>
  {state.busy?<Text accessibilityLiveRegion="polite" style={ui.supporting}>Checking property verification...</Text>:null}
  {state.error?<><FeedbackNotice tone="error" message={state.error}/><ListingButton label="Check property verification" tone="outline" disabled={state.busy} onPress={()=>void vm.propertyVerification.refresh()}/></>:null}
  {state.loaded&&!state.error&&state.status==='approved'?<Text accessibilityLiveRegion="polite" style={ui.supporting}>Property ownership verified. Publication still requires your confirmation.</Text>:null}
  {state.loaded&&!state.error&&state.actionLabel?<>
   <Text style={ui.supporting}>Property-specific Tier 3 verification is required to publish, not to save a draft.</Text>
   <ListingButton label={state.actionLabel} tone="outline" disabled={state.busy||state.opening||vm.publicationReviewDisabled} onPress={vm.openPropertyVerification}/>
  </>:null}
 </>;
}
