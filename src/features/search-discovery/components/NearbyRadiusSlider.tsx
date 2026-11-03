import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';

export const sliderRadius = (position: number, width: number) => Math.min(20,Math.max(1,Math.round(1+19*Math.max(0,Math.min(width,position))/Math.max(1,width))));

// Core React Native only: dragging previews locally; release/adjustable actions
// commit once. Termination cancels, so scrolling or Back never starts a search.
export function NearbyRadiusSlider({value,disabled=false,onComplete,compact=false}:{value:number;disabled?:boolean;onComplete:(value:number)=>void;compact?:boolean}) {
  const [draft,setDraft]=useState(value), [width,setWidth]=useState(1);
  const current=useRef({value,disabled,onComplete});current.current={value,disabled,onComplete};
  const geometry=useRef({width:1,start:0,draft:value,editing:false});
  useEffect(()=>{if(!geometry.current.editing){geometry.current.draft=value;setDraft(value);}},[value]);
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>!current.current.disabled,
    onPanResponderGrant:event=>{const g=geometry.current;g.editing=true;g.start=event.nativeEvent.locationX;g.draft=sliderRadius(g.start,g.width);setDraft(g.draft);},
    onPanResponderMove:(_event,gesture)=>{const g=geometry.current;g.draft=sliderRadius(g.start+gesture.dx,g.width);setDraft(g.draft);},
    onPanResponderRelease:()=>{const g=geometry.current;g.editing=false;if(!current.current.disabled&&g.draft!==current.current.value)current.current.onComplete(g.draft);},
    onPanResponderTerminate:()=>{geometry.current.editing=false;geometry.current.draft=current.current.value;setDraft(current.current.value);},
  }),[]);
  return <View style={styles.group}>
    <Text accessibilityLiveRegion="polite" style={[styles.label,compact&&styles.compactLabel]}>{compact?'Radius':'Search within'} {draft} km</Text>
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel="Nearby search radius" accessibilityHint="Adjust from 1 to 20 kilometers. Release to search."
      accessibilityState={{disabled}} accessibilityValue={{min:1,max:20,now:draft,text:`${draft} kilometers`}}
      accessibilityActions={[{name:'increment',label:'Increase radius by 1 kilometer'},{name:'decrement',label:'Decrease radius by 1 kilometer'}]}
      onAccessibilityAction={event=>{const action=event.nativeEvent.actionName;if(disabled||(action!=='increment'&&action!=='decrement'))return;const next=Math.min(20,Math.max(1,value+(action==='increment'?1:-1)));if(next!==value)onComplete(next);}}
      onLayout={event=>{const measured=Math.max(1,event.nativeEvent.layout.width);geometry.current.width=measured;setWidth(measured);}} style={[styles.control,disabled&&styles.disabled]}>
      <View pointerEvents="none" style={styles.track}/>
      <View pointerEvents="none" style={[styles.fill,{width:(draft-1)/19*width}]}/>
      <View pointerEvents="none" style={[styles.thumb,{left:Math.max(0,Math.min(width-24,(draft-1)/19*width-12))}]}/>
    </View>
    {!compact?<View style={styles.ends}><Text style={styles.copy}>1 km</Text><Text style={styles.copy}>20 km</Text></View>:null}
  </View>;
}
const styles=StyleSheet.create({group:{gap:spacing.xs},label:{...ui.sectionTitle},compactLabel:{...ui.supporting,fontWeight:'600',color:colors.ink},copy:{...ui.supporting},control:{height:48,justifyContent:'center'},track:{height:4,backgroundColor:colors.outline,borderRadius:2},fill:{height:4,backgroundColor:colors.primaryAction,position:'absolute',borderRadius:2},thumb:{position:'absolute',width:24,height:24,borderRadius:12,backgroundColor:colors.primaryAction},ends:{flexDirection:'row',justifyContent:'space-between'},disabled:{opacity:0.5}});
