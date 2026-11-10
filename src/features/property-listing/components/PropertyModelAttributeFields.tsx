import {Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {ChoiceChip,ListingField} from './ListingControls';
import {modelSubtypeOptions,type PropertyModelAttributeDraft} from '../models/PropertyModelAttributes';
export function PropertyModelAttributeFields({type,draft,disabled,onChange,error}:{type:string|null;draft:PropertyModelAttributeDraft;disabled:boolean;error?:((field:keyof PropertyModelAttributeDraft)=>string|null|undefined)|undefined;onChange:(field:keyof PropertyModelAttributeDraft,value:string)=>void}){
 const options=modelSubtypeOptions(type);
 return <View style={{gap:8}}><Text style={ui.sectionTitle}>Additional property details (optional)</Text>
 {error?.('propertySubtype')?<Text accessibilityRole="alert" style={ui.supporting}>{error('propertySubtype')}</Text>:null}
 {options.length?<><Text style={ui.supporting}>Subtype describes this saved marketplace category. Leave unspecified if unknown.</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}><ChoiceChip label="Not specified" selected={!draft.propertySubtype} disabled={disabled} onPress={()=>onChange('propertySubtype','')}/>{options.map(value=><ChoiceChip key={value} label={value.replace(/_/g,' ')} selected={draft.propertySubtype===value} disabled={disabled} onPress={()=>onChange('propertySubtype',value)}/>)}</View></>:draft.propertySubtype?<ChoiceChip label="Clear unavailable subtype" selected={false} disabled={disabled} onPress={()=>onChange('propertySubtype','')}/>:null}
 <ListingField error={error?.('lotAreaSqm')??null} label="Lot area (sqm, optional)" placeholder="Unknown" keyboardType="numeric" value={draft.lotAreaSqm??''} editable={!disabled} onChangeText={v=>onChange('lotAreaSqm',v)}/>
 <ListingField error={error?.('parkingSpaces')??null} label="Parking spaces (optional)" placeholder="Unknown" keyboardType="numeric" value={draft.parkingSpaces??''} editable={!disabled} onChangeText={v=>onChange('parkingSpaces',v)}/>
 <Text style={ui.supporting}>Blank means unknown. Enter 0 only when confirmed. These details do not change your listing price or publication requirements.</Text>
 </View>;
}
