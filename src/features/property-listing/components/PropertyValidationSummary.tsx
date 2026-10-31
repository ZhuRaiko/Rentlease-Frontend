import {Pressable,StyleSheet,Text,View} from 'react-native';
import {propertySectionLabels,type PropertyValidationIssue} from '../models/DraftProperty';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {colors} from '../../../shared/theme/colors';
export function PropertyValidationSummary({issues=[],onSelect}:{issues:PropertyValidationIssue[];onSelect:(issue:PropertyValidationIssue)=>void}) {
  const sections=issues.filter((issue,index)=>issues.findIndex(other=>other.section===issue.section)===index);
  if(!sections.length)return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Before saving the property</Text>
    <Text style={ui.supporting}>Complete required information and correct inconsistent optional information. Listing completeness does not confirm that the property is valid or saved.</Text>
    {sections.map(issue=><Pressable key={issue.section} accessibilityRole="button" accessibilityLabel={`Review ${propertySectionLabels[issue.section]}`} onPress={()=>onSelect(issue)} style={styles.link}>
      <Text style={styles.label}>{propertySectionLabels[issue.section]}</Text>
      <Text style={ui.supporting}>{issues.some(other=>other.section===issue.section&&other.kind==='required')?'Required information missing':'Check entered information'}</Text>
    </Pressable>)}
  </View>;
}
const styles=StyleSheet.create({section:{gap:spacing.xs},link:{minHeight:48,paddingVertical:spacing.xs},label:{...ui.body,color:colors.primaryAction,fontWeight:'600'}});
