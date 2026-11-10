import {useState} from 'react';
import {Image,StyleSheet,Text,View} from 'react-native';
import {colors} from '../theme/colors';
import {ui} from '../theme/ui';
import {publicIdentityLabel,type PublicIdentity} from '../models/PublicIdentity';
export function PublicAvatar({url,size=40}:{url?:string|null|undefined;size?:number}){
 const [failed,setFailed]=useState<string|null>(null);
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.avatar,{width:size,height:size,borderRadius:size/2}]}>{url&&failed!==url?<Image source={{uri:url}} style={styles.photo} resizeMode="cover" onError={()=>setFailed(url)}/>:<><View style={[styles.head,{width:size*.25,height:size*.25,borderRadius:size*.13}]}/><View style={[styles.shoulders,{width:size*.52,height:size*.24,borderTopLeftRadius:size*.25,borderTopRightRadius:size*.25}]}/></>}</View>;
}
export function PublicIdentityBadge({identity,relationship,size=36}:{identity?:PublicIdentity|undefined;relationship:'owner'|'renter';size?:number}){return <View style={styles.row}><PublicAvatar url={identity?.avatarUrl} size={size}/><Text style={styles.label}>{publicIdentityLabel(identity,relationship)}</Text></View>;}
const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:10},label:{...ui.body,flexShrink:1},avatar:{backgroundColor:colors.surfaceStrong,alignItems:'center',justifyContent:'center',overflow:'hidden',gap:3},photo:{width:'100%',height:'100%'},head:{backgroundColor:colors.textMuted},shoulders:{backgroundColor:colors.textMuted}});
