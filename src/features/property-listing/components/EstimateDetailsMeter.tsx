import {StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
/** Plain count of estimate details filled, with a meter. No accuracy claim. */
export function EstimateDetailsMeter({filled,total,missing=[]}:{filled:number;total:number;missing?:string[]}){
  const names=missing.length>3?`${missing.slice(0,3).join(', ')} and ${missing.length-3} more`:missing.length>1?`${missing.slice(0,-1).join(', ')} and ${missing.at(-1)}`:missing[0];
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${filled} of ${total} estimate details filled`} accessibilityValue={{min:0,max:total,now:filled}} style={styles.wrap}>
    <View style={styles.track}><View style={[styles.fill,{width:`${total?Math.round(filled/total*100):0}%`}]}/></View>
    <Text style={ui.supporting}>{filled} of {total} filled.{names?` Add ${names} to complete.`:' Every estimate detail is filled.'}</Text>
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:6},track:{height:6,borderRadius:3,overflow:'hidden',backgroundColor:colors.border},fill:{height:6,backgroundColor:colors.primaryAction}});
