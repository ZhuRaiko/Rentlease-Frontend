import {useEffect,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import type {NearbyListing} from '../models/GpsProximity';
import {DiscoveryButton} from './DiscoveryControls';
import {cityLabels} from '../models/ManualSearch';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
export function NearbyPropertyPreview({listing,onDetails,onClose}:{listing:NearbyListing;onDetails:()=>void;onClose?:()=>void}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[listing.thumbnailUrl]);
  return <View style={styles.preview}>
    <View style={styles.photoFrame}>
      {listing.thumbnailUrl&&!failed?<Image source={{uri:listing.thumbnailUrl}} onError={()=>setFailed(true)} accessibilityLabel="Property cover photo" style={styles.photo}/>:<View style={[styles.photo,styles.placeholder]}><Text style={styles.copy}>No photo</Text></View>}
      {onClose?<Pressable accessibilityRole="button" accessibilityLabel="Close rental preview" onPress={onClose} style={styles.close}><Text accessible={false} style={styles.closeText}>×</Text></Pressable>:null}
    </View>
    <View style={styles.info}><Text numberOfLines={2} style={styles.title}>{listing.title||'Rental listing'}</Text><Text style={styles.copy}>{[listing.barangay,listing.city?cityLabels[listing.city]??listing.city:null].filter(Boolean).join(', ')||'Area not provided'}</Text><Text style={styles.price}>{listing.askingRentMonthly===null?'Rent not provided':`₱${listing.askingRentMonthly} / month`}</Text><Text style={styles.copy}>{listing.propertyType?listing.propertyType.replace(/_/g,' '):'Rental'} · {listing.distanceMeters} m away</Text><DiscoveryButton label="View Details" onPress={onDetails}/></View>
  </View>;
}
const styles=StyleSheet.create({preview:{backgroundColor:colors.background,borderRadius:20,overflow:'hidden'},photoFrame:{position:'relative'},photo:{width:'100%',height:124},placeholder:{backgroundColor:colors.canvas,alignItems:'center',justifyContent:'center'},info:{padding:spacing.md,gap:spacing.xs},price:{...ui.pageTitle,fontSize:21,lineHeight:28,color:colors.ink,paddingTop:2},title:{...ui.sectionTitle},copy:{...ui.supporting},close:{position:'absolute',top:8,right:8,width:48,height:48,borderRadius:24,backgroundColor:colors.background,alignItems:'center',justifyContent:'center'},closeText:{...ui.pageTitle,fontSize:24}});
