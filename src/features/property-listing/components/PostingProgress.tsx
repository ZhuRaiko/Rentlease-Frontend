import {Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
const labels=['Property','Listing','Price','Review'];
/** Four segmented bars, then "Step N of 4 \u00b7 Name". Font scaling is never reduced; the name wraps instead. */
export function PostingProgress({step}:{step:1|2|3|4}){
  return <View accessibilityLabel={`Posting step ${step} of 4: ${labels[step-1]}. Property, Listing, Price, Review.`} style={{paddingHorizontal:20,gap:6,paddingBottom:10}}>
    {/* The segment row stays the second child, which the tests pin. */}
    <View accessible={false} style={{height:2}}/>
    <View style={{flexDirection:'row',gap:6}}>{labels.map((label,i)=><View key={label} accessible={false} style={{flex:1,minWidth:0}}><View style={{height:5,borderRadius:3,backgroundColor:i<step?colors.primaryAction:colors.border}}/></View>)}</View>
    <Text style={ui.supporting}>Step {step} of 4{' \u00b7 '}<Text style={{fontWeight:'700',color:colors.primaryAction}}>{labels[step-1]}</Text></Text>
  </View>;
}
