import {ReportAction} from '../../../shared/components/Reporting';
import {SaveListingButton,SavedListingsFeedback} from '../components/SaveListingButton';
import {RentalFeedbackSection} from '../../../shared/components/RentalFeedbackSection';
import {PublicLocationMap} from '../../../shared/components/PublicLocationMap';
import {InlineRentalEstimate} from '../../../shared/components/InlineRentalEstimate';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import {KeyboardAwareScrollView as ScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {placeCategories,placeCategoryLabels} from '../../../shared/models/NearbyPlace';
import { useState,useEffect } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Pressable,  StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { DiscoveryButton, DiscoveryChip, DiscoveryHeader, DiscoverySearchBar } from '../components/DiscoveryControls';
import { SearchListingCard } from '../components/SearchListingCard';
import { cityLabels, type SearchFilters, type SearchSort } from '../models/ManualSearch';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';
import { FullscreenDocumentImage } from '../../../shared/components/FullscreenDocumentImage';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

export function LiveSearchResultsView({ viewModel:vm }: {viewModel:SearchDiscoveryViewModel}) {
  const s=vm.searchResultState??vm.manualState,busy=s.phase==='loading'||s.more;
  return <View style={styles.screen}><DiscoveryHeader title="Search Results" onBack={vm.goBack} actionLabel="Saved" onAction={vm.openSavedListings}/><FlatList data={s.rows} keyExtractor={r=>r.listingId} contentContainerStyle={styles.content} renderItem={({item})=><SearchListingCard listing={item} save={vm.savedControl?.(item.listingId)} onPress={()=>vm.openProperty(item.listingId)}/>}
    ListHeaderComponent={<View style={styles.section}>{vm.savedState?<SavedListingsFeedback error={vm.savedState.error} notice={vm.savedState.notice} pending={!!vm.savedState.pending} busy={!!vm.savedState.working} onRetry={vm.savedRetry}/>:null}
      <DiscoverySearchBar value={vm.query} onChangeText={vm.setQuery} onFocus={()=>vm.navigate('searchLocation')} onSubmit={vm.submitSearch} placeholder="Enter a city or barangay"/>
      <View style={styles.row}><DiscoveryButton label="Filters" tone="outline" onPress={vm.openLiveFilters}/><DiscoveryButton label="Sort" tone="outline" onPress={()=>vm.navigate('sort')}/></View>
      <Text style={styles.copy}>{vm.resultSortLabel??s.sort} · {s.rows.length} loaded</Text><Text style={styles.copy}>Use Nearby rentals for GPS-based map results.</Text>
      {busy?<View accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary}/><Text style={styles.copy}>{s.more?'Loading more rentals…':'Searching rentals…'}</Text></View>:null}
      {vm.rankedSearch?<Text style={styles.copy}>{vm.resultSortLabel==='Best Match'?'Best Match uses preference relevance only.':'Recommended uses 80% preference relevance, 10% verified-owner status when authorized, and 10% stored completeness.'} {vm.recommendationState.limited?'Limited to the first 100 recent filtered listings; not a global ranking.':`Ranked within ${vm.recommendationState.scanned} loaded published results.`}</Text>:null}
      {s.error?<><Text accessibilityRole="alert" style={styles.error}>{s.error}</Text><DiscoveryButton label="Retry" onPress={()=>void (vm.retryResults?vm.retryResults():vm.manual.retry())} disabled={busy}/></>:null}
      {s.phase==='success'&&!s.rows.length?<><Text style={styles.heading}>{vm.rankedSearch?'No loaded rentals match your saved preferences.':'No rentals available in this area yet.'}</Text><Text style={styles.copy}>{vm.rankedSearch?'Change Matching Preferences or filters. More rentals may exist outside the loaded pool.':'Try another city or search nearby.'}</Text></>:null}
    </View>}
    ListFooterComponent={<View style={styles.section}>{s.hasMore&&!s.error?<DiscoveryButton label="Load more" disabled={busy} onPress={()=>void vm.manual.loadMore()}/>:null}<DiscoveryButton label="Search another location" tone="outline" onPress={()=>vm.navigate('searchLocation')}/><DiscoveryButton label="Search nearby" tone="outline" onPress={vm.requestCurrentLocation}/></View>}/></View>;
}
const sorts:SearchSort[]=['Recently Listed','Price: Low to High','Price: High to Low'];
const propertyTypes=['apartment','boarding_house','bedspace','room','studio','condominium','house','dormitory','other'] as const;
export function LiveSearchFiltersView({viewModel:vm}:{viewModel:SearchDiscoveryViewModel}) {
  const f=vm.liveFilterDraft;
  const update=<K extends keyof SearchFilters>(key:K,value:SearchFilters[K])=>vm.setLiveFilterDraft({...f,[key]:value});
  if(vm.screen==='sort')return <View style={styles.screen}><DiscoveryHeader title="Sort rentals" onBack={vm.goBack}/><View style={styles.content}>{sorts.map(sort=><DiscoveryChip key={sort} label={sort} selected={!vm.rankedSearch&&vm.manualState.sort===sort} onPress={()=>vm.chooseLiveSort(sort)}/>)}{(['Recommended','Best Match'] as const).map(sort=><DiscoveryChip key={sort} label={sort} selected={vm.rankedSearch&&vm.resultSortLabel===sort} disabled={!vm.hasRecommendationPreferences} onPress={()=>vm.chooseSort(sort)}/>)}<Text style={styles.copy}>Recommended adds modest quality bonuses; Best Match uses preference relevance alone. Both rank a bounded set of recent filtered listings. Save Matching Preferences to enable them.</Text></View></View>;
  return <View style={styles.screen}><DiscoveryHeader title="Filters" onBack={vm.goBack}/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.heading}>City</Text><View style={styles.row}><DiscoveryChip label="Any city" selected={!f.city} onPress={()=>update('city','')}/>{(['imus','dasmarinas','tagaytay'] as const).map(city=><DiscoveryChip key={city} label={cityLabels[city]!} selected={f.city===city} onPress={()=>update('city',city)}/>)}</View>
    <Text style={styles.heading}>Property type</Text><View style={styles.row}>{propertyTypes.map(type=><DiscoveryChip key={type} label={type.replace(/_/g,' ')} selected={f.types.includes(type)} onPress={()=>update('types',f.types.includes(type)?f.types.filter(t=>t!==type):[...f.types,type])}/>)}</View>
    {([['minRent','Minimum monthly rent'],['maxRent','Maximum monthly rent'],['minBeds','Minimum bedrooms'],['minBaths','Minimum bathrooms'],['minFloorArea','Minimum floor area (sqm)']] as const).map(([key,label])=><View key={key} style={styles.section}><Text style={styles.copy}>{label}</Text><TextInput accessibilityLabel={label} value={f[key]===null?'':String(f[key])} onChangeText={text=>update(key,text.trim()?Number(text):key==='minBeds'||key==='minBaths'?0:null)} keyboardType="decimal-pad" style={styles.input}/></View>)}
    <Text style={styles.heading}>Furnishing</Text><View style={styles.row}><DiscoveryChip label="Any furnishing" selected={!f.furnishing} onPress={()=>update('furnishing','')}/>{(['unfurnished','semi_furnished','furnished'] as const).map(value=><DiscoveryChip key={value} label={value.replace(/_/g,' ')} selected={f.furnishing===value} onPress={()=>update('furnishing',value)}/>)}</View>
    <Text style={styles.heading}>Property amenities</Text><Text style={styles.copy}>Match any selected amenity. Nearby places are not included.</Text>{vm.manualState.catalogueError?<Text accessibilityRole="alert" style={styles.error}>{vm.manualState.catalogueError}</Text>:null}<View style={styles.row}>{vm.manualState.amenities.map(a=><DiscoveryChip key={a.id} label={a.name} selected={f.amenityIds.includes(a.id)} onPress={()=>update('amenityIds',f.amenityIds.includes(a.id)?f.amenityIds.filter(id=>id!==a.id):[...f.amenityIds,a.id])}/>)}</View>
    <DiscoveryButton label="Apply filters" onPress={vm.applyLiveFilters}/><DiscoveryButton label="Reset filters" tone="outline" onPress={vm.resetLiveFilters}/>
  </ScrollView></View>;
}
function DetailExpandableText({text}:{text:string}){const [open,setOpen]=useState(false),letters=Array.from(text),long=letters.length>600;return <View style={{gap:8}}><Text style={styles.copy}>{long&&!open?letters.slice(0,600).join('')+'...':text}</Text>{long?<Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={styles.placesRetry}><Text style={styles.retryLabel}>{open?'Show less':'Read full text'}</Text></Pressable>:null}</View>;}
function DetailGalleryPhoto({url,label,width,onPress}:{url:string;label:string;width:number;onPress:()=>void}) {
  const [failed,setFailed]=useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{width}}>
    {failed?<View style={[styles.heroImage,styles.placeholder]}><Text style={styles.copy}>Photo unavailable</Text></View>:<Image source={{uri:url}} onError={()=>setFailed(true)} accessibilityLabel="Property photo" style={styles.heroImage}/>}
    <Text style={styles.photoCaption}>{label}</Text>
  </Pressable>;
}
export function LivePropertyDetailView({viewModel:vm,accountId,onOpenPriceEstimate,onManageRental}:{onManageRental?:()=>void;accountId?:string|undefined;onOpenPriceEstimate?:()=>void;viewModel:Pick<SearchDiscoveryViewModel,'manualState'|'manual'|'goBack'|'isOwnListing'|'listingOwnerIdentity'|'listingOwnerLabel'>&Partial<Pick<SearchDiscoveryViewModel,'contactOwner'|'savedControl'|'savedState'|'savedRetry'>>}) {
  const s=vm.manualState,d=s.detail;const [imageIndex,setImageIndex]=useState<number|null>(null);
  const [locationTab,setLocationTab]=useState<'map'|'places'>('map');
  useEffect(()=>{setImageIndex(null);setLocationTab('map');},[accountId,d?.listingId]);
  const photo=imageIndex===null?null:d?.photos[imageIndex];
  const photoWidth=Math.max(200,Math.min(650,useWindowDimensions().width)-32);
  return <View style={styles.screen}><DiscoveryHeader title="Rental details" onBack={vm.goBack}/><ScrollView contentContainerStyle={styles.detailContent}>
    {s.detailBusy?<ActivityIndicator accessibilityLabel="Loading rental" color={colors.primary}/>:null}
    {s.detailError?<View style={styles.detailSection}><Text accessibilityRole="alert" style={styles.error}>{s.detailError}</Text><DiscoveryButton label="Retry details" onPress={()=>{if(s.selectedId)void vm.manual.openDetail(s.selectedId);}}/></View>:null}
    {d?<>
      <View style={styles.galleryShell}>{d.photos.length>0?<ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator contentContainerStyle={styles.gallery}>{d.photos.map((p,i)=><DetailGalleryPhoto key={p.id} url={p.url} width={photoWidth} label={`View photo ${i+1} of ${d.photos.length}`} onPress={()=>setImageIndex(i)}/>)}</ScrollView>:<View style={[styles.heroImage,styles.placeholder]}><Text style={styles.copy}>No property photos available</Text></View>}
      {vm.savedControl?<View style={styles.galleryHeart}><SaveListingButton control={vm.savedControl(d.listingId)}/></View>:null}</View>
      {vm.savedState&&vm.savedRetry?<SavedListingsFeedback error={vm.savedState.error} notice={vm.savedState.notice} pending={!!vm.savedState.pending} busy={!!vm.savedState.working} onRetry={vm.savedRetry}/>:null}
      <View style={styles.summary}><Text style={styles.detailPrice}>₱{d.rent.toLocaleString('en-PH')}<Text style={styles.copy}> / month</Text></Text>
        <Text accessibilityRole="header" style={styles.detailTitle}>{d.title}</Text>
        <Text style={styles.copy}>{d.barangay}, {cityLabels[d.city]??d.city}</Text><Text style={styles.small}>Approximate area · Exact property location is private</Text>
        <View style={styles.facts}><Text style={styles.fact}>{d.bedrooms} bedrooms</Text><Text style={styles.fact}>{d.bathrooms} bathrooms</Text>{d.floorArea!==null?<Text style={styles.fact}>{d.floorArea} sqm</Text>:null}</View>
        <Text style={styles.copy}>{d.propertyType.replace(/_/g,' ')} · {d.furnishing.replace(/_/g,' ')}</Text>
      </View>
      <View style={styles.spotlight}><InlineRentalEstimate variant="spotlight" askingRent={d.rent} key={`${accountId}:${d.listingId}`} accountId={accountId} target={{listingId:d.listingId}} property={{property_type:d.propertyType,city:d.city,furnishing_status:d.furnishing,bedrooms:d.bedrooms,bathrooms:d.bathrooms,floor_area_sqm:d.floorArea}}/></View>
      <View style={styles.detailSection}>
        <Text style={styles.small}>Listed by</Text>
        <View style={styles.ownerRow}>
          <PublicAvatar url={vm.listingOwnerIdentity?.avatarUrl} name={vm.listingOwnerIdentity?.nickname}/>
          <Text style={styles.ownerName}>{vm.listingOwnerLabel}</Text>
        </View>
        {vm.isOwnListing?<Text style={styles.copy}>This is your listing.</Text>:null}
      </View>
      <View style={styles.spotlight}><RentalFeedbackSection key={`${accountId}:${d.listingId}`} accountId={accountId} propertyId={d.propertyId} ownerId={d.ownerId}/></View>
      <View style={styles.spotlight}><View style={{gap:4}}><Text style={styles.kicker}>Explore the neighborhood</Text><Text accessibilityRole="header" style={styles.heading}>Location & Nearby Places</Text><Text style={styles.small}>Understand the area before reaching out.</Text></View><View style={styles.locationCard}>
      <View style={styles.locationSummary}><Text style={styles.locationSymbol} accessible={false}>{'\u2316'}</Text><View style={{flex:1,gap:3}}><Text style={styles.locationName}>{d.barangay}, {cityLabels[d.city]??d.city}</Text><Text style={styles.small}>Public approximate location</Text></View></View>
      <View style={{marginHorizontal:12}}>{d.publicLocation?<PublicLocationMap compact key={`${accountId}:${d.propertyId}`} latitude={d.publicLocation.latitude} longitude={d.publicLocation.longitude}/>:<Text style={styles.copy}>No usable public location is available for this rental.</Text>}</View>
      <View style={styles.locationSwitch}>{(['map','places'] as const).map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:locationTab===tab}} onPress={()=>setLocationTab(tab)} style={[styles.locationTab,locationTab===tab?{backgroundColor:colors.background}:null]}><Text style={[styles.retryLabel,{textAlign:'center',fontSize:12}]}>{tab==='map'?'Map & Location':'Nearby Places'}</Text></Pressable>)}</View>
      {locationTab==='map'?<View style={styles.locationContent}><Text style={styles.copy}>Explore the public area on the map above.</Text><Text style={styles.small}>The exact property location remains private. This map shows the generalized rental area.</Text></View>:<View style={styles.locationContent}>
        <Text style={styles.small}>OpenStreetMap nearby places</Text>
        <Text style={styles.copy}>Places around this property's approximate location.</Text>
        <Text style={styles.small}>Within about 2 km. Distances are approximate and straight-line, not walking or driving distances.</Text>
          {!d.publicLocation?<Text style={styles.copy}>Nearby places are unavailable because this property has no usable public location.</Text>:null}
          {s.placesPhase==='loading'?<View accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary}/><Text style={styles.copy}>Loading nearby places...</Text></View>:null}
          {s.placesPhase==='error'?<><Text accessibilityRole="alert" style={styles.error}>{s.placesError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry nearby places" onPress={()=>void vm.manual.loadPlaces()} style={styles.placesRetry}><Text style={styles.retryLabel}>Retry</Text></Pressable></>:null}
          {s.placesStale?<Text style={styles.small}>{s.placesPhase==='loading'?'Previously loaded places. Checking for updates...':`Showing previously fetched nearby places${s.placesFetchedAt?' ('+new Date(s.placesFetchedAt).toLocaleDateString('en-PH')+')':''}; these results may be outdated.`}</Text>:null}
          {s.placesPhase==='success'||s.placesRows?.length?placeCategories.filter(category=>s.placesRows.some(p=>p.category===category)).map(category=>{const rows=s.placesRows.filter(p=>p.category===category);return <View key={category} style={styles.section}>
            <Text style={styles.placeCategory}>{placeCategoryLabels[category]}</Text>
            {rows.length?rows.map(p=><View key={p.providerId??`${p.osmType}:${p.osmId}`} style={styles.placeRow}><Text style={styles.copy}>{p.name}</Text><Text style={styles.small}>{placeCategoryLabels[p.category]} &middot; Approx. {p.distanceMeters<1000?`${Math.round(p.distanceMeters/10)*10} m`:`${(p.distanceMeters/1000).toFixed(1)} km`}</Text></View>):<Text style={styles.small}>No named places mapped in this category within this area.</Text>}
          </View>;}):null}
          {s.placesPhase==='success'&&s.placesRows.length===0?<Text style={styles.copy}>No named nearby places are mapped within this area.</Text>:null}
          {s.placesLimited?<Text style={styles.small}>Showing a bounded provider result set; coverage may be incomplete.</Text>:null}
          <Text accessibilityRole="link" onPress={()=>void Linking.openURL('https://www.geoapify.com/')} style={styles.retryLabel}>Powered by Geoapify</Text>
          <Text selectable style={styles.small}>&copy; OpenStreetMap contributors &middot; openstreetmap.org/copyright{'\n'}Coverage may be incomplete.</Text>
      </View>}
      </View></View>
      <View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>About this rental</Text><DetailExpandableText key={d.listingId} text={d.description}/></View>
      <View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>Amenities</Text>{d.amenities.length?<View style={styles.row}>{d.amenities.map((a,i)=><Text key={i} style={styles.amenity}>{a}</Text>)}</View>:<Text style={styles.copy}>No property amenities recorded.</Text>}</View>
      <View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>Availability & Rental Terms</Text>{[['Availability',d.availableFrom??'Not specified'],['Rental duration',d.rentalTerm.replace(/_/g,' ')],['Minimum stay',d.minimumStay===null?'Not specified':`${d.minimumStay} months`],['Security deposit',`${d.depositMonths} months`],['Advance rent',`${d.advanceMonths} months`]].map(([label,value])=><View key={label} style={{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between'}}><Text style={styles.copy}>{label}</Text><Text style={[styles.copy,{color:colors.ink,flexShrink:1}]}>{value}</Text></View>)}</View>
      {d.houseRules?<View style={styles.detailSection}><Text accessibilityRole="header" style={styles.heading}>House rules</Text><DetailExpandableText key={d.listingId} text={d.houseRules}/></View>:null}
      <View style={styles.detailSection}>{vm.isOwnListing?null:vm.contactOwner?<DiscoveryButton label={s.inquiryBusy?'Opening conversation...':'Contact Owner'} disabled={s.inquiryBusy} onPress={()=>void vm.contactOwner?.()}/>:null}
        {s.inquiryError?<Text accessibilityRole="alert" style={styles.error}>{s.inquiryError}</Text>:null}
{vm.isOwnListing&&onManageRental?<DiscoveryButton label="Manage in My Rentals" tone="outline" onPress={onManageRental}/>:null}{!vm.isOwnListing?<ReportAction accountId={accountId} kind="listing" contextId={d.listingId}/>:null}</View>
    </>:null}
  </ScrollView><FullscreenDocumentImage visible={!!photo} uri={photo?.url??null} title="Property photo" onClose={()=>setImageIndex(null)} {...(imageIndex!==null&&imageIndex>0?{onPrevious:()=>setImageIndex(imageIndex-1)}:{})} {...(imageIndex!==null&&d&&imageIndex<d.photos.length-1?{onNext:()=>setImageIndex(imageIndex+1)}:{})}/></View>;
}
const styles=StyleSheet.create({
  galleryShell:{position:'relative'},galleryHeart:{position:'absolute',top:12,right:12},spotlight:{gap:11,borderTopWidth:7,borderTopColor:colors.surface,paddingTop:19},estimateSpotlight:{gap:10,padding:16,backgroundColor:colors.primaryPale,borderRadius:14},kicker:{fontFamily:typography.family,fontSize:10,lineHeight:16,fontWeight:'800',letterSpacing:.95,textTransform:'uppercase',color:colors.primaryAction},locationCard:{borderWidth:1,borderColor:colors.outline,borderRadius:16,overflow:'hidden'},locationSummary:{flexDirection:'row',alignItems:'center',gap:10,padding:13},locationSymbol:{fontSize:24,color:colors.primaryAction,backgroundColor:colors.primaryPale,borderRadius:10,padding:5},locationName:{fontFamily:typography.family,fontSize:14,lineHeight:20,fontWeight:'700',color:colors.ink},locationSwitch:{flexDirection:'row',gap:4,padding:4,marginHorizontal:12,marginTop:12,borderRadius:10,backgroundColor:colors.surface},locationContent:{paddingVertical:12,paddingHorizontal:14,gap:8,minHeight:82},locationTab:{flex:1,minWidth:0,minHeight:48,padding:8,borderRadius:8,justifyContent:'center'},
  ownerRow:{flexDirection:'row',alignItems:'center',gap:12},ownerAvatar:{width:40,height:40,borderRadius:20,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',gap:3},avatarHead:{width:10,height:10,borderRadius:5,backgroundColor:colors.textSecondary},avatarBody:{width:20,height:10,borderTopLeftRadius:10,borderTopRightRadius:10,backgroundColor:colors.textSecondary},ownerName:{fontFamily:typography.family,fontSize:15,lineHeight:22,fontWeight:'600',color:colors.text,flexShrink:1},
  placesRetry:{minHeight:48,alignSelf:'flex-start',justifyContent:'center',paddingHorizontal:8},retryLabel:{fontFamily:typography.family,fontSize:14,fontWeight:'600',color:colors.primaryAction},
  placeCategory:{fontFamily:typography.family,fontSize:15,lineHeight:22,fontWeight:'600',color:colors.ink},placeRow:{gap:2,paddingVertical:5},
  detailContent:{padding:16,gap:16,paddingBottom:32,maxWidth:650,width:'100%',alignSelf:'center'},gallery:{alignItems:'flex-start'},heroImage:{width:'100%',aspectRatio:4/3,borderRadius:12,backgroundColor:colors.surface},photoCaption:{fontFamily:typography.family,fontSize:12,lineHeight:20,color:colors.textSecondary,paddingTop:6},summary:{gap:8},detailTitle:{fontFamily:typography.family,fontSize:24,lineHeight:31,fontWeight:'700',color:colors.text},detailPrice:{fontFamily:typography.family,fontSize:26,lineHeight:34,fontWeight:'800',color:colors.primaryAction},small:{fontFamily:typography.family,fontSize:12,lineHeight:18,color:colors.textSecondary},facts:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingVertical:10},fact:{fontFamily:typography.family,fontSize:14,lineHeight:22,fontWeight:'600',color:colors.text,backgroundColor:colors.surface,padding:11,borderRadius:11,flexGrow:1},detailSection:{gap:10,borderTopWidth:1,borderTopColor:colors.border,paddingTop:14},amenity:{fontFamily:typography.family,fontSize:14,lineHeight:22,color:colors.text,paddingVertical:6,paddingHorizontal:10,borderRadius:8,backgroundColor:colors.surface},screen:{flex:1,backgroundColor:colors.background},content:{padding:spacing.lg,gap:spacing.md},section:{gap:spacing.sm,paddingVertical:spacing.xs},row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},heading:{fontFamily:typography.family,color:colors.text,fontSize:18,fontWeight:'700'},price:{fontFamily:typography.family,color:colors.primary,fontSize:21,fontWeight:'800'},copy:{fontFamily:typography.family,color:colors.textSecondary,fontSize:14,lineHeight:21},error:{fontFamily:typography.family,color:colors.restricted,fontSize:14,lineHeight:21},input:{borderWidth:1,borderColor:colors.border,borderRadius:8,minHeight:48,padding:spacing.sm,color:colors.text,fontSize:16},photo:{width:260,gap:spacing.sm},image:{width:'100%',aspectRatio:4/3,borderRadius:12},placeholder:{height:150,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface}});
