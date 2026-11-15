import {StyleSheet,Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {ListingField} from './ListingControls';
import {MORE_LABELS,moreDetailsFields,type MoreField} from '../models/PropertyReadiness';
import {MORE_DETAILS_HELPER} from '../models/RangeCard';
import type {DraftProperty} from '../models/DraftProperty';
import type {PropertyFormFocus} from './usePropertyFormFocus';

const PLACEHOLDERS=(type:string|null):Record<'totalFloors'|'maxOccupants',string>=>({totalFloors:type==='house'?'e.g. 2':'e.g. 5',maxOccupants:type==='house'?'e.g. 6':'e.g. 2'});
/**
 * Optional details that do NOT change the range: floors in building (stories for a house), maximum occupants and entrance instructions.
 * Everything the range reads lives in the range card instead.
 */
export function MoreDetailsFields({draft:d,disabled,focus,error,onChange,onBlur}:{draft:DraftProperty;disabled:boolean;focus?:PropertyFormFocus|undefined;error:(field:string)=>string|null|undefined;onChange:(field:MoreField|'accessInstructions',value:string)=>void;onBlur?:((field:MoreField|'accessInstructions')=>void)|undefined}){
  const type=d.propertyType,labels=MORE_LABELS(type),placeholders=PLACEHOLDERS(type);
  const fields=moreDetailsFields(type).filter((f):f is 'totalFloors'|'maxOccupants'=>f==='totalFloors'||f==='maxOccupants');
  return <View style={styles.wrap}>
    <Text style={ui.supporting}>{MORE_DETAILS_HELPER}</Text>
    <View style={styles.grid}>{fields.map(field=><View key={field} style={styles.cell}>
      <ListingField inputRef={focus?.field(field)} label={labels[field]} error={error(field)??null} placeholder={placeholders[field]} keyboardType="numeric" editable={!disabled} value={d[field]??''} onChangeText={v=>onChange(field,v)} onBlur={()=>onBlur?.(field)}/>
    </View>)}</View>
    <ListingField inputRef={focus?.field('accessInstructions')} label="Entrance instructions (private)" error={error('accessInstructions')??null} placeholder="e.g. Gate code, nearest landmark" multiline editable={!disabled} value={d.accessInstructions} onChangeText={v=>onChange('accessInstructions',v)}/>
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:spacing.sm},grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{flexBasis:130,flexGrow:1,minWidth:0}});
