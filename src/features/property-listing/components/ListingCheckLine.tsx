import {useEffect,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {CHECK_STALL_MS,listingCheckLine,type ListingCheckState} from '../models/ListingCheck';
/** One slim line: quiet while the check runs, amber with Retry when it failed or has run too long. Typing is never held by it. */
export function ListingCheckLine({state,onRetry}:{state:ListingCheckState;onRetry:()=>void}){
  const [stalled,setStalled]=useState(false);
  useEffect(()=>{setStalled(false);if(state!=='checking')return;const id=setTimeout(()=>setStalled(true),CHECK_STALL_MS);return()=>clearTimeout(id);},[state]);
  const line=listingCheckLine(state,stalled);
  if(!line)return null;
  const failed=line.kind==='failed';
  return <View accessibilityLiveRegion="polite" style={[styles.line,failed&&styles.failed]}>
    <Text style={[ui.supporting,styles.text,failed&&styles.failedText]}>{line.text}</Text>
    {line.retry?<Pressable accessibilityRole="button" accessibilityLabel="Retry checking this listing" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>:null}
  </View>;
}
const styles=StyleSheet.create({
  line:{flexDirection:'row',alignItems:'center',gap:spacing.sm,minHeight:36,borderRadius:radius.panel,paddingHorizontal:spacing.sm,backgroundColor:colors.surface},
  failed:{backgroundColor:colors.warningSurface,borderWidth:1,borderColor:colors.warning},
  text:{flex:1,color:colors.textSecondary},failedText:{color:colors.warning,fontWeight:'600'},
  retry:{minHeight:48,minWidth:48,alignItems:'flex-end',justifyContent:'center'},retryText:{...ui.supporting,color:colors.primaryAction,fontWeight:'700',textDecorationLine:'underline'},
});
