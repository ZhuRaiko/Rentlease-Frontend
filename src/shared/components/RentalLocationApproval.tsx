import {Text,View,Pressable} from 'react-native';
import {ui} from '../theme/ui';
import {colors} from '../theme/colors';
import type {useRentalLocationApproval} from '../viewModels/useRentalLocationApproval';
export function RentalLocationApproval({model,disabled}:{model:ReturnType<typeof useRentalLocationApproval>;disabled:boolean}){
 const s=model.state;
 if(!s&&!model.error)return null;
 return <View style={{gap:4}}><Text style={ui.supporting}>Approximate location for rent estimation (optional)</Text>
 <Text style={ui.supporting}>If you approve, RentLease sends only this property's confirmed approximate public map point to its rental price estimation provider. Exact locations are excluded. This permission applies to this location revision under policy rental-public-location-v1. Location or identity corrections require approval again. You can withdraw permission for future requests. Declining does not block estimation or publication.</Text>
 {s?.point?<Text style={ui.supporting}>Public map point to confirm: latitude {s.point.latitude.toFixed(6)}, longitude {s.point.longitude.toFixed(6)}. Confirm that this is the approximate public point for this property before approving.</Text>:null}
 {model.error?<Text accessibilityRole="alert" style={ui.supporting}>{model.error}</Text>:null}
 {s?<Text style={ui.supporting}>{s.approved?'Approved for the current location.':s.eligible?'Not approved. Estimates can use the other saved details.':'A confirmed public grid location is unavailable. Estimates can use the other saved details.'}</Text>:null}
 {s&&model.ready&&(s.approved||s.eligible)?<Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||model.busy,busy:model.busy}} disabled={disabled||model.busy} style={{minHeight:48,justifyContent:'center'}} onPress={()=>void model.save(!s.approved)}><Text style={[ui.supporting,{color:colors.primaryAction}]}>{model.busy?'Updating permission...':s.approved?'Withdraw location permission':'I confirm the approximate public point and approve its use'}</Text></Pressable>:null}
 {model.error?<Pressable accessibilityRole="button" disabled={disabled||model.busy} style={{minHeight:48,justifyContent:'center'}} onPress={model.reload}><Text style={[ui.supporting,{color:colors.primaryAction}]}>Reload location permission</Text></Pressable>:null}
 </View>;
}
