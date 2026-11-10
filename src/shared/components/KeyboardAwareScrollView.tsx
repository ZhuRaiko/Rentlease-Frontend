import {forwardRef,useCallback,useEffect,useRef} from 'react';
import {Keyboard,ScrollView,TextInput,type ScrollViewProps} from 'react-native';
import {focusedScrollOffset} from '../models/KeyboardGeometry';
// Measure the focused child against this scroll viewport and keyboard. The
// outer viewport handles window overlap; no keyboard-height padding is added.
export const KeyboardAwareScrollView=forwardRef<ScrollView,ScrollViewProps>(function KeyboardAwareScrollView(props,ref){
 const scroll=useRef<ScrollView|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),offset=useRef(0),focused=useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
 const reveal=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{
  const input=TextInput.State.currentlyFocusedInput(),host=scroll.current?.getNativeScrollRef();
  if(!input||input!==focused.current||!Keyboard.isVisible()||!host)return;
  host.measureInWindow((_x,y,_w,height)=>{input.measureInWindow((_ix,iy,_iw,ih)=>{if(input!==TextInput.State.currentlyFocusedInput()||input!==focused.current)return;const target=focusedScrollOffset(iy,iy+ih,y,Math.min(y+height,Keyboard.metrics()?.screenY??y+height),offset.current);if(target!==null)scroll.current?.scrollTo({y:target,animated:true});});});
 },80);},[]);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',reveal);return()=>{show.remove();if(timer.current)clearTimeout(timer.current);};},[reveal]);
 return <ScrollView {...props} ref={node=>{scroll.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps??'handled'} scrollEventThrottle={props.scrollEventThrottle??16} onScroll={event=>{offset.current=event.nativeEvent.contentOffset.y;props.onScroll?.(event);}} onFocus={event=>{focused.current=TextInput.State.currentlyFocusedInput();props.onFocus?.(event);reveal();}} onBlur={event=>{focused.current=null;props.onBlur?.(event);}}/>;
});
