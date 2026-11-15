import {StyleSheet,Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {ChoiceChip,ListingField} from './ListingControls';
import {FieldLabel} from './FieldLabel';
import {offeredSubtypeOptions,subtypeLabel} from '../models/PropertyModelAttributes';
import {MORE_FIELD_FEEDS_RANGE,MORE_LABELS,moreDetailsFields,type MoreField} from '../models/PropertyReadiness';
import type {DraftProperty} from '../models/DraftProperty';
import type {PropertyFormFocus} from './usePropertyFormFocus';

const PLACEHOLDERS=(type:string|null):Record<Exclude<MoreField,'propertySubtype'>,string>=>({lotAreaSqm:'e.g. 120',parkingSpaces:'e.g. 1',floorNumber:'e.g. 2',totalFloors:type==='house'?'e.g. 2':'e.g. 5',maxOccupants:type==='house'?'e.g. 6':'e.g. 2'});
/**
 * The optional details for the chosen type, in a two-column grid: subtype chips, then number fields. Apartment and condominium offer unit floor
 * and floors in building; a house offers lot area and stories and never a unit floor; lot area never appears for an apartment. One short helper
 * line, no paragraph under any field.
 */
export function MoreDetailsFields({draft:d,disabled,focus,error,onChange,onBlur}:{draft:DraftProperty;disabled:boolean;focus?:PropertyFormFocus|undefined;error:(field:string)=>string|null|undefined;onChange:(field:MoreField|'accessInstructions',value:string)=>void;onBlur?:((field:MoreField|'accessInstructions')=>void)|undefined}){
  const type=d.propertyType,fields=moreDetailsFields(type),labels=MORE_LABELS(type),placeholders=PLACEHOLDERS(type);
  // A stored subtype that does not fit stays visible (selected) so it can be cleared.
  const offered=offeredSubtypeOptions(type),current=d.propertySubtype?.trim()||'',options=current&&!offered.includes(current)&&offered.length?[...offered,current]:offered;
  const numberFields=fields.filter((f):f is Exclude<MoreField,'propertySubtype'>=>f!=='propertySubtype');
  return <View style={styles.wrap}>
    {fields.includes('propertySubtype')?<View style={styles.group}>
      <FieldLabel label={labels.propertySubtype} usedInEstimate={MORE_FIELD_FEEDS_RANGE.propertySubtype}/>
      {error('propertySubtype')?<Text accessibilityRole="alert" style={ui.supporting}>{error('propertySubtype')}</Text>:null}
      <View style={styles.chips}>
        <ChoiceChip comfortable role="radio" label="Not specified" selected={!d.propertySubtype} disabled={disabled} onPress={()=>onChange('propertySubtype','')}/>
        {options.map(value=><ChoiceChip comfortable role="radio" key={value} label={subtypeLabel(value)} selected={d.propertySubtype===value} disabled={disabled} onPress={()=>onChange('propertySubtype',value)}/>)}
      </View>
    </View>:null}
    <View style={styles.grid}>{numberFields.map(field=><View key={field} style={styles.cell}>
      <ListingField inputRef={focus?.field(field)} label={labels[field]} usedInEstimate={MORE_FIELD_FEEDS_RANGE[field]} error={error(field)??null} placeholder={placeholders[field]} keyboardType="numeric" editable={!disabled} value={d[field]??''} onChangeText={v=>onChange(field,v)} onBlur={()=>onBlur?.(field)}/>
    </View>)}</View>
    <Text style={ui.supporting}>Leave blank if unknown. Unit numbers belong in the address.</Text>
    <ListingField inputRef={focus?.field('accessInstructions')} label="Entrance instructions (private)" error={error('accessInstructions')??null} placeholder="How to find the entrance" multiline editable={!disabled} value={d.accessInstructions} onChangeText={v=>onChange('accessInstructions',v)}/>
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:spacing.sm},group:{gap:spacing.xs},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{flexBasis:130,flexGrow:1,minWidth:0}});
