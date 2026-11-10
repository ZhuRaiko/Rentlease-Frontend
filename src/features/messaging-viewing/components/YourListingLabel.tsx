import {Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
/** Render only after both listing and physical-property ownership are verified. */
export function YourListingLabel({owned}:{owned:boolean}){return owned?<View style={{flexDirection:'row',alignItems:'center',gap:5}}><View accessible={false} style={{width:10,height:9,borderWidth:1,borderColor:colors.primaryAction}}><View style={{width:8,height:8,borderLeftWidth:1,borderTopWidth:1,borderColor:colors.primaryAction,transform:[{rotate:'45deg'}],position:'absolute',top:-5}}/></View><Text style={{fontSize:12,color:colors.primaryAction}}>Your listing</Text></View>:null;}
