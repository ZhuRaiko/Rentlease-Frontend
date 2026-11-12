import {SaveListingButton,type SaveControl} from './SaveListingButton';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { SearchListing } from '../models/ManualSearch';
import { cityLabels } from '../models/ManualSearch';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
export function SearchListingCard({ listing, onPress, save, horizontal=false, discovery=false }: { listing: SearchListing; onPress:()=>void;save?:SaveControl|undefined;horizontal?:boolean;discovery?:boolean }) {
  const dimensions=useWindowDimensions(),compact=horizontal&&dimensions.width>=360&&(dimensions.fontScale??1)<1.4;
  const [failed,setFailed] = useState(false);
  useEffect(() => setFailed(false),[listing.thumbnailUrl]);
  if(horizontal){
    const location=[listing.barangay,cityLabels[listing.city]??listing.city].filter(Boolean).join(', ');
    const count=(value:number,label:string)=>Number.isFinite(value)&&value>=0?`${value} ${label}${value===1?'':'s'}`:`${label} count unavailable`;
    const price=`PHP ${listing.rent.toLocaleString('en-PH')}`;
    return <View style={[styles.savedCard,compact?styles.savedRow:null]}>
      <View style={[styles.savedMedia,compact?styles.savedMediaSide:styles.savedMediaFull]}>
        <Pressable accessible={false} onPress={onPress} style={styles.photoTarget}>
          {listing.thumbnailUrl&&!failed?<Image source={{uri:listing.thumbnailUrl}} onError={()=>setFailed(true)} accessibilityLabel="Property cover photo" style={styles.savedImage}/>:<View style={[styles.savedImage,styles.placeholder]}><Text style={styles.copy}>Photo unavailable</Text></View>}
        </Pressable>
        {save?<View style={styles.savedHeart}><SaveListingButton control={save}/></View>:null}
        <View pointerEvents="none" style={styles.savedPrice}><Text style={styles.savedPriceAmount}>{price}<Text style={styles.savedPricePeriod}> / month</Text></Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title}, ${price} per month, ${location}`} onPress={onPress} style={({pressed})=>[styles.savedInformation,compact?{flex:1}:null,pressed&&{opacity:0.75}]}>
        <Text accessibilityRole="header" style={styles.savedTitle}>{listing.title}</Text>
        <Text style={styles.copy}>{location||'Public location unavailable'}</Text>
        <View style={styles.savedFacts}><Text style={styles.copy}>{count(listing.bedrooms,'bedroom')}</Text><Text style={styles.copy}>{count(listing.bathrooms,'bathroom')}</Text></View>
      </Pressable>
    </View>;
  }
  if(discovery)return <View style={styles.discoveryCard}>
    <View style={styles.discoveryMedia}><Pressable accessible={false} onPress={onPress} style={styles.photoTarget}>{listing.thumbnailUrl&&!failed?<Image source={{uri:listing.thumbnailUrl}} onError={()=>setFailed(true)} style={styles.discoveryImage}/>:<View style={[styles.discoveryImage,styles.placeholder]}><Text style={styles.copy}>Photo unavailable</Text></View>}</Pressable><View pointerEvents="none" style={styles.propertyType}><Text style={styles.typeText}>{listing.propertyType.replace(/_/g,' ')}</Text></View>{save?<View style={styles.discoveryHeart}><SaveListingButton control={save}/></View>:null}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title}, PHP ${listing.rent.toLocaleString('en-PH')} per month`} onPress={onPress} style={({pressed})=>[styles.discoveryDetails,pressed&&{opacity:.75}]}>
      <Text style={styles.discoveryPrice}>PHP {listing.rent.toLocaleString('en-PH')}<Text style={styles.savedPricePeriod}> / month</Text></Text>
      <Text style={styles.savedTitle}>{listing.title}</Text><Text style={styles.copy}>{[listing.barangay,cityLabels[listing.city]??listing.city].filter(Boolean).join(', ')||'Public location unavailable'}</Text>
      <View style={styles.discoveryFacts}><Text style={styles.copy}>{Number.isFinite(listing.bedrooms)?`${listing.bedrooms} bedrooms`:'Bedrooms unavailable'}</Text><Text style={styles.copy}>{Number.isFinite(listing.bathrooms)?`${listing.bathrooms} bathrooms`:'Bathrooms unavailable'}</Text></View><Text style={styles.detailLink}>View rental details</Text>
    </Pressable>
  </View>;
  return <View style={styles.card}><Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title}`} onPress={onPress} style={compact?{flexDirection:'row',gap:12,alignItems:'flex-start'}:{gap:4}}>
    {listing.thumbnailUrl && !failed ? <Image onError={() => setFailed(true)} source={{uri:listing.thumbnailUrl}} accessibilityLabel="Property photo" style={[styles.image,compact?{width:110,aspectRatio:1,height:120}:null]} /> : <View style={[styles.image,styles.placeholder,compact?{width:110,aspectRatio:1,height:120}:null]}><Text style={styles.copy}>Photo unavailable</Text></View>}
    <View style={{flex:compact?1:undefined,minWidth:0,gap:3}}><Text style={styles.price}>₱{listing.rent.toLocaleString('en-PH')} /mo</Text><Text style={styles.title}>{listing.title}</Text>
    <Text style={styles.copy}>{listing.propertyType.replace(/_/g,' ')} · {listing.barangay}, {cityLabels[listing.city] ?? listing.city}</Text>
    <Text style={styles.copy}>{listing.bedrooms} bed · {listing.bathrooms} bath{listing.floorArea===null?'':` · ${listing.floorArea} sqm floor area`}</Text>
    </View>
  </Pressable>{save?<View style={{alignSelf:'flex-end'}}><SaveListingButton control={save}/></View>:null}</View>;
}
const styles=StyleSheet.create({
 discoveryImage:{width:'100%',height:'100%'},discoveryCard:{borderWidth:1,borderColor:colors.outline,borderRadius:16,backgroundColor:colors.background,marginBottom:16,overflow:'hidden'},discoveryMedia:{position:'relative',aspectRatio:1.65,backgroundColor:colors.surface},discoveryHeart:{position:'absolute',top:12,right:12},propertyType:{position:'absolute',top:12,left:12,maxWidth:'60%',paddingHorizontal:10,paddingVertical:7,backgroundColor:colors.background,borderRadius:8},typeText:{...{fontFamily:typography.family},color:colors.ink,fontSize:12,fontWeight:'600'},discoveryDetails:{padding:16,gap:8,minHeight:48},discoveryPrice:{fontFamily:typography.family,color:colors.primaryAction,fontSize:23,lineHeight:30,fontWeight:'800'},discoveryFacts:{flexDirection:'row',flexWrap:'wrap',gap:12,borderTopWidth:1,borderTopColor:colors.outline,paddingTop:10,marginTop:4},detailLink:{fontFamily:typography.family,color:colors.primaryAction,fontWeight:'600',fontSize:13,paddingTop:3},
 savedCard:{borderWidth:1,borderColor:colors.outline,borderRadius:16,backgroundColor:colors.background,padding:12,gap:14,marginTop:14},
 savedRow:{flexDirection:'row',alignItems:'stretch'},savedMedia:{position:'relative',minWidth:0,borderRadius:12},savedMediaSide:{width:'43%',minHeight:190},savedMediaFull:{width:'100%',minHeight:220},
 photoTarget:{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:12,overflow:'hidden'},savedImage:{width:'100%',height:'100%',minHeight:190},savedHeart:{position:'absolute',top:6,right:6},
 savedPrice:{marginTop:'auto',marginHorizontal:6,marginBottom:6,paddingHorizontal:7,paddingVertical:7,borderRadius:8,backgroundColor:colors.background},
 savedPriceAmount:{fontFamily:typography.family,color:colors.ink,fontSize:16,lineHeight:23,fontWeight:'800'},savedPricePeriod:{fontSize:12,fontWeight:'500'},
 savedInformation:{minWidth:0,gap:10,minHeight:48,justifyContent:'center'},savedTitle:{fontFamily:typography.family,color:colors.ink,fontSize:17,lineHeight:24,fontWeight:'700'},savedFacts:{gap:5},
 card:{gap:spacing.xs,paddingVertical:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.border},image:{width:'100%',aspectRatio:4/3,borderRadius:12},placeholder:{backgroundColor:colors.surface,justifyContent:'center',alignItems:'center'},price:{fontFamily:typography.family,color:colors.primary,fontSize:18,fontWeight:'800'},title:{fontFamily:typography.family,color:colors.text,fontSize:17,fontWeight:'700'},copy:{fontFamily:typography.family,color:colors.textSecondary,fontSize:14,lineHeight:21}});
