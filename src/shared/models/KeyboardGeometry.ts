export function keyboardOverlap(viewportBottom:number,keyboardTop:number|null):number{
 return Number.isFinite(viewportBottom)&&keyboardTop!==null&&Number.isFinite(keyboardTop)&&keyboardTop>0?Math.max(0,viewportBottom-keyboardTop):0;
}
export function focusedScrollOffset(top:number,bottom:number,viewportTop:number,viewportBottom:number,offset:number):number|null{
 if(![top,bottom,viewportTop,viewportBottom,offset].every(Number.isFinite))return null;
 const delta=bottom>viewportBottom-24?bottom-viewportBottom+24:top<viewportTop+16?top-viewportTop-16:0;
 return delta===0?null:Math.max(0,offset+delta);
}
