import {StyleSheet,Text} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
/** Small confirmation beside a field label. Screen readers get the spoken announcement instead, so this is hidden from them. */
export function AppliedChip(){
  return <Text accessible={false} importantForAccessibility="no" style={styles.chip}>{'\u2713 Applied'}</Text>;
}
const styles=StyleSheet.create({chip:{...ui.supporting,color:colors.primaryAction,backgroundColor:colors.primaryPale,borderRadius:radius.pill,paddingVertical:2,paddingHorizontal:spacing.xs,fontWeight:'700',overflow:'hidden'}});
