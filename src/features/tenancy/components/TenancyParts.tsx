import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {useState,type ReactNode} from 'react';
import type {PublicPropertyPhoto} from '../../../shared/models/PropertyMediaPath';
import {PublicIdentityBadge} from '../../../shared/components/PublicIdentityBadge';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {CHIP_COLORS,type Chip} from '../models/TenancyPresentation';
import type {Person} from '../models/TenancyWorkspaceScreen';

/** Status as a chip. Colors come from CHIP_COLORS (existing theme tokens only). */
export function TenancyChip({chip,onPhoto=false}:{chip:Chip;onPhoto?:boolean}){
  const c=CHIP_COLORS[chip.tone];
  return <View accessible accessibilityLabel={`Status: ${chip.label}`} style={[styles.chip,{backgroundColor:c.backgroundColor,borderColor:c.borderColor},onPhoto&&styles.onPhoto]}><Text style={[styles.chipText,{color:c.color}]}>{chip.label}</Text></View>;
}
export type ButtonTone='primary'|'secondary'|'warning'|'dangerOutline';
/** One 48dp button family for this feature: green, outline, amber (waiting on you) and red outline (ending). */
export function TenancyButton({label,onPress,tone='secondary',disabled=false,accessibilityLabel}:{label:string;onPress:()=>void;tone?:ButtonTone;disabled?:boolean;accessibilityLabel?:string}){
  const filled=tone==='primary'||tone==='warning';
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[styles.button,tone==='primary'&&styles.primary,tone==='warning'&&styles.warning,tone==='secondary'&&styles.secondary,tone==='dangerOutline'&&styles.dangerOutline,disabled&&styles.disabled,pressed&&{opacity:.85}]}>
    <Text style={[styles.buttonText,filled?{color:colors.white}:tone==='dangerOutline'?{color:colors.restricted}:{color:colors.ink}]}>{label}</Text></Pressable>;
}
export function ButtonRow({children}:{children:ReactNode}){return <View style={styles.row}>{children}</View>;}
/** Each button takes at least half a row, and wraps below at large text or narrow screens. */
export function Slot({children}:{children:ReactNode}){return <View style={styles.slot}>{children}</View>;}
export function Cell({label,value}:{label:string;value:string}){return <View style={styles.cell}><Text style={ui.supporting}>{label}</Text><Text style={styles.cellValue}>{value}</Text></View>;}
export function CellRow({children}:{children:ReactNode}){return <View style={styles.cells}>{children}</View>;}
export function PersonRow({person,showRelation=true}:{person:Person;showRelation?:boolean}){return <View style={styles.person}><PublicIdentityBadge identity={person.identity} relationship={person.relation==='Landlord'?'owner':'renter'}/>{showRelation?<Text style={ui.supporting}>{person.relation}</Text>:null}</View>;}
/** Wide photo for the stay hero; falls back to a plain block. */
export function HeroPhoto({photos,chip,muted=false}:{photos:readonly PublicPropertyPhoto[];chip:Chip;muted?:boolean}){
  const [failed,setFailed]=useState<string[]>([]),photo=photos.find(p=>!failed.includes(p.url));
  return <View style={styles.hero}>{photo?<Image accessibilityLabel={photo.alt??'Property photo'} source={{uri:photo.url}} resizeMode="cover" style={[styles.heroImage,muted&&{opacity:.7}]} onError={()=>setFailed(old=>[...old,photo.url])}/>:null}<View style={styles.heroChip}><TenancyChip chip={chip} onPhoto/></View></View>;
}
export function Thumb({photos,size=56}:{photos:readonly PublicPropertyPhoto[];size?:number}){
  const [failed,setFailed]=useState<string[]>([]),photo=photos.find(p=>!failed.includes(p.url));
  return <View accessible={false} style={{width:size,height:size,borderRadius:radius.control,overflow:'hidden',backgroundColor:colors.surfaceStrong}}>{photo?<Image source={{uri:photo.url}} resizeMode="cover" style={{width:'100%',height:'100%'}} onError={()=>setFailed(old=>[...old,photo.url])}/>:null}</View>;
}
export const Stars=({n=5}:{n?:number})=><Text accessible={false} style={styles.stars}>{'★'.repeat(n)}</Text>;
export const styles=StyleSheet.create({
  chip:{alignSelf:'flex-start',borderRadius:radius.pill,borderWidth:1,paddingHorizontal:spacing.sm,paddingVertical:2},onPhoto:{borderWidth:0},chipText:{...ui.supporting,fontWeight:'700',fontSize:12,lineHeight:18},
  button:{minHeight:48,borderRadius:radius.control,paddingHorizontal:spacing.md,paddingVertical:spacing.xs,alignItems:'center',justifyContent:'center'},buttonText:{...ui.body,fontWeight:'700',textAlign:'center'},
  primary:{backgroundColor:colors.primaryAction},warning:{backgroundColor:colors.warning},secondary:{backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.controlBorder},dangerOutline:{backgroundColor:colors.background,borderWidth:1.5,borderColor:colors.restricted},disabled:{opacity:.5},
  row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},slot:{flexGrow:1,flexBasis:130},
  cells:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{flexGrow:1,flexBasis:130,padding:spacing.sm,gap:2,borderRadius:radius.control,backgroundColor:colors.surface},cellValue:{...ui.body,fontWeight:'700'},
  person:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:spacing.xs},
  hero:{height:140,borderRadius:radius.panel,overflow:'hidden',backgroundColor:colors.primaryPale},heroImage:{width:'100%',height:'100%'},heroChip:{position:'absolute',left:spacing.sm,top:spacing.sm},
  stars:{color:colors.reviewOrange,fontSize:16,letterSpacing:2},
});
