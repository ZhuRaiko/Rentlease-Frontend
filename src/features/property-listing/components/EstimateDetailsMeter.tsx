import {StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
/** Plain count of range details filled, with a meter. No accuracy claim, and no list of what to add (the dots on the fields say that). */
export function EstimateDetailsMeter({filled,total}:{filled:number;total:number}){
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${filled} of ${total} range details filled`} accessibilityValue={{min:0,max:total,now:filled}} style={styles.wrap}>
    <View style={styles.track}><View style={[styles.fill,{width:`${total?Math.round(filled/total*100):0}%`}]}/></View>
    <Text style={ui.supporting}>{filled} of {total} range details filled</Text>
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:6},track:{height:6,borderRadius:3,overflow:'hidden',backgroundColor:colors.border},fill:{height:6,backgroundColor:colors.primaryAction}});
