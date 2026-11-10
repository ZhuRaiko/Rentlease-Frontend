import {View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
/** Small decorative native line shapes; surrounding text supplies semantics. */
export function TenancyDashboardIcon({kind}:{kind:'upcoming'|'active'|'history'|'maintenance'|'help'}){
 const line={position:'absolute' as const,backgroundColor:colors.primaryAction,borderRadius:2};
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:38,height:38,borderRadius:12,backgroundColor:colors.primaryPale,alignItems:'center',justifyContent:'center'}}>
 {kind==='upcoming'?<View style={{width:21,height:20,borderWidth:2,borderColor:colors.primaryAction,borderRadius:4}}><View style={[line,{height:2,left:0,right:0,top:5}]}/><View style={[line,{width:2,height:6,left:4,top:-4}]}/><View style={[line,{width:2,height:6,right:4,top:-4}]}/></View>:kind==='active'?<><View style={{position:'absolute',width:18,height:18,borderLeftWidth:2,borderTopWidth:2,borderColor:colors.primaryAction,transform:[{rotate:'45deg'}],top:9}}/><View style={{width:19,height:16,borderWidth:2,borderTopWidth:0,borderColor:colors.primaryAction,marginTop:10,borderRadius:2}}/></>:kind==='maintenance'?<View style={{width:5,height:24,borderRadius:3,backgroundColor:colors.primaryAction,transform:[{rotate:'40deg'}]}}/>:<View style={{width:23,height:23,borderWidth:2,borderColor:colors.primaryAction,borderRadius:14}}><View style={[line,{width:2,height:kind==='help'?8:7,left:9,top:7}]}/><View style={[line,kind==='help'?{width:2,height:2,left:9,top:3}:{width:6,height:2,left:9,top:12}]}/></View>}
 </View>;
}
