import {SaveListingButton,type SaveControl} from './SaveListingButton';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { SearchListing } from '../models/ManualSearch';
import { cityLabels } from '../models/ManualSearch';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
export function SearchListingCard({ listing, onPress, save, horizontal=false }: { listing: SearchListing; onPress:()=>void;save?:SaveControl|undefined;horizontal?:boolean }) {
  const dimensions=useWindowDimensions(),compact=horizontal&&dimensions.width>=340&&(dimensions.fontScale??1)<1.5;
  const [failed,setFailed] = useState(false);
  useEffect(() => setFailed(false),[listing.thumbnailUrl]);
  return <View style={styles.card}><Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title}`} onPress={onPress} style={compact?{flexDirection:'row',gap:12,alignItems:'flex-start'}:{gap:4}}>
    {listing.thumbnailUrl && !failed ? <Image onError={() => setFailed(true)} source={{uri:listing.thumbnailUrl}} accessibilityLabel="Property photo" style={[styles.image,compact?{width:110,aspectRatio:1,height:120}:null]} /> : <View style={[styles.image,styles.placeholder,compact?{width:110,aspectRatio:1,height:120}:null]}><Text style={styles.copy}>Photo unavailable</Text></View>}
    <View style={{flex:compact?1:undefined,minWidth:0,gap:3}}><Text style={styles.price}>₱{listing.rent.toLocaleString('en-PH')} /mo</Text><Text style={styles.title}>{listing.title}</Text>
    <Text style={styles.copy}>{listing.propertyType.replace(/_/g,' ')} · {listing.barangay}, {cityLabels[listing.city] ?? listing.city}</Text>
    <Text style={styles.copy}>{listing.bedrooms} bed · {listing.bathrooms} bath{listing.floorArea===null?'':` · ${listing.floorArea} sqm floor area`}</Text>
    </View>
  </Pressable>{save?<View style={{alignSelf:'flex-end'}}><SaveListingButton control={save}/></View>:null}</View>;
}
const styles=StyleSheet.create({card:{gap:spacing.xs,paddingVertical:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.border},image:{width:'100%',aspectRatio:4/3,borderRadius:12},placeholder:{backgroundColor:colors.surface,justifyContent:'center',alignItems:'center'},price:{fontFamily:typography.family,color:colors.primary,fontSize:18,fontWeight:'800'},title:{fontFamily:typography.family,color:colors.text,fontSize:17,fontWeight:'700'},copy:{fontFamily:typography.family,color:colors.textSecondary,fontSize:14,lineHeight:21}});
