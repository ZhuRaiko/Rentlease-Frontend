import {StyleSheet,Text,View} from 'react-native';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {ChoiceChip,ListingField} from './ListingControls';
import {FieldLabel} from './FieldLabel';
import {offeredSubtypeOptions,shownSubtype,subtypeLabel} from '../models/PropertyModelAttributes';
import {MORE_LABELS,unitFields,type MoreField} from '../models/PropertyReadiness';
import type {DraftProperty} from '../models/DraftProperty';
import type {PropertyFormFocus} from './usePropertyFormFocus';

const PLACEHOLDERS:Record<'lotAreaSqm'|'parkingSpaces'|'floorNumber',string>={lotAreaSqm:'e.g. 120',parkingSpaces:'e.g. 1',floorNumber:'e.g. 2'};
/**
 * The unit group of the range card (the lot group for a house): unit floor or lot area, parking, and the subtype chips where the type has any.
 * An apartment or condominium never shows lot area; a house never shows a unit floor. Each field has its own scroll target for the "Add:" chips.
 */
export function UnitDetailFields({draft:d,disabled,focus,error,onChange,onBlur}:{draft:DraftProperty;disabled:boolean;focus?:PropertyFormFocus|undefined;error:(field:string)=>string|null|undefined;onChange:(field:MoreField,value:string)=>void;onBlur?:((field:MoreField)=>void)|undefined}){
  const type=d.propertyType,fields=unitFields(type),labels=MORE_LABELS(type);
  // Only offered subtypes are chips, always the same list for a type. A saved subtype that is no longer offered shows as "Not specified" (the chip row never gains or loses a chip because of the saved value).
  const options=offeredSubtypeOptions(type),shown=shownSubtype(type,d.propertySubtype);
  const numbers=fields.filter((f):f is 'lotAreaSqm'|'parkingSpaces'|'floorNumber'=>f!=='propertySubtype');
  return <View style={styles.wrap}>
    <View style={styles.grid}>{numbers.map(field=><View key={field} collapsable={false} ref={focus?.section(`detail:${field}`)} style={styles.cell}>
      <ListingField inputRef={focus?.field(field)} label={labels[field]} error={error(field)??null} placeholder={PLACEHOLDERS[field]} keyboardType="numeric" editable={!disabled} value={d[field]??''} onChangeText={v=>onChange(field,v)} onBlur={()=>onBlur?.(field)}/>
    </View>)}</View>
    {fields.includes('propertySubtype')?<View collapsable={false} ref={focus?.section('detail:propertySubtype')} style={styles.group}>
      <FieldLabel label={labels.propertySubtype}/>
      {error('propertySubtype')?<Text accessibilityRole="alert" style={ui.supporting}>{error('propertySubtype')}</Text>:null}
      <View style={styles.chips}>
        <ChoiceChip comfortable role="radio" label="Not specified" selected={!shown} disabled={disabled} onPress={()=>onChange('propertySubtype','')}/>
        {options.map(value=><ChoiceChip comfortable role="radio" key={value} label={subtypeLabel(value)} selected={shown===value} disabled={disabled} onPress={()=>onChange('propertySubtype',value)}/>)}
      </View>
    </View>:null}
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:spacing.sm},group:{gap:spacing.xs},chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{flexBasis:130,flexGrow:1,minWidth:0}});
