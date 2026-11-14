import {Pressable,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
const labels=['Property','Listing','Price','Review'];
/**
 * Four segmented bars, then "Step N of 4 \u00b7 Name". Font scaling is never reduced; the name wraps instead.
 * With `onSelect` each bar is a 48dp-tall button for its step; the current step is not a button.
 */
export function PostingProgress({step,onSelect}:{step:1|2|3|4;onSelect?:((step:1|2|3|4)=>void)|undefined}){
  return <View accessibilityLabel={`Posting step ${step} of 4: ${labels[step-1]}. Property, Listing, Price, Review.`} style={{paddingHorizontal:20,gap:6,paddingBottom:10}}>
    {/* The segment row stays the second child, which the tests pin. */}
    <View accessible={false} style={{height:2}}/>
    <View style={{flexDirection:'row',gap:6}}>{labels.map((label,i)=>{
      const n=(i+1) as 1|2|3|4,bar=<View style={{height:5,borderRadius:3,backgroundColor:i<step?colors.primaryAction:colors.border}}/>;
      return onSelect&&n!==step
        ?<Pressable key={label} accessibilityRole="button" accessibilityLabel={`Go to step ${n} of 4, ${label}`} onPress={()=>onSelect(n)} style={{flex:1,minWidth:0,minHeight:48,justifyContent:'center'}}>{bar}</Pressable>
        :<View key={label} accessible={false} style={{flex:1,minWidth:0,...(onSelect?{minHeight:48,justifyContent:'center' as const}:null)}}>{bar}</View>;
    })}</View>
    <Text style={ui.supporting}>Step {step} of 4{' \u00b7 '}<Text style={{fontWeight:'700',color:colors.primaryAction}}>{labels[step-1]}</Text></Text>
  </View>;
}
