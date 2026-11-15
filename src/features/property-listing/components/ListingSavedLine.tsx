import {StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
/** "Property saved ✓": one slim quiet line, not a card. It takes the place of the check line while the check is fine. */
export function ListingSavedLine({text}:{text:string}){
  return <View accessibilityLiveRegion="polite" style={styles.line}><Text style={[ui.supporting,styles.text]}>{text}</Text></View>;
}
const styles=StyleSheet.create({
  line:{flexDirection:'row',alignItems:'center',minHeight:36,borderRadius:radius.panel,paddingHorizontal:spacing.sm,backgroundColor:colors.surface},
  text:{flex:1,color:colors.textSecondary},
});
