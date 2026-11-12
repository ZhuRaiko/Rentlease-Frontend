import {Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {postingColumnCount} from '../models/PostingPresentation';

export function PostingChoices<T extends string>({options,value,disabled,onChange,label}:{options:readonly {label:string;value:T}[];value:T|null;disabled:boolean;onChange:(value:T)=>void;label:string}) {
  const {width,fontScale}=useWindowDimensions(),columns=postingColumnCount(width,fontScale);
  return <View accessibilityLabel={label} style={styles.grid}>{options.map(o=><Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{checked:value===o.value,disabled}} disabled={disabled} onPress={()=>onChange(o.value)} style={({pressed})=>[styles.option,{flexBasis:columns===1?'100%':'47%'},value===o.value&&styles.selected,pressed&&!disabled&&{opacity:0.75},disabled&&{opacity:0.65}]}><Text style={[styles.label,value===o.value&&styles.selectedLabel]}>{o.label}</Text></Pressable>)}</View>;
}
const styles=StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{flexGrow:1,minWidth:0,minHeight:48,paddingHorizontal:12,paddingVertical:10,borderWidth:1,borderColor:colors.outline,borderRadius:10,justifyContent:'center'},selected:{backgroundColor:colors.primaryPale,borderColor:colors.primaryAction},label:{...ui.supporting,fontWeight:'600'},selectedLabel:{color:colors.primaryAction}});
