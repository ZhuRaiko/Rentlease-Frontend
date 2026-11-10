import {useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import type {PublicPropertyPhoto} from '../models/PropertyMediaPath';
import {colors} from '../theme/colors';
import {ui} from '../theme/ui';
/** Try remaining real photos if a deleted/missing cover URL fails. */
export function PropertyPhotoThumbnail({photos,size=64,onPressPhoto}:{photos:readonly PublicPropertyPhoto[];size?:number;onPressPhoto?:((index:number)=>void)|undefined}){
 const [failed,setFailed]=useState<string[]>([]);const photo=photos.find(p=>!failed.includes(p.url));
 const image=<View style={[styles.frame,{width:size,height:size}]}>{photo?<Image accessibilityLabel={photo.alt??'Property photo'} source={{uri:photo.url}} resizeMode="cover" style={styles.image} onError={()=>setFailed(old=>[...old,photo.url])}/>:<Text style={styles.placeholder}>No photo</Text>}</View>;
 return onPressPhoto?<Pressable accessibilityRole="button" accessibilityLabel="Preview property photos" disabled={!photo} onPress={()=>{if(photo)onPressPhoto(photos.indexOf(photo));}}>{image}</Pressable>:image;
}
const styles=StyleSheet.create({frame:{backgroundColor:colors.surfaceStrong,borderRadius:8,overflow:'hidden',alignItems:'center',justifyContent:'center'},image:{width:'100%',height:'100%'},placeholder:{...ui.supporting,fontSize:10,textAlign:'center',padding:4}});
