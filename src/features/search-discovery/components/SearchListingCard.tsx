import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SearchListing } from '../models/ManualSearch';
import { cityLabels } from '../models/ManualSearch';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
export function SearchListingCard({ listing, onPress }: { listing: SearchListing; onPress:()=>void }) {
  const [failed,setFailed] = useState(false);
  useEffect(() => setFailed(false),[listing.thumbnailUrl]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title}`} onPress={onPress} style={styles.card}>
    {listing.thumbnailUrl && !failed ? <Image onError={() => setFailed(true)} source={{uri:listing.thumbnailUrl}} accessibilityLabel="Property photo" style={styles.image} /> : <View style={[styles.image,styles.placeholder]}><Text style={styles.copy}>No property photo</Text></View>}
    <Text style={styles.price}>₱{listing.rent.toLocaleString('en-PH')} /mo</Text><Text style={styles.title}>{listing.title}</Text>
    <Text style={styles.copy}>{listing.propertyType.replace(/_/g,' ')} · {listing.barangay}, {cityLabels[listing.city] ?? listing.city}</Text>
    <Text style={styles.copy}>{listing.bedrooms} bed · {listing.bathrooms} bath{listing.floorArea===null?'':` · ${listing.floorArea} sqm floor area`}</Text>
  </Pressable>;
}
const styles=StyleSheet.create({card:{gap:spacing.xs,paddingVertical:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.border},image:{width:'100%',aspectRatio:4/3,borderRadius:12},placeholder:{backgroundColor:colors.surface,justifyContent:'center',alignItems:'center'},price:{fontFamily:typography.family,color:colors.primary,fontSize:18,fontWeight:'800'},title:{fontFamily:typography.family,color:colors.text,fontSize:17,fontWeight:'700'},copy:{fontFamily:typography.family,color:colors.textSecondary,fontSize:14,lineHeight:21}});
