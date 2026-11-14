import {useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {colors} from '../theme/colors';
import {radius} from '../theme/radius';
import {spacing} from '../theme/spacing';
import {ui} from '../theme/ui';
import {formatPeso} from '../models/Currency';
import {RANGE_DISCLAIMER,RELATION_HELP,ballValue,pickedAfterRentChange,appliedButtonShows,RELATION_TEXT,fractionOfValue,listingRelationSentence,rangeRelation,type RentalRange} from '../models/RentalRange';
import {RangeSlider} from './RangeSlider';

/** What the estimate is, in plain words. The only place the model's name appears. */
export const HOW_ESTIMATED_TITLE='How is this estimated?';
export const HOW_ESTIMATED_LINES=[
  'A gradient-boosted tree model (XGBoost) compares this property’s saved details with similar rentals: type, size, rooms, furnishing, amenities and city, and your approximate area if you share it.',
  'It gives a typical range of monthly rent for similar places. The range is illustrative: it is not an appraisal, a guarantee or a statistical confidence interval.',
  'Your asking rent stays your choice. Any positive amount is allowed.',
];
function HowEstimated(){
  const [open,setOpen]=useState(false),{height}=useWindowDimensions();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={HOW_ESTIMATED_TITLE} style={styles.link} onPress={()=>setOpen(true)}><Text style={styles.linkText}>{HOW_ESTIMATED_TITLE}</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={()=>setOpen(false)}/>
        <View accessibilityViewIsModal style={[styles.dialog,{maxHeight:height*.85}]}>
          <View style={styles.dialogHead}><Text accessibilityRole="header" style={[ui.sectionTitle,styles.flex]}>{HOW_ESTIMATED_TITLE}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={()=>setOpen(false)}><Text style={ui.sectionTitle}>{'×'}</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.dialogBody}>{HOW_ESTIMATED_LINES.map(line=><Text key={line} style={ui.body}>{line}</Text>)}</ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

/** Read-only range bar with the rent marked on it. A rent outside the range sits at the nearer end. */
export function RangeBar({range,rent}:{range:RentalRange;rent?:number|null|undefined}){
  const relation=rangeRelation(rent,range),warn=relation==='above'||relation==='below';
  return <View style={styles.barWrap}>
    <View style={styles.ends}><Text style={styles.endText}>{formatPeso(range.minimum)}</Text><Text style={styles.endText}>{formatPeso(range.maximum)}</Text></View>
    <View accessible accessibilityRole="image" accessibilityLabel={`Typical rent from ${formatPeso(range.minimum)} to ${formatPeso(range.maximum)} per month${rent&&relation?`. This rent, ${formatPeso(rent)}, is ${RELATION_TEXT[relation].toLowerCase()}`:''}.`} style={styles.bar}>
      <View style={styles.rail}/>
      {relation?<View testID="range-rent-marker" style={[styles.marker,warn&&styles.markerWarn,{left:`${fractionOfValue(rent!,range)*100}%`}]}/>:null}
    </View>
  </View>;
}

/**
 * The range card. With `onUseRent` the owner can slide along the range and apply a value; without it the bar is read-only (tenants, the
 * standalone flow). The relation line compares the rent only with the ends of the range. No point value exists to show.
 */
export function RangeEstimateCard({range,rent,onUseRent,disabled=false,subject='asking',basisText,appliedRent}:{range:RentalRange;rent?:number|null|undefined;onUseRent?:((rent:number)=>void)|undefined;disabled?:boolean;subject?:'asking'|'listing';basisText?:string|undefined;appliedRent?:number|null|undefined}){
  const [picked,setPicked]=useState<number|null>(null);
  // Typing a different rent hands the ball back to the field; sliding is only the owner's own trial value.
  useEffect(()=>{setPicked(p=>pickedAfterRentChange(p,rent));},[rent]);
  const shown=ballValue(picked,rent),relation=rangeRelation(rent,range),warn=relation==='above'||relation==='below';
  const sentence=subject==='listing'?listingRelationSentence(rent,range):relation?RELATION_TEXT[relation]:null;
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Typical rent for similar places</Text>
    {onUseRent?<RangeSlider range={range} value={shown} disabled={disabled} tone={warn&&picked===null?'warning':'normal'} applied={appliedButtonShows(shown,rent,appliedRent)} onChange={setPicked} onUse={r=>{onUseRent(r);}}/>:<RangeBar range={range} rent={rent}/>}
    {sentence?<Text accessibilityLiveRegion="polite" style={[styles.relation,warn&&styles.relationWarn]}>{sentence}</Text>:null}
    {relation&&subject==='asking'&&RELATION_HELP[relation]?<Text style={ui.supporting}>{RELATION_HELP[relation]}</Text>:null}
    <Text style={ui.supporting}>{RANGE_DISCLAIMER}</Text>
    {basisText?<Text style={ui.supporting}>Based on: {basisText}</Text>:null}
    <HowEstimated/>
  </View>;
}
const styles=StyleSheet.create({
  card:{gap:spacing.xs},flex:{flex:1},
  barWrap:{gap:spacing.xs},ends:{flexDirection:'row',justifyContent:'space-between'},endText:{...ui.body,fontWeight:'700'},
  bar:{height:32,marginHorizontal:spacing.xs,justifyContent:'center'},rail:{height:10,borderRadius:5,backgroundColor:colors.primaryPale,borderWidth:1,borderColor:colors.outline},
  marker:{position:'absolute',top:2,width:20,height:20,marginLeft:-10,borderRadius:10,backgroundColor:colors.primaryAction,borderWidth:3,borderColor:colors.white},markerWarn:{backgroundColor:colors.warning},
  relation:{...ui.body,fontWeight:'700',color:colors.primaryAction},relationWarn:{color:colors.warning},
  link:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},linkText:{...ui.supporting,color:colors.primaryAction,fontWeight:'600',textDecorationLine:'underline'},
  backdrop:{flex:1,justifyContent:'center',alignItems:'center',padding:spacing.lg,backgroundColor:colors.overlay},
  dialog:{width:'100%',maxWidth:360,backgroundColor:colors.background,borderRadius:radius.panel,padding:spacing.md,gap:spacing.xs,flexShrink:1},
  dialogHead:{flexDirection:'row',alignItems:'center',gap:spacing.xs},close:{width:48,height:48,alignItems:'center',justifyContent:'center'},dialogBody:{gap:spacing.sm,paddingBottom:spacing.xs},
});
