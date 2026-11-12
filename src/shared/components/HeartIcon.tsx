import {View} from 'react-native';
import {colors} from '../theme/colors';
/** Native rounded lobes and point, independent of system glyph fonts. */
export function HeartIcon({filled=false,size=24,color=colors.ink,background=colors.background}:{filled?:boolean;size?:number;color?:string;background?:string}){
 const shape=(scale:number,tint:string)=><View style={{position:'absolute',width:size*scale,height:size*scale,left:size*(1-scale)/2,top:size*(1-scale)/2}}><View style={{position:'absolute',width:size*scale*.55,height:size*scale*.55,left:size*scale*.225,top:size*scale*.32,backgroundColor:tint,transform:[{rotate:'-45deg'}]}}><View style={{position:'absolute',backgroundColor:tint,width:'100%',height:'100%',borderRadius:size,left:0,top:'-50%'}}/><View style={{position:'absolute',backgroundColor:tint,width:'100%',height:'100%',borderRadius:size,left:'50%',top:0}}/></View></View>;
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:size,height:size}}>{shape(1,color)}{!filled?shape(.76,background):null}</View>;
}
