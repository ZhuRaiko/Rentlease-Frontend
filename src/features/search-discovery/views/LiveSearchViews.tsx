import {placeCategories,placeCategoryLabels} from '../../../shared/models/NearbyPlace';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { DiscoveryButton, DiscoveryChip, DiscoveryHeader, DiscoverySearchBar } from '../components/DiscoveryControls';
import { SearchListingCard } from '../components/SearchListingCard';
import { cityLabels, type SearchFilters, type SearchSort } from '../models/ManualSearch';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';
import { FullscreenDocumentImage } from '../../../shared/components/FullscreenDocumentImage';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

export function LiveSearchResultsView({ viewModel:vm }: {viewModel:SearchDiscoveryViewModel}) {
  const s=vm.manualState,busy=s.phase==='loading'||s.more;
  return <View style={styles.screen}><DiscoveryHeader title="Search Results" onBack={vm.goBack}/><FlatList data={s.rows} keyExtractor={r=>r.listingId} contentContainerStyle={styles.content} renderItem={({item})=><SearchListingCard listing={item} onPress={()=>vm.openProperty(item.listingId)}/>}
    ListHeaderComponent={<View style={styles.section}>
      <DiscoverySearchBar value={vm.query} onChangeText={vm.setQuery} onFocus={()=>vm.navigate('searchLocation')} onSubmit={vm.submitSearch} placeholder="Enter a city or barangay"/>
      <View style={styles.row}><DiscoveryButton label="Filters" tone="outline" onPress={vm.openLiveFilters}/><DiscoveryButton label="Sort" tone="outline" onPress={()=>vm.navigate('sort')}/></View>
      <Text style={styles.copy}>{s.sort} · {s.rows.length} loaded</Text><Text style={styles.copy}>Map results are not connected yet.</Text>
      {busy?<View accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary}/><Text style={styles.copy}>{s.more?'Loading more rentals…':'Searching rentals…'}</Text></View>:null}
      {s.error?<><Text accessibilityRole="alert" style={styles.error}>{s.error}</Text><DiscoveryButton label="Retry" onPress={()=>void vm.manual.retry()} disabled={busy}/></>:null}
      {s.phase==='success'&&!s.rows.length?<><Text style={styles.heading}>No rentals available in this area yet.</Text><Text style={styles.copy}>Try another city or search nearby.</Text></>:null}
    </View>}
    ListFooterComponent={<View style={styles.section}>{s.hasMore&&!s.error?<DiscoveryButton label="Load more" disabled={busy} onPress={()=>void vm.manual.loadMore()}/>:null}<DiscoveryButton label="Search another location" tone="outline" onPress={()=>vm.navigate('searchLocation')}/><DiscoveryButton label="Search nearby" tone="outline" onPress={vm.requestCurrentLocation}/></View>}/></View>;
}
const sorts:SearchSort[]=['Recently Listed','Price: Low to High','Price: High to Low'];
const propertyTypes=['apartment','boarding_house','bedspace','room','studio','condominium','house','dormitory','other'] as const;
export function LiveSearchFiltersView({viewModel:vm}:{viewModel:SearchDiscoveryViewModel}) {
  const f=vm.liveFilterDraft;
  const update=<K extends keyof SearchFilters>(key:K,value:SearchFilters[K])=>vm.setLiveFilterDraft({...f,[key]:value});
  if(vm.screen==='sort')return <View style={styles.screen}><DiscoveryHeader title="Sort rentals" onBack={vm.goBack}/><View style={styles.content}>{sorts.map(sort=><DiscoveryChip key={sort} label={sort} selected={vm.manualState.sort===sort} onPress={()=>vm.chooseLiveSort(sort)}/>)}</View></View>;
  return <View style={styles.screen}><DiscoveryHeader title="Filters" onBack={vm.goBack}/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.heading}>City</Text><View style={styles.row}><DiscoveryChip label="Any city" selected={!f.city} onPress={()=>update('city','')}/>{(['imus','dasmarinas','tagaytay'] as const).map(city=><DiscoveryChip key={city} label={cityLabels[city]!} selected={f.city===city} onPress={()=>update('city',city)}/>)}</View>
    <Text style={styles.heading}>Property type</Text><View style={styles.row}>{propertyTypes.map(type=><DiscoveryChip key={type} label={type.replace(/_/g,' ')} selected={f.types.includes(type)} onPress={()=>update('types',f.types.includes(type)?f.types.filter(t=>t!==type):[...f.types,type])}/>)}</View>
    {([['minRent','Minimum monthly rent'],['maxRent','Maximum monthly rent'],['minBeds','Minimum bedrooms'],['minBaths','Minimum bathrooms'],['minFloorArea','Minimum floor area (sqm)']] as const).map(([key,label])=><View key={key} style={styles.section}><Text style={styles.copy}>{label}</Text><TextInput accessibilityLabel={label} value={f[key]===null?'':String(f[key])} onChangeText={text=>update(key,text.trim()?Number(text):key==='minBeds'||key==='minBaths'?0:null)} keyboardType="decimal-pad" style={styles.input}/></View>)}
    <Text style={styles.heading}>Furnishing</Text><View style={styles.row}><DiscoveryChip label="Any furnishing" selected={!f.furnishing} onPress={()=>update('furnishing','')}/>{(['unfurnished','semi_furnished','furnished'] as const).map(value=><DiscoveryChip key={value} label={value.replace(/_/g,' ')} selected={f.furnishing===value} onPress={()=>update('furnishing',value)}/>)}</View>
    <Text style={styles.heading}>Property amenities</Text><Text style={styles.copy}>Match any selected amenity. Nearby places are not included.</Text>{vm.manualState.catalogueError?<Text accessibilityRole="alert" style={styles.error}>{vm.manualState.catalogueError}</Text>:null}<View style={styles.row}>{vm.manualState.amenities.map(a=><DiscoveryChip key={a.id} label={a.name} selected={f.amenityIds.includes(a.id)} onPress={()=>update('amenityIds',f.amenityIds.includes(a.id)?f.amenityIds.filter(id=>id!==a.id):[...f.amenityIds,a.id])}/>)}</View>
    <DiscoveryButton label="Apply filters" onPress={vm.applyLiveFilters}/><DiscoveryButton label="Reset filters" tone="outline" onPress={vm.resetLiveFilters}/>
  </ScrollView></View>;
}
function DetailGalleryPhoto({url,label,width,onPress}:{url:string;label:string;width:number;onPress:()=>void}) {
  const [failed,setFailed]=useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{width}}>
    {failed?<View style={[styles.heroImage,styles.placeholder]}><Text style={styles.copy}>Photo unavailable</Text></View>:<Image source={{uri:url}} onError={()=>setFailed(true)} accessibilityLabel="Property photo" style={styles.heroImage}/>}
    <Text style={styles.photoCaption}>{label}</Text>
  </Pressable>;
}
export function LivePropertyDetailView({viewModel:vm}:{viewModel:SearchDiscoveryViewModel}) {
  const s=vm.manualState,d=s.detail;const [imageIndex,setImageIndex]=useState<number|null>(null);const photo=imageIndex===null?null:d?.photos[imageIndex];
  const photoWidth=Math.max(240,useWindowDimensions().width-32);
  return <View style={styles.screen}><DiscoveryHeader title="Rental details" onBack={vm.goBack}/><ScrollView contentContainerStyle={styles.detailContent}>
    {s.detailBusy?<ActivityIndicator accessibilityLabel="Loading rental" color={colors.primary}/>:null}
    {s.detailError?<View style={styles.detailSection}><Text accessibilityRole="alert" style={styles.error}>{s.detailError}</Text><DiscoveryButton label="Retry details" onPress={()=>{if(s.selectedId)void vm.manual.openDetail(s.selectedId);}}/></View>:null}
    {d?<>
      {d.photos.length?<ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator contentContainerStyle={styles.gallery}>{d.photos.map((p,i)=><DetailGalleryPhoto key={p.id} url={p.url} width={photoWidth} label={`View photo ${i+1} of ${d.photos.length}`} onPress={()=>setImageIndex(i)}/>)}</ScrollView>:<View style={[styles.heroImage,styles.placeholder]}><Text style={styles.copy}>No property photos available</Text></View>}
      <View style={styles.summary}><Text style={styles.detailPrice}>₱{d.rent.toLocaleString('en-PH')}<Text style={styles.copy}> / month</Text></Text>
        <Text accessibilityRole="header" style={styles.detailTitle}>{d.title}</Text>
        <Text style={styles.copy}>{d.barangay}, {cityLabels[d.city]??d.city}</Text><Text style={styles.small}>Approximate area · Exact property location is private</Text>
        <View style={styles.facts}><Text style={styles.fact}>{d.bedrooms} bedrooms</Text><Text style={styles.fact}>{d.bathrooms} bathrooms</Text>{d.floorArea!==null?<Text style={styles.fact}>{d.floorArea} sqm</Text>:null}</View>
        <Text style={styles.copy}>{d.propertyType.replace(/_/g,' ')} · {d.furnishing.replace(/_/g,' ')}</Text>
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.small}>Listed by</Text>
        <View style={styles.ownerRow}>
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.ownerAvatar}><View style={styles.avatarHead}/><View style={styles.avatarBody}/></View>
          <Text style={styles.ownerName}>{vm.listingOwnerLabel}</Text>
        </View>
        {vm.isOwnListing?<Text style={styles.copy}>This is your listing.</Text>:<DiscoveryButton label={s.inquiryBusy?'Opening conversation...':'Contact Owner'} disabled={s.inquiryBusy} onPress={()=>void vm.contactOwner()}/>}
        {s.inquiryError?<Text accessibilityRole="alert" style={styles.error}>{s.inquiryError}</Text>:null}
      </View>
      <View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>About this rental</Text><Text style={styles.copy}>{d.description}</Text></View>
      <View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>Amenities</Text>{d.amenities.length?<View style={styles.row}>{d.amenities.map((a,i)=><Text key={i} style={styles.amenity}>{a}</Text>)}</View>:<Text style={styles.copy}>No property amenities recorded.</Text>}</View>
      <View style={styles.detailSection}>
        <Text accessibilityRole="header" style={styles.heading}>Nearby Places</Text>
        <Text style={styles.copy}>Places around this property's approximate location.</Text>
        <Text style={styles.small}>Within about 2 km. Distances are approximate and straight-line, not walking or driving distances.</Text>
          {!d.publicLocation?<Text style={styles.copy}>Nearby places are unavailable because this property has no usable public location.</Text>:null}
          {s.placesPhase==='loading'?<View accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary}/><Text style={styles.copy}>Loading nearby places...</Text></View>:null}
          {s.placesPhase==='error'?<><Text accessibilityRole="alert" style={styles.error}>{s.placesError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry nearby places" onPress={()=>void vm.manual.loadPlaces()} style={styles.placesRetry}><Text style={styles.retryLabel}>Retry</Text></Pressable></>:null}
          {s.placesStale?<Text style={styles.small}>{s.placesPhase==='loading'?'Previously loaded places. Checking for updates...':'Showing previously loaded places; the update failed.'}</Text>:null}
          {s.placesPhase==='success'||s.placesRows?.length?placeCategories.map(category=>{const rows=s.placesRows.filter(p=>p.category===category);return <View key={category} style={styles.section}>
            <Text style={styles.placeCategory}>{placeCategoryLabels[category]}</Text>
            {rows.length?rows.map(p=><View key={`${p.osmType}:${p.osmId}`} style={styles.placeRow}><Text style={styles.copy}>{p.name}</Text><Text style={styles.small}>{placeCategoryLabels[p.category]} &middot; Approx. {p.distanceMeters<1000?`${Math.round(p.distanceMeters/10)*10} m`:`${(p.distanceMeters/1000).toFixed(1)} km`}</Text></View>):<Text style={styles.small}>No named places mapped in this category within this area.</Text>}
          </View>;}):null}
          <Text selectable style={styles.small}>&copy; OpenStreetMap contributors &middot; openstreetmap.org/copyright{'\n'}Coverage may be incomplete.</Text>
      </View>
      <View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>Availability and terms</Text><Text style={styles.copy}>{d.availableFrom?`Available from ${d.availableFrom}`:'Availability date not specified'}</Text><Text style={styles.copy}>{d.rentalTerm.replace(/_/g,' ')}</Text>{d.minimumStay!==null?<Text style={styles.copy}>Minimum stay: {d.minimumStay} months</Text>:null}<Text style={styles.copy}>Security deposit: {d.depositMonths} months</Text><Text style={styles.copy}>Advance rent: {d.advanceMonths} months</Text></View>
      {d.houseRules?<View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>House rules</Text><Text style={styles.copy}>{d.houseRules}</Text></View>:null}
    </>:null}
  </ScrollView><FullscreenDocumentImage visible={!!photo} uri={photo?.url??null} title="Property photo" onClose={()=>setImageIndex(null)} {...(imageIndex!==null&&imageIndex>0?{onPrevious:()=>setImageIndex(imageIndex-1)}:{})} {...(imageIndex!==null&&d&&imageIndex<d.photos.length-1?{onNext:()=>setImageIndex(imageIndex+1)}:{})}/></View>;
}
const styles=StyleSheet.create({
  ownerRow:{flexDirection:'row',alignItems:'center',gap:12},ownerAvatar:{width:40,height:40,borderRadius:20,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',gap:3},avatarHead:{width:10,height:10,borderRadius:5,backgroundColor:colors.textSecondary},avatarBody:{width:20,height:10,borderTopLeftRadius:10,borderTopRightRadius:10,backgroundColor:colors.textSecondary},ownerName:{fontFamily:typography.family,fontSize:15,lineHeight:22,fontWeight:'600',color:colors.text,flexShrink:1},
  placesRetry:{minHeight:48,alignSelf:'flex-start',justifyContent:'center',paddingHorizontal:8},retryLabel:{fontFamily:typography.family,fontSize:14,fontWeight:'600',color:colors.primaryAction},
  placeCategory:{fontFamily:typography.family,fontSize:15,lineHeight:22,fontWeight:'600',color:colors.ink},placeRow:{gap:2,paddingVertical:5},
  detailContent:{padding:16,gap:20,paddingBottom:32},gallery:{alignItems:'flex-start'},heroImage:{width:'100%',aspectRatio:4/3,borderRadius:12,backgroundColor:colors.surface},photoCaption:{fontFamily:typography.family,fontSize:12,lineHeight:20,color:colors.textSecondary,paddingTop:6},summary:{gap:8},detailTitle:{fontFamily:typography.family,fontSize:24,lineHeight:31,fontWeight:'700',color:colors.text},detailPrice:{fontFamily:typography.family,fontSize:26,lineHeight:34,fontWeight:'800',color:colors.primary},small:{fontFamily:typography.family,fontSize:12,lineHeight:18,color:colors.textSecondary},facts:{flexDirection:'row',flexWrap:'wrap',gap:16,paddingVertical:12},fact:{fontFamily:typography.family,fontSize:15,lineHeight:23,fontWeight:'600',color:colors.text},detailSection:{gap:10,borderTopWidth:1,borderTopColor:colors.border,paddingTop:20},amenity:{fontFamily:typography.family,fontSize:14,lineHeight:22,color:colors.text,paddingVertical:6,paddingHorizontal:10,borderRadius:8,backgroundColor:colors.surface},screen:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,gap:spacing.md},section:{gap:spacing.sm,paddingVertical:spacing.xs},row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},heading:{fontFamily:typography.family,color:colors.text,fontSize:18,fontWeight:'700'},price:{fontFamily:typography.family,color:colors.primary,fontSize:21,fontWeight:'800'},copy:{fontFamily:typography.family,color:colors.textSecondary,fontSize:14,lineHeight:21},error:{fontFamily:typography.family,color:colors.restricted,fontSize:14,lineHeight:21},input:{borderWidth:1,borderColor:colors.border,borderRadius:8,minHeight:48,padding:spacing.sm,color:colors.text,fontSize:16},photo:{width:260,gap:spacing.sm},image:{width:'100%',aspectRatio:4/3,borderRadius:12},placeholder:{height:150,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface}});
