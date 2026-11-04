import {useEffect} from 'react';
import {StyleSheet,View} from 'react-native';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import {RentLeaseBottomNavigation} from '../../../shared/components/RentLeaseBottomNavigation';
import type {MessagingActor} from '../models/MessagingViewing';
import {useMessagingViewingViewModel} from '../viewModels/useMessagingViewingViewModel';
import {MessagingInboxView} from './MessagingInboxView';
import {MessagingConversationView} from './MessagingConversationView';
interface Props {actor?:MessagingActor;accountId?:string|undefined;conversationId?:string|undefined;initialScreen?:'inbox'|'newInquiry';canPostProperty:boolean;onClose:()=>void;onRootBack:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined;onCreateListing:()=>void;onOpenDiscover:()=>void;onOpenListings:()=>void;onOpenMaintenance:()=>void;returnToListing?:boolean}
export function MessagingViewingFlowView({accountId,conversationId,canPostProperty,onClose,onRootBack,registerBackAction,onCreateListing,onOpenDiscover,onOpenListings,onOpenMaintenance,returnToListing=false}:Props){
 const viewModel=useMessagingViewingViewModel(accountId,conversationId);
 const back=()=>{if(returnToListing)onRootBack();else viewModel.backFromWorkspace(onRootBack);};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 return <ScreenContainer padded={false} includeBottomInset={false}><View style={styles.content}>{viewModel.screen==='inbox'?<MessagingInboxView viewModel={viewModel} onClose={returnToListing?onRootBack:onClose}/>:<MessagingConversationView viewModel={viewModel} onBack={back}/>}</View>
 <RentLeaseBottomNavigation active="chat" onChat={viewModel.openInbox} onDiscover={onOpenDiscover} onListing={()=>{if(canPostProperty)onOpenListings();}} onPost={()=>{if(canPostProperty)onCreateListing();}} onTenancy={onOpenMaintenance}/></ScreenContainer>;
}
const styles=StyleSheet.create({content:{flex:1}});
