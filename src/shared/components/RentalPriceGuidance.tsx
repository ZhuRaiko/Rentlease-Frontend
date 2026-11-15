import {useRentalLocationApproval} from '../viewModels/useRentalLocationApproval';
import {RentalLocationApproval} from './RentalLocationApproval';
import {Text,View} from 'react-native';
import {InlineRentalEstimate} from './InlineRentalEstimate';
import type {PredictionTarget} from '../models/RentalPrediction';
import {ui} from '../theme/ui';
/** No property creation, feature overrides or second prediction client. */
export function RentalPriceGuidance({accountId,target,property,onUseRent,askingRent,disabled=false,variant='guidance'}:{variant?:'guidance'|'posting';accountId:string|undefined;target:PredictionTarget|null;property:Record<string,unknown>|null;onUseRent:(rent:number)=>void;askingRent?:number|undefined;disabled?:boolean}){
 const approval=useRentalLocationApproval(accountId,target?.propertyId,property?.edit_version);
 if(!target)return <View style={{gap:4}}><Text style={[ui.body,{fontWeight:'600'}]}>Rental price guidance</Text><Text style={ui.supporting}>Save this draft to estimate from saved property details. You can choose your asking rent now.</Text></View>;
 return <View style={{gap:8}}><RentalLocationApproval model={approval} disabled={disabled}/><InlineRentalEstimate key={`${approval.state?.revision}:${approval.state?.approved}:${approval.ready}`} accountId={accountId} target={target} property={property} variant={variant} onUseRent={onUseRent} askingRent={askingRent} disabled={disabled}/></View>;
}
