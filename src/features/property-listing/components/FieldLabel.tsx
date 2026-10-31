import {Text,StyleSheet} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
export function FieldLabel({label,required=false}:{label:string;required?:boolean}) {
  return <Text accessibilityLabel={required?`${label}, required`:label} style={ui.body}>{label}{required?<Text style={styles.required}> *</Text>:null}</Text>;
}
const styles=StyleSheet.create({required:{color:colors.restricted}});
