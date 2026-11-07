import {useEffect,useState,type ReactNode} from 'react';
import {Alert,StyleSheet,View} from 'react-native';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import {RentLeaseBottomNavigation} from '../../../shared/components/RentLeaseBottomNavigation';
import type {MessagingActor} from '../models/MessagingViewing';
import {useMessagingViewingViewModel} from '../viewModels/useMessagingViewingViewModel';
import {MessagingInboxView} from './MessagingInboxView';
import {MessagingConversationView} from './MessagingConversationView';
import {PropertyViewingsView} from './PropertyViewingsView';
import {usePropertyViewingsViewModel} from '../viewModels/usePropertyViewingsViewModel';
import type {Conversation} from '../models/PersistentMessaging';
import {RentalReservationsView} from './RentalReservationsView';
import {useRentalReservationsViewModel} from '../viewModels/useRentalReservationsViewModel';
function ReservationsWorkspace({accountId,conversation,onBack,registerBackAction}:{accountId:string|undefined;conversation:Conversation|null;onBack:()=>void;registerBackAction:Props['registerBackAction']}){
 const vm=useRentalReservationsViewModel(accountId,conversation);
 const back=()=>{if(vm.saving)return;if(vm.uncertain){Alert.alert('Reservation outcome not confirmed','Retry the same request to confirm its outcome, or leave and refresh reservations before requesting again.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave reservations',onPress:onBack}]);return;}if(vm.editor){vm.workflow.closeEditor();void vm.workflow.load();}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <RentalReservationsView viewModel={vm} onBack={back}/>;
}
function ViewingsWorkspace({accountId,conversation,onBack,registerBackAction}:{accountId:string|undefined;conversation:Conversation|null;onBack:()=>void;registerBackAction:Props['registerBackAction']}){
 const vm=usePropertyViewingsViewModel(accountId,conversation);
 const back=()=>{if(vm.saving)return;if(vm.uncertain){Alert.alert('Viewing outcome not confirmed','Retry the same request to confirm its outcome, or leave and refresh appointments before making another request.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave viewings',onPress:onBack}]);return;}if(vm.editor){vm.workflow.closeEditor();void vm.workflow.load();}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <PropertyViewingsView viewModel={vm} onBack={back}/>;
}
interface Props {actor?:MessagingActor;accountId?:string|undefined;conversationId?:string|undefined;initialScreen?:'inbox'|'newInquiry';canPostProperty:boolean;onClose:()=>void;onRootBack:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined;onCreateListing:()=>void;onOpenDiscover:()=>void;onOpenListings:()=>void;onOpenMaintenance:()=>void;returnToListing?:boolean;renderListingDetails?:((id:string,onBack:()=>void)=>ReactNode)|undefined}
export function MessagingViewingFlowView({accountId,conversationId,canPostProperty,onClose,onRootBack,registerBackAction,onCreateListing,onOpenDiscover,onOpenListings,onOpenMaintenance,returnToListing=false,renderListingDetails}:Props){
 const [listing,setListing]=useState<{owner:string|undefined;id:string}|null>(null);
 const activeListing=listing?.owner===accountId?listing:null;
 const viewModel=useMessagingViewingViewModel(accountId,conversationId);
 const [panel,setPanel]=useState<{kind:'viewings'|'reservations';accountId:string|undefined;conversation:Conversation|null}|null>(null);
 useEffect(()=>{setPanel(null);setListing(null);},[accountId]);
 const activePanel=panel?.accountId===accountId?panel:null;
 const openViewings=()=>setPanel({kind:'viewings',accountId,conversation:viewModel.conversation});
 const openReservations=()=>setPanel({kind:'reservations',accountId,conversation:viewModel.conversation});
 const back=()=>{if(activeListing){setListing(null);return;}if(returnToListing)onRootBack();else viewModel.backFromWorkspace(onRootBack);};
 useEffect(()=>{if(activePanel)return;registerBackAction?.(back);return()=>registerBackAction?.(null);});
 const closePanel=()=>{setPanel(null);viewModel.refresh();};
 return <ScreenContainer padded={false} includeBottomInset={!!activePanel||!!activeListing}><View style={styles.content}>{activePanel?.kind==='viewings'?<ViewingsWorkspace key={`${accountId}-${activePanel.conversation?.id??'all'}`} accountId={accountId} conversation={activePanel.conversation} onBack={closePanel} registerBackAction={registerBackAction}/>:activePanel?.kind==='reservations'?<ReservationsWorkspace key={`${accountId}-${activePanel.conversation?.id??'all'}`} accountId={accountId} conversation={activePanel.conversation} onBack={closePanel} registerBackAction={registerBackAction}/>:viewModel.screen==='inbox'?<MessagingInboxView viewModel={viewModel} onViewings={openViewings} onReservations={openReservations} onClose={returnToListing?onRootBack:onClose}/>:<MessagingConversationView viewModel={viewModel} onViewings={openViewings} onReservations={openReservations} onBack={back} {...(renderListingDetails?{onViewListing:(id:string)=>setListing({owner:accountId,id})}:{})}/>}{activeListing&&renderListingDetails?<View style={styles.overlay}>{renderListingDetails(activeListing.id,()=>setListing(null))}</View>:null}</View>
 {!activePanel&&!activeListing?<RentLeaseBottomNavigation active="chat" onChat={viewModel.openInbox} onDiscover={onOpenDiscover} onListing={()=>{if(canPostProperty)onOpenListings();}} onPost={()=>{if(canPostProperty)onCreateListing();}} onTenancy={onOpenMaintenance}/>:null}</ScreenContainer>;
}
const styles=StyleSheet.create({content:{flex:1},overlay:{position:'absolute',top:0,right:0,bottom:0,left:0}});
