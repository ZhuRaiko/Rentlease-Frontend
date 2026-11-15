import {Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {CONTINUE_STALLED_MESSAGE} from '../models/ListingCheck';
/** One amber line when Continue is still held after the wait, with a 48dp Continue to try again. Never shown while it is simply waiting. */
export function ContinueStalledLine({onContinue}:{onContinue:()=>void}){
  return <View accessibilityLiveRegion="polite" style={styles.line}>
    <Text style={[ui.supporting,styles.text]}>{CONTINUE_STALLED_MESSAGE}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Continue to Listing" onPress={onContinue} style={styles.retry}><Text style={styles.retryText}>Continue</Text></Pressable>
  </View>;
}
const styles=StyleSheet.create({
  line:{flexDirection:'row',alignItems:'center',gap:spacing.sm,minHeight:36,borderRadius:radius.panel,paddingHorizontal:spacing.sm,backgroundColor:colors.warningSurface,borderWidth:1,borderColor:colors.warning},
  text:{flex:1,color:colors.warning,fontWeight:'600'},
  retry:{minHeight:48,minWidth:48,alignItems:'flex-end',justifyContent:'center'},retryText:{...ui.supporting,color:colors.primaryAction,fontWeight:'700',textDecorationLine:'underline'},
});
