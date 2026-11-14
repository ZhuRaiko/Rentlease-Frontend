import type {PropertyFormFocus} from './usePropertyFormFocus';
import {Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {ChoiceChip,ListingField,EstimateMarker} from './ListingControls';
import {modelSubtypeOptions,type PropertyModelAttributeDraft} from '../models/PropertyModelAttributes';
export function PropertyModelAttributeFields({type,draft,disabled,onChange,error,focus,compact=false,marker=false}:{focus?:PropertyFormFocus|undefined;compact?:boolean;marker?:boolean;type:string|null;draft:PropertyModelAttributeDraft;disabled:boolean;error?:((field:keyof PropertyModelAttributeDraft)=>string|null|undefined)|undefined;onChange:(field:keyof PropertyModelAttributeDraft,value:string)=>void}){
 const options=modelSubtypeOptions(type);
 return <View style={{gap:8}}>{!compact?<Text style={ui.sectionTitle}>Additional property details (optional)</Text>:null}
 {error?.('propertySubtype')?<Text accessibilityRole="alert" style={ui.supporting}>{error('propertySubtype')}</Text>:null}
 {options.length?<><Text style={ui.supporting}>{compact?"Property subtype (optional)":"Subtype describes this saved marketplace category. Leave unspecified if unknown."}{marker?<EstimateMarker/>:null}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}><ChoiceChip comfortable={compact} role={compact?'radio':'checkbox'} label="Not specified" selected={!draft.propertySubtype} disabled={disabled} onPress={()=>onChange('propertySubtype','')}/>{options.map(value=><ChoiceChip comfortable={compact} role={compact?'radio':'checkbox'} key={value} label={value.replace(/_/g,' ')} selected={draft.propertySubtype===value} disabled={disabled} onPress={()=>onChange('propertySubtype',value)}/>)}</View></>:draft.propertySubtype?<ChoiceChip comfortable={compact} role={compact?'radio':'checkbox'} label="Clear unavailable subtype" selected={false} disabled={disabled} onPress={()=>onChange('propertySubtype','')}/>:null}
 <ListingField inputRef={focus?.field('lotAreaSqm')} error={error?.('lotAreaSqm')??null} label="Lot area (sqm, optional)" usedInEstimate={marker} placeholder="Unknown" keyboardType="numeric" value={draft.lotAreaSqm??''} editable={!disabled} onChangeText={v=>onChange('lotAreaSqm',v)}/>
 <ListingField inputRef={focus?.field('parkingSpaces')} error={error?.('parkingSpaces')??null} label="Parking spaces (optional)" usedInEstimate={marker} placeholder="Unknown" keyboardType="numeric" value={draft.parkingSpaces??''} editable={!disabled} onChangeText={v=>onChange('parkingSpaces',v)}/>
 <Text style={ui.supporting}>{compact?"Leave blank if unknown. Enter 0 only when confirmed.":"Blank means unknown. Enter 0 only when confirmed. These details do not change your listing price or publication requirements."}</Text>
 </View>;
}
