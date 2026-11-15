import {useRef,useState} from 'react';
import {PanResponder,Pressable,StyleSheet,Text,View,type AccessibilityActionEvent,type LayoutChangeEvent} from 'react-native';
import {colors} from '../theme/colors';
import {spacing} from '../theme/spacing';
import {ui} from '../theme/ui';
import {formatPeso} from '../models/Currency';
import {fractionOfValue,stepSliderValue,valueAtFraction,type RentalRange} from '../models/RentalRange';

const TOUCH=56,THUMB=32,RAIL=12,SIDE=16;
/**
 * Slide along the typical range to try a rent. Controlled: `value` is null until the first touch, and the ball is hidden while it is null,
 * so where it starts cannot hint at the middle. PanResponder only (no native dependency). The - and + buttons and the adjustable
 * accessibility actions do the same job for precision and for TalkBack.
 */
export function RangeSlider({range,value,onChange,onUse,disabled=false,tone='normal',applied=false}:{range:RentalRange;value:number|null;onChange:(rent:number)=>void;onUse:(rent:number)=>void;disabled?:boolean;tone?:'normal'|'warning';applied?:boolean}){
  const [width,setWidth]=useState(0);
  const live=useRef({width:0,range,onChange,disabled});live.current={width,range,onChange,disabled};
  const startX=useRef(0);
  const at=(x:number)=>{const {width:w,range:r}=live.current;if(w>0)live.current.onChange(valueAtFraction(x/w,r));};
  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>!live.current.disabled,onMoveShouldSetPanResponder:()=>!live.current.disabled,onPanResponderTerminationRequest:()=>false,
    onPanResponderGrant:e=>{startX.current=e.nativeEvent.locationX-SIDE;/* the touch area extends SIDE past the track on each side */at(startX.current);},
    onPanResponderMove:(_e,g)=>at(startX.current+g.dx),
  })).current;
  const step=(direction:1|-1)=>{if(!disabled)onChange(stepSliderValue(value,direction,range));};
  const onLayout=(e:LayoutChangeEvent)=>setWidth(e.nativeEvent.layout.width);
  const fraction=value===null?0:fractionOfValue(value,range),warn=tone==='warning';
  const unset=value===null;
  return <View style={styles.wrap}>
    <View style={styles.ends}><Text style={styles.endText}>{formatPeso(range.minimum)}</Text><Text style={styles.endText}>{formatPeso(range.maximum)}</Text></View>
    <View style={styles.track} onLayout={onLayout}>
      <View accessible={false} style={styles.rail}/>
      {!unset&&width>0?<>
        <View accessible={false} pointerEvents="none" style={[styles.bubble,warn&&styles.bubbleWarn,{left:Math.min(Math.max(fraction*width,36),Math.max(36,width-36))}]}><Text style={styles.bubbleText}>{formatPeso(value!)}</Text></View>
        <View accessible={false} pointerEvents="none" style={[styles.thumb,warn&&styles.thumbWarn,{left:fraction*width}]}/>
      </>:null}
      <View testID="range-slider-touch" accessible accessibilityRole="adjustable" accessibilityLabel="Rent to try" accessibilityHint="Swipe up or down to change the rent in 500 peso steps"
        accessibilityValue={{min:range.minimum,max:range.maximum,text:unset?'Not set':formatPeso(value!),...(unset?{}:{now:value!})}}
        accessibilityActions={[{name:'increment'},{name:'decrement'}]} accessibilityState={{disabled}}
        onAccessibilityAction={(e:AccessibilityActionEvent)=>step(e.nativeEvent.actionName==='increment'?1:-1)}
        style={styles.touch} {...pan.panHandlers}/>
    </View>
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" accessibilityLabel="Lower the rent by 500 pesos" disabled={disabled} style={[styles.step,disabled&&styles.off]} onPress={()=>step(-1)}><Text style={styles.stepText}>{'−'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={unset?'Use this rent, choose a rent on the slider first':applied?`Applied. Asking rent set to ${formatPeso(value!)}`:`Use ${formatPeso(value!)}`} accessibilityState={{disabled:disabled||unset,selected:applied}} disabled={disabled||unset} style={[styles.use,(disabled||unset)&&styles.useOff,applied&&styles.useApplied]} onPress={()=>{if(value!==null)onUse(value);}}><Text style={[styles.useText,(disabled||unset)&&styles.useTextOff,applied&&styles.useTextApplied]}>{unset?'Slide to pick a rent':applied?'\u2713 Applied':`Use ${formatPeso(value!)}`}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Raise the rent by 500 pesos" disabled={disabled} style={[styles.step,disabled&&styles.off]} onPress={()=>step(1)}><Text style={styles.stepText}>+</Text></Pressable>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:spacing.xs},
  ends:{flexDirection:'row',justifyContent:'space-between'},endText:{...ui.body,fontWeight:'700'},
  track:{height:TOUCH+20,marginHorizontal:SIDE,justifyContent:'center'},
  rail:{height:RAIL,borderRadius:RAIL/2,backgroundColor:colors.primaryPale,borderWidth:1,borderColor:colors.outline},
  thumb:{position:'absolute',top:(TOUCH+20-THUMB)/2,width:THUMB,height:THUMB,marginLeft:-THUMB/2,borderRadius:THUMB/2,backgroundColor:colors.primaryAction,borderWidth:4,borderColor:colors.white},
  thumbWarn:{backgroundColor:colors.warning},
  bubble:{position:'absolute',top:0,transform:[{translateX:-36}],minWidth:72,alignItems:'center',borderRadius:10,paddingVertical:4,paddingHorizontal:spacing.xs,backgroundColor:colors.ink},bubbleWarn:{backgroundColor:colors.warning},
  bubbleText:{...ui.supporting,color:colors.white,fontWeight:'700'},
  touch:{position:'absolute',left:-SIDE,right:-SIDE,top:10,height:TOUCH},
  buttons:{flexDirection:'row',gap:spacing.xs,alignItems:'center'},
  step:{width:52,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,borderWidth:1.5,borderColor:colors.controlBorder,backgroundColor:colors.background},off:{opacity:.5},
  stepText:{...ui.sectionTitle},
  use:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:colors.primaryAction,paddingHorizontal:spacing.sm},useOff:{backgroundColor:colors.surfaceStrong},
  useText:{...ui.body,color:colors.white,fontWeight:'700'},useTextOff:{color:colors.textSecondary},
  useApplied:{backgroundColor:colors.primaryPale,borderWidth:2,borderColor:colors.primaryAction},useTextApplied:{color:colors.primaryAction},
});
