import {useState} from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {PropertyListingFlowView,type PropertyListingFlowViewProps} from '../features/property-listing/views/PropertyListingFlowView';
import {portfolioListingLabels,type LandlordPortfolioItem} from '../features/property-listing/models/LandlordPortfolio';
import {RequestManagementView} from '../features/messaging-viewing/views/RequestManagementView';
import {useRequestSnapshot} from '../features/messaging-viewing/viewModels/useRequestSnapshot';
import {requestActivityLine} from '../features/messaging-viewing/models/RequestSummary';
import {colors} from '../shared/theme/colors';
import {usePropertyManagement,type PropertyManagementNavigation} from './usePropertyManagement';
export function OwnedPropertiesWorkspace({accountId,onOpenTenancy,onMessage,managePropertyId,onReturnToTenancy,...props}:PropertyListingFlowViewProps&{accountId:string|undefined;managePropertyId?:string|undefined;onReturnToTenancy?:(()=>void)|undefined;onOpenTenancy:PropertyManagementNavigation['openTenancy'];onMessage:PropertyManagementNavigation['message']}){
 const snapshot=useRequestSnapshot(accountId),[selected,setSelected]=useState<{item:LandlordPortfolioItem;tab:'viewings'|'reservations'}|null>(null);
 const management=usePropertyManagement(accountId,snapshot,{openTenancy:onOpenTenancy,message:onMessage},item=>setSelected({item,tab:'reservations'}));
 const close=()=>{setSelected(null);void snapshot.refresh();management.refresh();};
 const item=selected?.item;
 return <View style={{flex:1}}><PropertyListingFlowView {...props} accountId={accountId} management={management} initialManagePropertyId={managePropertyId} onReturnFromManage={managePropertyId?onReturnToTenancy:undefined} registerBackAction={selected?undefined:props.registerBackAction} requestActivity={card=>{if(card.property.landlord_id!==accountId)return null;const line=snapshot.busy?null:requestActivityLine(snapshot.activity(card));return {text:line?.text??null,pending:line?.pending??false,error:snapshot.busy?null:snapshot.error,onManage:()=>setSelected({item:card,tab:'viewings'})};}}/>{item&&item.property.landlord_id===accountId?<SafeAreaView edges={['top','right','bottom','left']} style={{position:'absolute',inset:0,backgroundColor:colors.background}}><RequestManagementView key={accountId+item.propertyId} initialTab={selected.tab} accountId={accountId} title={item.currentListing?.title??'Property requests'} cover={item.coverPhoto?.publicUrl} status={item.currentListing?portfolioListingLabels[item.currentListing.status]:'No current listing'} counts={(a=>({viewings:a.viewingsPending+a.viewingsUpcoming,reservations:a.reservationsPending+a.reservationsApproved}))(snapshot.activity(item))} scope={{kind:'property',propertyId:item.propertyId,listingIds:item.listings.map(l=>l.id)}} onBack={close} registerBackAction={props.registerBackAction}/></SafeAreaView>:null}</View>;
}
