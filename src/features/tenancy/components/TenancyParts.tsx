import {Image,StyleSheet,Text,View} from 'react-native';
import {useState} from 'react';
import type {PublicPropertyPhoto} from '../../../shared/models/PropertyMediaPath';
import {PublicIdentityBadge} from '../../../shared/components/PublicIdentityBadge';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusChip} from '../../../shared/components/StatusParts';
import type {Chip} from '../../../shared/models/StatusChip';
import type {Person} from '../models/TenancyWorkspaceScreen';

export function PersonRow({person,showRelation=true}:{person:Person;showRelation?:boolean}){return <View style={styles.person}><PublicIdentityBadge identity={person.identity} relationship={person.relation==='Landlord'?'owner':'renter'}/>{showRelation?<Text style={ui.supporting}>{person.relation}</Text>:null}</View>;}
/** Wide photo for the stay hero; falls back to a plain block. */
export function HeroPhoto({photos,chip,muted=false}:{photos:readonly PublicPropertyPhoto[];chip:Chip;muted?:boolean}){
  const [failed,setFailed]=useState<string[]>([]),photo=photos.find(p=>!failed.includes(p.url));
  return <View style={styles.hero}>{photo?<Image accessibilityLabel={photo.alt??'Property photo'} source={{uri:photo.url}} resizeMode="cover" style={[styles.heroImage,muted&&{opacity:.7}]} onError={()=>setFailed(old=>[...old,photo.url])}/>:null}<View style={styles.heroChip}><StatusChip chip={chip} onPhoto/></View></View>;
}
export function Thumb({photos,size=56}:{photos:readonly PublicPropertyPhoto[];size?:number}){
  const [failed,setFailed]=useState<string[]>([]),photo=photos.find(p=>!failed.includes(p.url));
  return <View accessible={false} style={{width:size,height:size,borderRadius:radius.control,overflow:'hidden',backgroundColor:colors.surfaceStrong}}>{photo?<Image source={{uri:photo.url}} resizeMode="cover" style={{width:'100%',height:'100%'}} onError={()=>setFailed(old=>[...old,photo.url])}/>:null}</View>;
}
export const Stars=({n=5}:{n?:number})=><Text accessible={false} style={styles.stars}>{'★'.repeat(n)}</Text>;
export const styles=StyleSheet.create({
  person:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:spacing.xs},
  hero:{height:140,borderRadius:radius.panel,overflow:'hidden',backgroundColor:colors.primaryPale},heroImage:{width:'100%',height:'100%'},heroChip:{position:'absolute',left:spacing.sm,top:spacing.sm},
  stars:{color:colors.reviewOrange,fontSize:16,letterSpacing:2},
});
