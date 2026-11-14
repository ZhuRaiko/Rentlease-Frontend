import type {ReactNode} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
/** Always-open card for the wizard. `highlight` is the green estimate treatment: primaryPale fill and a 2dp primary border. */
export function PostingCard({title,tag,message,highlight=false,children}:{title?:string|undefined;tag?:string|undefined;message?:string|null|undefined;highlight?:boolean;children:ReactNode}){
  return <View style={[styles.card,highlight&&styles.highlight]}>
    {title?<View style={styles.head}><Text accessibilityRole="header" style={[ui.sectionTitle,styles.title]}>{title}</Text>{tag?<Text style={styles.tag}>{tag}</Text>:null}</View>:null}
    {message?<Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>:null}
    {children}
  </View>;
}
const styles=StyleSheet.create({
  card:{borderWidth:1,borderColor:colors.outline,borderRadius:radius.panel,padding:spacing.md,gap:spacing.sm,backgroundColor:colors.background},
  highlight:{borderWidth:2,borderColor:colors.primary,backgroundColor:colors.primaryPale},
  head:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.xs},title:{flexShrink:1},
  tag:{...ui.supporting,color:colors.primaryAction,backgroundColor:colors.background,borderRadius:radius.pill,paddingVertical:2,paddingHorizontal:spacing.xs,fontWeight:'600'},
  message:{...ui.supporting,color:colors.restricted},
});
