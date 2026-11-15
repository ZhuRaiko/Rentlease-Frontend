import {Text,StyleSheet} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
export const RANGE_LEGEND='feeds your range';
/** A green dot beside a field the price model reads. Fields it does not read never get one. The meaning is spoken by the label and written once by RangeLegend. */
export function EstimateMarker(){return <Text accessible={false} style={styles.dot}> {'●'}</Text>;}
/** The one line that explains the dot, shown once on the page. */
export function RangeLegend(){return <Text accessibilityLabel={`Fields marked with a dot ${RANGE_LEGEND}`} style={styles.legend}><Text accessible={false} style={styles.dot}>{'●'}</Text> {RANGE_LEGEND}</Text>;}
export function FieldLabel({label,required=false,usedInEstimate=false}:{label:string;required?:boolean;usedInEstimate?:boolean}) {
  const spoken=`${label}${required?', required':''}${usedInEstimate?`, ${RANGE_LEGEND}`:''}`;
  return <Text accessibilityLabel={spoken} style={ui.body}>{label}{required?<Text style={styles.required}> *</Text>:null}{usedInEstimate?<EstimateMarker/>:null}</Text>;
}
const styles=StyleSheet.create({required:{color:colors.restricted},dot:{fontSize:12,color:colors.primaryAction},legend:{...ui.supporting,color:colors.textSecondary}});
