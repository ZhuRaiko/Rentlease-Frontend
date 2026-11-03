import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NearbyListing } from '../models/GpsProximity';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const labels: Record<string, string> = { imus: 'Imus', dasmarinas: 'Dasmariñas', tagaytay: 'Tagaytay', boarding_house: 'Boarding house', bedspace: 'Bedspace', condominium: 'Condominium', studio: 'Studio', apartment: 'Apartment', house: 'House', room: 'Room', dormitory: 'Dormitory', other: 'Other' };
export function NearbyListingCard({ listing, onPress }: { listing: NearbyListing; onPress:()=>void }) {
  const [photoFailed,setPhotoFailed]=useState(false);
  useEffect(()=>setPhotoFailed(false),[listing.thumbnailUrl]);
  // Decimal transport strings remain strings; no lossy numeric conversion for display.
  const rent = listing.askingRentMonthly === null ? 'Rent not provided' : `₱${typeof listing.askingRentMonthly === 'number' ? listing.askingRentMonthly.toLocaleString('en-PH') : listing.askingRentMonthly} /mo`;
  const propertyType=listing.propertyType ? labels[listing.propertyType] ?? listing.propertyType : 'Property type not provided';
  const area=[listing.barangay, listing.city ? labels[listing.city] ?? listing.city : null].filter(Boolean).join(', ') || 'Area not provided';
  const availability=listing.availableFrom ? `Available from ${listing.availableFrom}` : 'Availability date not provided';
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${listing.title || 'rental listing'}. ${rent}. ${propertyType}. ${area}. ${listing.distanceMeters} meters away. ${availability}.`} onPress={onPress} style={styles.card}>
    {listing.thumbnailUrl&&!photoFailed?<Image source={{uri:listing.thumbnailUrl}} accessibilityLabel="Property photo" onError={()=>setPhotoFailed(true)} style={styles.photo}/>:<View style={[styles.photo,styles.placeholder]}><Text style={styles.copy}>Photo unavailable</Text></View>}
    <Text style={styles.rent}>{rent}</Text>
    <Text accessibilityRole="header" style={styles.title}>{listing.title || 'Rental listing'}</Text>
    <Text style={styles.copy}>{propertyType}</Text>
    <Text style={styles.copy}>{area}</Text>
    <Text style={styles.distance}>{listing.distanceMeters} m away</Text>
    <Text style={styles.copy}>{availability}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  photo:{width:'100%',aspectRatio:4/3,borderRadius:12},
  placeholder:{alignItems:'center',justifyContent:'center',backgroundColor:colors.surface},
  card: { paddingVertical: spacing.lg, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  rent: { fontFamily: typography.family, fontSize: 18, fontWeight: '800', color: colors.primary },
  title: { fontFamily: typography.family, fontSize: 17, fontWeight: '700', color: colors.text },
  copy: { fontFamily: typography.family, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  distance: { fontFamily: typography.family, fontSize: 14, fontWeight: '700', color: colors.primary },
});
