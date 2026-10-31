import {StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import type {ListingCompletenessState} from '../models/ListingCompleteness';
export function ListingCompletenessSummary({value}:{value:ListingCompletenessState}) {
  return <View style={styles.section}>
    <View style={styles.row}><Text style={ui.sectionTitle}>Listing completeness</Text><Text style={ui.sectionTitle}>{value.percent}%</Text></View>
    <View accessibilityRole="progressbar" accessibilityLabel="Listing completeness" accessibilityValue={{min:0,max:100,now:value.percent,text:`${value.percent} percent, ${value.source==='server'?'saved listing':'local estimate'}`}} style={styles.track}><View style={[styles.fill,{width:`${value.percent}%`}]}/></View>
    <Text style={ui.body}>{value.percent===100?'All completeness items included':value.meetsThreshold?'Completeness threshold met':'Listing information in progress'}</Text>
    <Text style={ui.supporting}>{value.source==='server'?'Saved listing score. Unsaved changes are not included.':'Local estimate. Photos and amenities must be saved to count on the server.'}</Text>
    <Text style={ui.supporting}>Completeness does not confirm that a property is valid or saved.</Text>
    <Text style={ui.supporting}>80% completeness required to publish. Ownership verification and other checks still apply.</Text>
  </View>;
}
const styles=StyleSheet.create({section:{gap:spacing.xs,paddingVertical:spacing.sm},row:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:spacing.sm},track:{height:6,backgroundColor:colors.outline,borderRadius:3,overflow:'hidden'},fill:{height:6,backgroundColor:colors.primaryAction}});
