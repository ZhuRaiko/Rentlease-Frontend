import type {ReactNode} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import type {PropertyValidationField} from '../models/DraftProperty';
import {RANGE_SUBTITLE,RANGE_TITLE,allFilledText,type RangeCardView} from '../models/RangeCard';
/**
 * ONE green card for the eight details the typical-rent range reads: a count, a meter of eight pips, a chip for each detail still missing
 * (tap to go to it), and the fields in three short groups. The structure never changes while the person types: the missing chips row is the only
 * part that shrinks, and at all eight it becomes one line.
 */
export function RangeDetailsCard({view,onFocus,size,unit,comfort}:{view:RangeCardView;onFocus:(field:PropertyValidationField,label:string)=>void;size:ReactNode;unit:ReactNode;comfort:ReactNode}){
  return <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.copy}><Text accessibilityRole="header" style={ui.sectionTitle}>{RANGE_TITLE}</Text><Text style={styles.subtitle}>{RANGE_SUBTITLE}</Text></View>
        <Text accessibilityLabel={`${view.filled} of ${view.total} range details filled`} style={styles.pill}>{view.filled} of {view.total}</Text>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`${view.filled} of ${view.total} range details filled`} accessibilityValue={{min:0,max:view.total,now:view.filled}} style={styles.pips}>
        {view.pips.map(pip=><View key={pip.key} style={[styles.pip,pip.filled&&styles.pipOn]}/>)}
      </View>
      {view.allFilled
        ?<Text accessibilityLiveRegion="polite" style={styles.done}>{allFilledText(view.total)}</Text>
        :<View style={styles.missing}>
          <Text style={styles.addLabel}>Add:</Text>
          {view.missing.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`Add ${item.label.toLowerCase()}`} onPress={()=>onFocus(item.field,item.label)} style={styles.chip}><Text style={styles.chipText}>+ {item.label}</Text></Pressable>)}
        </View>}
      <Text accessibilityRole="header" style={styles.group}>Size</Text>{size}
      <Text accessibilityRole="header" style={styles.group}>{view.unitGroupLabel}</Text>{unit}
      <Text accessibilityRole="header" style={styles.group}>Comfort</Text>{comfort}
  </View>;
}
const styles=StyleSheet.create({
  // A pale-green card with a regular green border: the same radius and padding as the other cards.
  card:{backgroundColor:colors.primaryPale,borderWidth:1,borderColor:colors.primaryAction,borderRadius:radius.panel,padding:spacing.md,gap:spacing.sm},
  head:{flexDirection:'row',alignItems:'flex-start',gap:spacing.sm},copy:{flex:1,minWidth:0,gap:2},subtitle:{...ui.supporting,color:colors.textSecondary},
  pill:{...ui.supporting,color:colors.primaryAction,backgroundColor:colors.background,borderRadius:radius.pill,paddingVertical:4,paddingHorizontal:spacing.sm,fontWeight:'700',overflow:'hidden'},
  pips:{flexDirection:'row',gap:4},pip:{flex:1,height:6,borderRadius:3,backgroundColor:colors.border},pipOn:{backgroundColor:colors.primaryAction},
  missing:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.xs},addLabel:{...ui.supporting,fontWeight:'600'},
  chip:{minHeight:48,justifyContent:'center',paddingHorizontal:spacing.sm,borderWidth:1,borderStyle:'dashed',borderColor:colors.primaryAction,borderRadius:radius.pill,backgroundColor:colors.background},chipText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
  done:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},
  group:{...ui.body,fontWeight:'700',marginTop:spacing.xs},
});
