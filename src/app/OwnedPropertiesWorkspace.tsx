import {useState} from 'react';
import {Text,View,Pressable} from 'react-native';
import {PropertyListingFlowView,type PropertyListingFlowViewProps} from '../features/property-listing/views/PropertyListingFlowView';
import {portfolioListingLabels,type LandlordPortfolioItem} from '../features/property-listing/models/LandlordPortfolio';
import {RequestManagementView} from '../features/messaging-viewing/views/RequestManagementView';
import {useRequestSnapshot} from '../features/messaging-viewing/viewModels/useRequestSnapshot';
import {ui} from '../shared/theme/ui';
import {colors} from '../shared/theme/colors';
export function OwnedPropertiesWorkspace({accountId,...props}:PropertyListingFlowViewProps&{accountId:string|undefined}){
 const snapshot=useRequestSnapshot(accountId),[selected,setSelected]=useState<LandlordPortfolioItem|null>(null);
 const close=()=>{setSelected(null);void snapshot.refresh();};
 return <View style={{flex:1}}><PropertyListingFlowView {...props} accountId={accountId} registerBackAction={selected?undefined:props.registerBackAction} renderRequestControls={item=>item.property.landlord_id===accountId?<View><Text style={ui.supporting}>{snapshot.busy?'Loading requests...':snapshot.error??snapshot.summary(item)}</Text><Pressable accessibilityRole="button" style={{minHeight:48,justifyContent:'center'}} onPress={()=>setSelected(item)}><Text style={[ui.body,{color:colors.primaryAction}]}>Manage Requests</Text></Pressable></View>:null}/>{selected&&selected.property.landlord_id===accountId?<View style={{position:'absolute',inset:0,backgroundColor:colors.background}}><RequestManagementView key={accountId+selected.propertyId} accountId={accountId} title={selected.currentListing?.title??'Property requests'} cover={selected.coverPhoto?.publicUrl} status={selected.currentListing?portfolioListingLabels[selected.currentListing.status]:'No current listing'} scope={{kind:'property',propertyId:selected.propertyId,listingIds:selected.listings.map(l=>l.id)}} onBack={close} registerBackAction={props.registerBackAction}/></View>:null}</View>;
}
