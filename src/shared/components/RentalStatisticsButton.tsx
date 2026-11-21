import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../theme/colors';
import {radius} from '../theme/radius';
import {spacing} from '../theme/spacing';
import {ui} from '../theme/ui';
import {SHEET_COPY,statsGroupFor,type StatisticsInput} from '../models/RentalStatistics';
import {RentalStatisticsSheet} from './RentalStatisticsSheet';

/** A small bar-chart mark drawn with plain views (no icon library). Decoration only: the label says it all. */
function ChartMark({color}:{color:string}){
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.mark}>{[10,18,13].map((h,i)=><View key={i} style={[styles.markBar,{height:h,backgroundColor:color}]}/>)}</View>;
}
/**
 * The one entry to the Statistical analysis sheet. `button` is the owner's outlined full-width "Statistical analysis" button; `chip` is the renter's compact
 * "Statistics" chip next to "How is this estimated?". Both are 48dp tall and open the same sheet. It renders nothing for a property type the accuracy figures do not
 * cover, so a card without an estimate never offers it (it is only drawn where there is a range).
 */
export function RentalStatisticsButton({input,variant}:{input:StatisticsInput;variant:'button'|'chip'}){
  const [open,setOpen]=useState(false);
  if(!statsGroupFor(input.propertyType))return null;
  const chip=variant==='chip';
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={SHEET_COPY.entryButton} accessibilityHint="Opens how accurate the estimate has been" onPress={()=>setOpen(true)} style={({pressed})=>[styles.base,chip?styles.chip:styles.button,pressed&&{opacity:.85}]}>
      <ChartMark color={colors.primaryAction}/><Text style={[styles.label,chip&&styles.chipLabel]}>{chip?SHEET_COPY.entryChip:SHEET_COPY.entryButton}</Text>
    </Pressable>
    <RentalStatisticsSheet visible={open} input={input} onClose={()=>setOpen(false)}/>
  </>;
}
const styles=StyleSheet.create({
  base:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.xs,paddingHorizontal:spacing.md,borderRadius:radius.pill},
  button:{alignSelf:'stretch',borderWidth:1.5,borderColor:colors.primaryAction,backgroundColor:colors.background},
  chip:{alignSelf:'flex-start',borderWidth:1,borderColor:colors.primary,backgroundColor:colors.primaryPale},
  label:{...ui.body,fontWeight:'700',color:colors.primaryAction},chipLabel:{...ui.supporting,fontWeight:'700',color:colors.primaryAction},
  mark:{flexDirection:'row',alignItems:'flex-end',gap:2,height:18},markBar:{width:4,borderRadius:1},
});
