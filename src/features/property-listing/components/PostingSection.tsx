import {useEffect,useState,type ReactNode} from 'react';
import {Keyboard,Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';

/** Children stay mounted: closing a panel never resets form or media state. */
export function PostingSection({title,summary,children,initiallyOpen=false,revealId,plain=false}:{title:string;summary?:string|undefined;children:ReactNode;initiallyOpen?:boolean;revealId?:number|undefined;plain?:boolean}) {
  const [open,setOpen]=useState(initiallyOpen),[revealed,setRevealed]=useState<number|undefined>();
  const reveal=revealId!==undefined&&revealId!==revealed,expanded=open||reveal;
  // Reveal during this render, then retain the open state before the focus frame.
  useEffect(()=>{if(reveal){setOpen(true);setRevealed(revealId);}},[reveal,revealId]);
  return <View style={plain?styles.plain:styles.panel}>
    <Pressable accessibilityRole="button" accessibilityLabel={summary?`${title}. ${summary}`:title} accessibilityHint={expanded?'Collapse section':'Expand section'} accessibilityState={{expanded}} onPress={()=>{if(expanded)Keyboard.dismiss();setOpen(!expanded);}} style={styles.header}>
      <View style={styles.copy}><Text style={plain?ui.supporting:ui.sectionTitle}>{title}</Text>{summary?<Text style={styles.summary}>{summary}</Text>:null}</View>
      <Text accessible={false} style={styles.chevron}>{expanded?'−':'+'}</Text>
    </Pressable>
    <View accessibilityElementsHidden={!expanded} importantForAccessibility={expanded?'auto':'no-hide-descendants'} style={[styles.body,!expanded&&styles.hidden]}>{children}</View>
  </View>;
}
const styles=StyleSheet.create({
  panel:{borderWidth:1,borderColor:colors.outline,borderRadius:12,backgroundColor:colors.background},plain:{gap:0},
  header:{flexDirection:'row',alignItems:'center',gap:12,minHeight:56,padding:14},copy:{flex:1,minWidth:0,gap:3},
  summary:{...ui.supporting,color:colors.textSecondary},chevron:{...ui.sectionTitle,color:colors.textSecondary,minWidth:24,textAlign:'center'},
  body:{paddingHorizontal:14,paddingBottom:16,gap:12},hidden:{display:'none'},
});
