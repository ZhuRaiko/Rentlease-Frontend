import {Text,View} from 'react-native';
import {InlineRentalEstimate} from './InlineRentalEstimate';
import type {PredictionReceipt,PredictionTarget} from '../models/RentalPrediction';
import {ui} from '../theme/ui';
/** No property creation, feature overrides or second prediction client. */
export function RentalPriceGuidance({accountId,target,property,onUseEstimate,disabled=false}:{accountId:string|undefined;target:PredictionTarget|null;property:Record<string,unknown>|null;onUseEstimate:(result:PredictionReceipt)=>void;disabled?:boolean}){
 if(!target)return <View style={{gap:4}}><Text style={[ui.body,{fontWeight:'600'}]}>Rental price guidance</Text><Text style={ui.supporting}>Save this draft to estimate from saved property details. You can choose your asking rent now.</Text></View>;
 return <InlineRentalEstimate accountId={accountId} target={target} property={property} variant="guidance" onUseEstimate={onUseEstimate} disabled={disabled}/>;
}
