import {StyleSheet,Text} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
/** Quiet informational line (wireframe "info"). Never an error or success state. */
export function InfoNote({message}:{message:string}){
  return <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text>;
}
const styles=StyleSheet.create({note:{...ui.supporting,backgroundColor:colors.identitySurface,color:colors.identityInk,borderRadius:radius.control,paddingVertical:spacing.sm,paddingHorizontal:spacing.md}});
