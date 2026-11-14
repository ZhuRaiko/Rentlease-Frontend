import {Text,StyleSheet} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
/** Small marker for a field the price estimator reads. Fields it does not read never get one. */
export function EstimateMarker(){return <Text style={styles.marker}> Used in estimate</Text>;}
export function FieldLabel({label,required=false,usedInEstimate=false}:{label:string;required?:boolean;usedInEstimate?:boolean}) {
  const spoken=`${label}${required?', required':''}${usedInEstimate?', used in estimate':''}`;
  return <Text accessibilityLabel={spoken} style={ui.body}>{label}{required?<Text style={styles.required}> *</Text>:null}{usedInEstimate?<EstimateMarker/>:null}</Text>;
}
const styles=StyleSheet.create({required:{color:colors.restricted},marker:{...ui.supporting,fontSize:12,color:colors.primaryAction,fontWeight:'600'}});
