import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
export function LivePropertyDetailView({viewModel:vm}:{viewModel:SearchDiscoveryViewModel}) {
  const s=vm.manualState,d=s.detail;const [imageIndex,setImageIndex]=useState<number|null>(null);const photo=imageIndex===null?null:d?.photos[imageIndex];
  return <View style={styles.screen}><DiscoveryHeader title="Rental details" onBack={vm.goBack}/><ScrollView contentContainerStyle={styles.content}>
    {s.detailBusy?<ActivityIndicator accessibilityLabel="Loading rental" color={colors.primary}/>:null}
    {s.detailError?<><Text accessibilityRole="alert" style={styles.error}>{s.detailError}</Text><DiscoveryButton label="Retry details" onPress={()=>{if(s.selectedId)void vm.manual.openDetail(s.selectedId);}}/></>:null}
    {d?<><Text style={styles.heading}>{d.title}</Text><Text style={styles.price}>₱{d.rent.toLocaleString('en-PH')} /mo</Text>
      {d.photos.length?<ScrollView horizontal contentContainerStyle={styles.row}>{d.photos.map((p,i)=><View key={p.id} style={styles.photo}><Image source={{uri:p.url}} accessibilityLabel={p.alt??'Property photo'} style={styles.image}/><DiscoveryButton label={`View photo ${i+1}`} tone="outline" onPress={()=>setImageIndex(i)}/></View>)}</ScrollView>:<View style={styles.placeholder}><Text style={styles.copy}>No property photos available</Text></View>}
      <Text style={styles.copy}>{d.propertyType.replace(/_/g,' ')} · {d.barangay}, {cityLabels[d.city]??d.city}</Text><Text style={styles.copy}>{d.bedrooms} bedrooms · {d.bathrooms} bathrooms{d.floorArea===null?'':` · ${d.floorArea} sqm floor area`}</Text><Text style={styles.copy}>{d.furnishing.replace(/_/g,' ')}</Text>
      <Text style={styles.heading}>About this rental</Text><Text style={styles.copy}>{d.description}</Text><Text style={styles.copy}>{d.availableFrom?`Available from ${d.availableFrom}`:'Availability date not specified'}</Text><Text style={styles.copy}>{d.rentalTerm.replace(/_/g,' ')} · Deposit {d.depositMonths} month(s) · Advance {d.advanceMonths} month(s){d.minimumStay===null?'':` · Minimum stay ${d.minimumStay} month(s)`}</Text>
      {d.houseRules?<><Text style={styles.heading}>House rules</Text><Text style={styles.copy}>{d.houseRules}</Text></>:null}
      <Text style={styles.heading}>Property amenities</Text>{d.amenities.length?d.amenities.map((a,i)=><Text key={i} style={styles.copy}>{a}</Text>):<Text style={styles.copy}>No property amenities recorded.</Text>}
      <Text style={styles.copy}>Map presentation and nearby places are not available yet. Exact property locations are private.</Text>
    </>:null}
  </ScrollView><FullscreenDocumentImage visible={!!photo} uri={photo?.url??null} title="Property photo" onClose={()=>setImageIndex(null)} {...(imageIndex!==null&&imageIndex>0?{onPrevious:()=>setImageIndex(imageIndex-1)}:{})} {...(imageIndex!==null&&d&&imageIndex<d.photos.length-1?{onNext:()=>setImageIndex(imageIndex+1)}:{})}/></View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,gap:spacing.md},section:{gap:spacing.sm,paddingVertical:spacing.xs},row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},heading:{fontFamily:typography.family,color:colors.text,fontSize:18,fontWeight:'700'},price:{fontFamily:typography.family,color:colors.primary,fontSize:21,fontWeight:'800'},copy:{fontFamily:typography.family,color:colors.textSecondary,fontSize:14,lineHeight:21},error:{fontFamily:typography.family,color:colors.restricted,fontSize:14,lineHeight:21},input:{borderWidth:1,borderColor:colors.border,borderRadius:8,minHeight:48,padding:spacing.sm,color:colors.text,fontSize:16},photo:{width:260,gap:spacing.sm},image:{width:'100%',aspectRatio:4/3,borderRadius:12},placeholder:{height:150,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface}});
