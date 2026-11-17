import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {ui} from '../theme/ui';

/**
 * The quiet refresh line for a screen that already shows data: a small spinner while a background refresh runs, and, when the refresh failed,
 * "Couldn't refresh. Retry" (the data stays). Nothing is drawn when idle. It never replaces content.
 */
export const REFRESH_FAILED = "Couldn't refresh.";
export function RefreshHint({refreshing,failed,onRetry}:{refreshing:boolean;failed:boolean;onRetry:()=>void}){
  if(failed&&!refreshing)return <View style={styles.row}><Text accessibilityLiveRegion="polite" style={ui.supporting}>{REFRESH_FAILED}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry refreshing" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
  if(!refreshing)return null;
  return <View accessibilityLiveRegion="polite" accessibilityLabel="Refreshing" style={styles.row}><ActivityIndicator size="small" color={colors.primaryAction}/></View>;
}
/** A fixed-size grey block that stands where content will be, so nothing jumps when the real content arrives. */
export function SkeletonBlock({width,height,radius=8,style}:{width?:number|string;height:number;radius?:number;style?:object}){
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[{height,borderRadius:radius,backgroundColor:colors.surface},width===undefined?{alignSelf:'stretch'}:{width:width as number},style]}/>;
}
const styles=StyleSheet.create({
  row:{minHeight:28,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:spacing.xs},
  retry:{minHeight:48,minWidth:48,paddingHorizontal:spacing.sm,alignItems:'center',justifyContent:'center'},
  retryText:{...ui.body,color:colors.primaryAction,fontWeight:'700'},
});
