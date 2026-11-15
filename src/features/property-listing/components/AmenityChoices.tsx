import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {visibleAmenities,type AmenityItem} from '../models/AmenityChoices';
import {ChoiceChip} from './ListingControls';

/**
 * The chips of the Amenities card: common ones first, a "Show all" chip for the rest. Whatever is chosen stays visible. Saving is unchanged:
 * the parent decides what a tap does (the existing property-details call).
 */
export function AmenityChoices({catalog,selectedIds,onToggle,disabled,comfortable=true}:{catalog:readonly AmenityItem[];selectedIds:readonly number[];onToggle:(id:number)=>void;disabled:boolean;comfortable?:boolean}){
  const [expanded,setExpanded]=useState(false);
  const {visible,hidden}=visibleAmenities(catalog,selectedIds,expanded);
  const toggle=hidden>0||expanded;
  return <View style={styles.chips}>
    {visible.map(item=><ChoiceChip comfortable={comfortable} key={item.id} label={item.name} selected={selectedIds.includes(item.id)} disabled={disabled} onPress={()=>onToggle(item.id)}/>)}
    {toggle?<Pressable accessibilityRole="button" accessibilityLabel={expanded?'Show fewer amenities':`Show all amenities, ${hidden} more`} accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={styles.more}><Text style={styles.moreText}>{expanded?'Show fewer':'Show all'}</Text></Pressable>:null}
  </View>;
}
const styles=StyleSheet.create({
  chips:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},
  more:{minHeight:48,paddingHorizontal:spacing.md,justifyContent:'center',borderWidth:1.5,borderColor:colors.outline,borderStyle:'dashed',borderRadius:radius.pill,backgroundColor:colors.background},
  moreText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
});
