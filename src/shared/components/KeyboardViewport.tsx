import {useCallback,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {Keyboard,Platform,StyleSheet,View} from 'react-native';
import {keyboardOverlap} from '../models/KeyboardGeometry';
export function KeyboardViewport({children}:PropsWithChildren){
 const frame=useRef<View|null>(null),top=useRef<number|null>(null),active=useRef(true),[overlap,setOverlap]=useState(0);
 const measure=useCallback(()=>{frame.current?.measureInWindow((_x,y,_w,height)=>{if(active.current)setOverlap(keyboardOverlap(y+height,top.current));});},[]);
 useEffect(()=>{active.current=true;if(Platform.OS!=='android')return;const show=Keyboard.addListener('keyboardDidShow',e=>{top.current=e.endCoordinates.screenY;measure();});const hide=Keyboard.addListener('keyboardDidHide',()=>{top.current=null;setOverlap(0);});const metrics=Keyboard.metrics();if(metrics){top.current=metrics.screenY;measure();}return()=>{active.current=false;show.remove();hide.remove();};},[measure]);
 return <View ref={frame} collapsable={false} style={styles.frame} onLayout={measure}><View style={[styles.frame,{marginBottom:overlap}]}>{children}</View></View>;
}
const styles=StyleSheet.create({frame:{flex:1}});
