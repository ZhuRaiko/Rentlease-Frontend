import {memo,useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ActivityIndicator,Animated,Image,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import type {PropertyPhoto} from '../models/PropertyPhoto';
import {movePhotoIds,photoDropIndex} from '../models/PropertyPhotoGrid';
const GAP=10;
type Pending={uri:string;label:string};
interface Props{photos:PropertyPhoto[];pending:Pending[];disabled:boolean;canAdd:boolean;onAdd:()=>void;onOpen:(id:string)=>void;onReorder:(ids:string[])=>void;header?:ReactNode;footer?:ReactNode}
interface CellProps{photo:PropertyPhoto;loadImage:boolean;index:number;size:number;active:boolean;target:boolean;disabled:boolean;shift:Animated.ValueXY;start:(index:number)=>void;move:(x:number,y:number,absoluteY:number)=>void;finish:()=>void;cancel:()=>void;open:(id:string)=>void;accessibleMove:(index:number,step:number)=>void}
const PhotoCell=memo(function PhotoCell(p:CellProps){
 const started=useRef(0),[loading,setLoading]=useState(true);
 const pan=useMemo(()=>Gesture.Pan().enabled(!p.disabled).activateAfterLongPress(350).runOnJS(true)
  .onStart(()=>p.start(p.index))
  .onUpdate(e=>p.move(e.translationX,e.translationY,e.absoluteY))
  .onEnd(()=>p.finish()).onFinalize(()=>p.cancel()),[p.disabled,p.index,p.start,p.move,p.finish,p.cancel]);
 return <GestureDetector gesture={pan}><Animated.View style={[styles.tile,{width:p.size,height:p.size,left:(p.index%2)*(p.size+GAP),top:Math.floor(p.index/2)*(p.size+GAP),zIndex:p.active?10:0},p.target&&styles.target,p.active&&{transform:p.shift.getTranslateTransform(),opacity:.85}]}>
  <Pressable style={styles.fill} disabled={p.disabled} accessibilityRole="button" accessibilityLabel={`Photo ${p.index+1}${p.photo.is_cover?', Cover':''}${p.photo.alt_text?`, ${p.photo.alt_text}`:''}`} accessibilityHint="Tap to edit. Touch and hold to move. Use accessibility actions to change position."
   accessibilityState={{disabled:p.disabled}} accessibilityActions={[{name:'activate',label:'Edit photo'},{name:'decrement',label:'Move earlier'},{name:'increment',label:'Move later'}]}
   onAccessibilityAction={e=>{if(p.disabled)return;if(e.nativeEvent.actionName==='activate')p.open(p.photo.id);else if(e.nativeEvent.actionName==='decrement')p.accessibleMove(p.index,-1);else if(e.nativeEvent.actionName==='increment')p.accessibleMove(p.index,1);}}
   onPress={()=>p.open(p.photo.id)}>
   {p.loadImage?<Image source={{uri:p.photo.publicUrl}} resizeMode="cover" resizeMethod="resize" style={styles.fill} onLoadStart={()=>{started.current=Date.now();setLoading(true);}} onLoadEnd={()=>{setLoading(false);if(typeof __DEV__!=='undefined'&&__DEV__)console.info('[PHOTO-PERF]',{stage:'image',durationMs:Date.now()-started.current});}} />:null}
   {loading?<ActivityIndicator style={styles.loader} color={colors.textMuted}/>:null}
   <View pointerEvents="none" style={styles.labels}><Text style={styles.badge}>{p.photo.is_cover?'Cover':p.index+1}</Text><View style={styles.grip}>{[0,1,2,3,4,5].map(i=><View key={i} style={styles.dot}/>)}</View></View>
  </Pressable>
 </Animated.View></GestureDetector>;
});
/** At most ten mounted thumbnails. Drag animation does not re-render on every movement. */
export function PropertyPhotoGrid(props:Props){
 const latest=useRef(props);latest.current=props;
 const scroll=useRef<ScrollView>(null),viewport=useRef<View>(null),scrollY=useRef(0),contentHeight=useRef(0),bounds=useRef({top:0,height:0});
 const shift=useRef(new Animated.ValueXY()).current;
 const drag=useRef<{from:number;to:number;startScroll:number;x:number;y:number;edge:number;ids:string[]}|null>(null);
 const frame=useRef<number|null>(null),mounted=useRef(true),blockedUntil=useRef(0);
 const [viewportHeight,setViewportHeight]=useState(0),[scrollRow,setScrollRow]=useState(0),[gridTop,setGridTop]=useState(0);
 const [width,setWidth]=useState(0),[active,setActive]=useState<number|null>(null),[target,setTarget]=useState<number|null>(null);
 const size=(width-GAP)/2;const geometry=useRef(size);geometry.current=size;
 const stop=useCallback(()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;if(drag.current)blockedUntil.current=Date.now()+250;drag.current=null;shift.setValue({x:0,y:0});if(mounted.current){setActive(null);setTarget(null);}},[shift]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop();};},[stop]);
 const update=useCallback(()=>{const d=drag.current;if(!d)return;const delta=scrollY.current-d.startScroll;shift.setValue({x:d.x,y:d.y+delta});const to=photoDropIndex(d.from,d.x,d.y,delta,geometry.current,GAP,d.ids.length);if(to!==d.to){d.to=to;setTarget(to);}},[shift]);
 const tick=useCallback(function tick(){const d=drag.current;if(!d)return;const next=Math.max(0,Math.min(contentHeight.current-bounds.current.height,scrollY.current+d.edge));if(d.edge&&next!==scrollY.current){scrollY.current=next;scroll.current?.scrollTo({y:next,animated:false});update();}frame.current=requestAnimationFrame(tick);},[update]);
 const start=useCallback((from:number)=>{if(latest.current.disabled)return;blockedUntil.current=Infinity;drag.current={from,to:from,startScroll:scrollY.current,x:0,y:0,edge:0,ids:latest.current.photos.map(p=>p.id)};setActive(from);setTarget(from);viewport.current?.measureInWindow((_x,y,_w,h)=>{bounds.current={top:y,height:h};});frame.current=requestAnimationFrame(tick);},[tick]);
 const move=useCallback((x:number,y:number,absoluteY:number)=>{const d=drag.current;if(!d)return;d.x=x;d.y=y;const b=bounds.current;d.edge=absoluteY<b.top+64?-7:absoluteY>b.top+b.height-64?7:0;update();},[update]);
 const finish=useCallback(()=>{const d=drag.current;if(!d)return;const same=d.ids.join('|')===latest.current.photos.map(p=>p.id).join('|');const ids=movePhotoIds(d.ids,d.from,d.to);stop();if(mounted.current&&same&&!latest.current.disabled&&d.from!==d.to)latest.current.onReorder(ids);},[stop]);
 const open=useCallback((id:string)=>{if(Date.now()<blockedUntil.current)return;latest.current.onOpen(id);},[]);
 const accessibleMove=useCallback((from:number,step:number)=>{const ids=latest.current.photos.map(p=>p.id),to=from+step;if(!latest.current.disabled&&to>=0&&to<ids.length)latest.current.onReorder(movePhotoIds(ids,from,to));},[]);
 useEffect(()=>{if(props.disabled&&drag.current)stop();},[props.disabled,stop]);
 const total=props.photos.length+props.pending.length+Number(props.canAdd);
 return <View ref={viewport} style={styles.root} onLayout={()=>viewport.current?.measureInWindow((_x,y,_w,h)=>{bounds.current={top:y,height:h};setViewportHeight(h);})}>
  <ScrollView ref={scroll} scrollEnabled={active===null} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} onScroll={e=>{scrollY.current=e.nativeEvent.contentOffset.y;setScrollRow(Math.floor(scrollY.current/Math.max(1,size+GAP)));}} scrollEventThrottle={16} onContentSizeChange={(_w,h)=>{contentHeight.current=h;}}>
   {props.header}
   <View onLayout={e=>{const w=e.nativeEvent.layout.width;setGridTop(e.nativeEvent.layout.y);if(w!==width){if(drag.current)stop();setWidth(w);}}} style={{height:size>0?Math.ceil(total/2)*(size+GAP):0}}>
    {size>0?props.photos.map((photo,index)=><PhotoCell key={photo.id} photo={photo} loadImage={active===index||(gridTop+Math.floor(index/2)*(size+GAP)+size>=scrollRow*(size+GAP)&&gridTop+Math.floor(index/2)*(size+GAP)<=scrollRow*(size+GAP)+(viewportHeight||600)+size)} index={index} size={size} active={active===index} target={target===index&&active!==index} disabled={props.disabled} shift={shift} start={start} move={move} finish={finish} cancel={stop} open={open} accessibleMove={accessibleMove}/>):null}
    {size>0?props.pending.map((p,i)=>{const index=props.photos.length+i;return <View key={`pending-${i}`} style={[styles.tile,{width:size,height:size,left:(index%2)*(size+GAP),top:Math.floor(index/2)*(size+GAP)}]}><Image source={{uri:p.uri}} resizeMethod="resize" style={[styles.fill,{opacity:.5}]}/><Text accessibilityLiveRegion="polite" style={styles.pending}>{p.label}</Text></View>;}):null}
    {size>0&&props.canAdd?<Pressable accessibilityRole="button" accessibilityLabel="Add property photos" disabled={props.disabled} accessibilityState={{disabled:props.disabled}} onPress={props.onAdd} style={[styles.tile,styles.add,{width:size,height:size,left:((total-1)%2)*(size+GAP),top:Math.floor((total-1)/2)*(size+GAP)},props.disabled&&{opacity:.5}]}><Text style={styles.plus}>+</Text><Text style={styles.copy}>Add Photos</Text></Pressable>:null}
   </View>
   {props.footer}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({root:{flex:1},content:{padding:16,gap:12,width:'100%',maxWidth:460,alignSelf:'center',flexGrow:1},tile:{position:'absolute',borderRadius:10,backgroundColor:colors.background,borderWidth:1,borderColor:colors.border},fill:{width:'100%',height:'100%',borderRadius:9},target:{borderWidth:2,borderColor:colors.primaryAction,borderStyle:'dashed'},labels:{position:'absolute',left:6,right:6,bottom:6,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'},badge:{...ui.body,fontSize:12,color:colors.text,backgroundColor:colors.surface,paddingHorizontal:6,paddingVertical:3,borderRadius:4},grip:{width:22,padding:5,flexDirection:'row',flexWrap:'wrap',gap:2,backgroundColor:colors.surface,borderRadius:4},dot:{width:4,height:4,borderRadius:2,backgroundColor:colors.textMuted},loader:{position:'absolute',alignSelf:'center',top:'42%'},add:{alignItems:'center',justifyContent:'center',borderStyle:'dashed',padding:8},copy:{...ui.body,textAlign:'center'},plus:{fontSize:28,color:colors.primaryAction},pending:{...ui.body,position:'absolute',bottom:6,left:6,right:6,backgroundColor:colors.surface,padding:4,textAlign:'center'}});
