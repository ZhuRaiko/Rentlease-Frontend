import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Text,type ScrollView,type View} from 'react-native';
import {InlineRentalEstimate} from '../../../shared/components/InlineRentalEstimate';
import {useRentalLocationApproval} from '../../../shared/viewModels/useRentalLocationApproval';
import {PostingLocationApproval} from '../components/PostingLocationApproval';
import {PostingEstimateView} from './PostingEstimateView';
import {listingNumber} from '../models/PersistedListingDraft';
import {APPLIED_FLASH_MS,appliedAfterFieldChange,appliedAnnouncement,appliedFlashVisible,rentCardScrollTarget} from '../models/PostingPrice';
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
  // "Use" feedback: the rent that was applied, a short flash on the rent card, a scroll that brings the card into view, and a spoken line.
  const scrollRef=useRef<ScrollView|null>(null),contentRef=useRef<View|null>(null),cardRef=useRef<View|null>(null);
  const [applied,setApplied]=useState<number|null>(null),[flashOn,setFlashOn]=useState(false),[flashTick,setFlashTick]=useState(0);
  useEffect(()=>{setApplied(a=>appliedAfterFieldChange(a,vm.draft.askingRent));},[vm.draft.askingRent]);
  useEffect(()=>{if(!flashTick)return;const id=setTimeout(()=>setFlashOn(false),APPLIED_FLASH_MS);return()=>clearTimeout(id);},[flashTick]);
  /** Scrolls only; never focuses the field, so the keyboard stays closed. */
  const revealRentCard=()=>{
    const card=cardRef.current,content=contentRef.current,scroll=scrollRef.current,viewport=scroll?.getNativeScrollRef();if(!card||!content||!scroll||!viewport)return;
    viewport.measureInWindow((_x:number,viewTop:number,_w:number,viewHeight:number)=>card.measureInWindow((_cx,cardTop,_cw,cardHeight)=>card.measureLayout(content,(_lx,contentY)=>{
      const target=rentCardScrollTarget({cardTop,cardHeight,viewTop,viewHeight,contentY,margin:16});if(target!==null)scroll.scrollTo({y:target,animated:true});
    },()=>{})));
  };
  const useRent=(rent:number)=>{
    if(!vm.applyRentFromRange(rent))return;
    const value=Math.round(rent);setApplied(value);setFlashOn(true);setFlashTick(n=>n+1);revealRentCard();AccessibilityInfo.announceForAccessibility(appliedAnnouncement(value));
  };
  const fixNeeded=vm.floorAreaMissing&&vm.propertyEditAvailable!==false;
  const fix=fixNeeded?{value:area,onChange:setArea,saving:fixing,error:vm.propertyRoutineState.error,onSave:()=>{setFixing(true);void vm.savePostingFloorArea(area).then(ok=>{setFixing(false);if(ok){setArea('');setAutoEstimate(true);}});}}:null;
  const estimate=propertyId?<InlineRentalEstimate key={`${approval.state?.revision}:${approval.state?.approved}:${approval.ready}`} accountId={accountId} target={{propertyId}} property={vm.estimationProperty} variant="posting" disabled={vm.listingDraftReadOnly||saving} autoPredict={autoEstimate} onResult={vm.setPostingEstimate} onUseRent={useRent} appliedRent={applied} askingRent={listingNumber(vm.draft.askingRent)}/>:<Text>Save your property details before requesting an estimate.</Text>;
  return <PostingEstimateView viewModel={vm} onClose={onClose} estimateSection={estimate} floorAreaFix={fix} rentFeedback={{applied:appliedFlashVisible(applied,flashOn,vm.draft.askingRent),cardRef,scrollRef,contentRef}} locationSection={propertyId?<PostingLocationApproval model={approval} disabled={vm.listingDraftReadOnly||saving}/>:null}/>;
}
