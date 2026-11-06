import {useEffect,useState} from 'react';
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
function ViewingsWorkspace({accountId,conversation,onBack,registerBackAction}:{accountId:string|undefined;conversation:Conversation|null;onBack:()=>void;registerBackAction:Props['registerBackAction']}){
 const vm=usePropertyViewingsViewModel(accountId,conversation);
 const back=()=>{if(vm.saving)return;if(vm.uncertain){Alert.alert('Viewing outcome not confirmed','Retry the same request to confirm its outcome, or leave and refresh appointments before making another request.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave viewings',onPress:onBack}]);return;}if(vm.editor){vm.workflow.closeEditor();void vm.workflow.load();}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <PropertyViewingsView viewModel={vm} onBack={back}/>;
}
interface Props {actor?:MessagingActor;accountId?:string|undefined;conversationId?:string|undefined;initialScreen?:'inbox'|'newInquiry';canPostProperty:boolean;onClose:()=>void;onRootBack:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined;onCreateListing:()=>void;onOpenDiscover:()=>void;onOpenListings:()=>void;onOpenMaintenance:()=>void;returnToListing?:boolean}
export function MessagingViewingFlowView({accountId,conversationId,canPostProperty,onClose,onRootBack,registerBackAction,onCreateListing,onOpenDiscover,onOpenListings,onOpenMaintenance,returnToListing=false}:Props){
 const viewModel=useMessagingViewingViewModel(accountId,conversationId);
 const [viewings,setViewings]=useState<{accountId:string|undefined;conversation:Conversation|null}|null>(null);
 useEffect(()=>{setViewings(null);},[accountId]);
 const showingViewings=viewings!==null&&viewings.accountId===accountId;
 const openViewings=()=>setViewings({accountId,conversation:viewModel.conversation});
 const back=()=>{if(returnToListing)onRootBack();else viewModel.backFromWorkspace(onRootBack);};
 useEffect(()=>{if(showingViewings)return;registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <ScreenContainer padded={false} includeBottomInset={false}><View style={styles.content}>{showingViewings?<ViewingsWorkspace key={`${accountId}-${viewings.conversation?.id??'all'}`} accountId={accountId} conversation={viewings.conversation} onBack={()=>{setViewings(null);viewModel.refresh();}} registerBackAction={registerBackAction}/>:viewModel.screen==='inbox'?<MessagingInboxView viewModel={viewModel} onViewings={openViewings} onClose={returnToListing?onRootBack:onClose}/>:<MessagingConversationView viewModel={viewModel} onViewings={openViewings} onBack={back}/>}</View>
 {!showingViewings?<RentLeaseBottomNavigation active="chat" onChat={viewModel.openInbox} onDiscover={onOpenDiscover} onListing={()=>{if(canPostProperty)onOpenListings();}} onPost={()=>{if(canPostProperty)onCreateListing();}} onTenancy={onOpenMaintenance}/>:null}</ScreenContainer>;
}
const styles=StyleSheet.create({content:{flex:1}});
