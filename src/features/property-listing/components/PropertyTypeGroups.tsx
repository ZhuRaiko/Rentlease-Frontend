import {StyleSheet,Text,View} from 'react-native';
import {RANGE_PROPERTY_TYPES} from '../../../shared/models/RentalEstimateEligibility';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {propertyTypeOptions} from '../models/DraftProperty';
import {GROUP_OWN_PRICE_LABEL,GROUP_RANGE_LABEL} from '../models/PostingEstimate';
import {PostingChoices} from './PostingChoices';
/**
 * All nine types stay visible, in two labeled groups: the ones that get a typical-rent range and the ones the owner prices. The split is read from
 * the shared estimator list (RANGE_PROPERTY_TYPES), never from a second list here.
 */
export function PropertyTypeGroups({value,disabled,onChange}:{value:string|null;disabled:boolean;onChange:(value:string)=>void}){
  const withRange=RANGE_PROPERTY_TYPES.map(type=>propertyTypeOptions.find(o=>o.value===type)).filter((o):o is NonNullable<typeof o>=>!!o);
  const ownPrice=propertyTypeOptions.filter(o=>!RANGE_PROPERTY_TYPES.includes(o.value));
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={[styles.badge,styles.range]}>{GROUP_RANGE_LABEL}</Text>
    <PostingChoices label={`Property type, ${GROUP_RANGE_LABEL.toLowerCase()}`} options={withRange} value={value as never} disabled={disabled} onChange={v=>onChange(v)}/>
    <Text accessibilityRole="header" style={[styles.badge,styles.own]}>{GROUP_OWN_PRICE_LABEL}</Text>
    <PostingChoices label={`Property type, ${GROUP_OWN_PRICE_LABEL.toLowerCase()}`} options={ownPrice} value={value as never} disabled={disabled} onChange={v=>onChange(v)}/>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:spacing.sm},
  badge:{...ui.supporting,alignSelf:'flex-start',fontWeight:'700',borderRadius:radius.pill,paddingVertical:3,paddingHorizontal:spacing.sm,overflow:'hidden'},
  range:{color:colors.primaryAction,backgroundColor:colors.primaryPale},own:{color:colors.warning,backgroundColor:colors.warningSurface},
});
