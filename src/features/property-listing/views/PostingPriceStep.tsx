import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {InlineRentalEstimate} from '../../../shared/components/InlineRentalEstimate';
import {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';
import {PostingLocationApproval} from '../components/PostingLocationApproval';
import {PostingEstimateView} from './PostingEstimateView';
import {listingNumber} from '../models/PersistedListingDraft';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';

/**
 * Wires the Price step: the existing estimate widget (remounted when the location permission changes, as before), the location
 * permission switch and the inline floor-area fix. Holds only UI state; every save goes through the ViewModel.
 */
export function PostingPriceStep({viewModel:vm,accountId,onClose}:{viewModel:PropertyListingViewModel;accountId:string|undefined;onClose:()=>void}){
  const propertyId=vm.workspacePropertyId,saving=!!vm.composerPhase||vm.listingDraftState.busy;
  const approval=useRentalLocationApproval(accountId,propertyId??undefined,vm.estimationProperty?.edit_version);
  const [area,setArea]=useState(''),[fixing,setFixing]=useState(false),[autoEstimate,setAutoEstimate]=useState(false);
  useEffect(()=>{if(autoEstimate&&vm.postingEstimate)setAutoEstimate(false);},[autoEstimate,vm.postingEstimate]);
  const fixNeeded=vm.floorAreaMissing&&vm.propertyEditAvailable!==false;
  const fix=fixNeeded?{value:area,onChange:setArea,saving:fixing,error:vm.propertyRoutineState.error,onSave:()=>{setFixing(true);void vm.savePostingFloorArea(area).then(ok=>{setFixing(false);if(ok){setArea('');setAutoEstimate(true);}});}}:null;
  const estimate=propertyId?<InlineRentalEstimate key={`${approval.state?.revision}:${approval.state?.approved}:${approval.ready}`} accountId={accountId} target={{propertyId}} property={vm.estimationProperty} variant="posting" disabled={vm.listingDraftReadOnly||saving} autoPredict={autoEstimate} onResult={vm.setPostingEstimate} onUseRent={vm.applyRentFromRange} askingRent={listingNumber(vm.draft.askingRent)}/>:<Text>Save your property details before requesting an estimate.</Text>;
  return <PostingEstimateView viewModel={vm} onClose={onClose} estimateSection={estimate} floorAreaFix={fix} locationSection={propertyId?<PostingLocationApproval model={approval} disabled={vm.listingDraftReadOnly||saving}/>:null}/>;
}
