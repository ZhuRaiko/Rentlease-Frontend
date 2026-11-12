import {HeartIcon} from '../../../shared/components/HeartIcon';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import {useState} from 'react';
import {InterfaceIcon} from '../../../shared/components/InterfaceIcon';
import {ActivityIndicator,FlatList,Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {DiscoveryButton,DiscoveryHeader,DiscoverySearchBar} from '../components/DiscoveryControls';
import {DiscoveryIcon} from '../components/DiscoveryIcon';
import {SavedListingsFeedback} from '../components/SaveListingButton';
import {SearchListingCard} from '../components/SearchListingCard';
import type {SearchDiscoveryViewModel} from '../viewModels/useSearchDiscoveryViewModel';
const rentLeaseHome=require('../../../assets/authentication/rentlease-home.png');
interface TenantDiscoveryViewProps {avatarUrl?:string|null|undefined;avatarKey?:string;notificationUnread?:number|null;viewModel:SearchDiscoveryViewModel;onClose:()=>void;onOpenNotifications:()=>void}
export function TenantDiscoveryView({avatarUrl,avatarKey='anonymous',notificationUnread=null,viewModel:vm,onClose,onOpenNotifications}:TenantDiscoveryViewProps){
 const [matchingInfo,setMatchingInfo]=useState(false);
 if(vm.screen!=='home')return <View style={styles.screen}><DiscoveryHeader onBack={vm.goBack} title="Discovery"/><View style={styles.stateScreen}><Text style={styles.stateTitle}>This feature is not connected yet</Text><DiscoveryButton label="Search rentals" onPress={()=>vm.navigate('searchLocation')}/></View></View>;
 const viewModel=vm,personalized=vm.homeTab==='forYou',s=vm.discoverState,r=vm.recommendationState;
 const rows=personalized?(r?.recommended??[]).map(row=>row.candidate.listing):(vm.discoverRows??s.rows);
 const loading=personalized?vm.hasRecommendationPreferences&&(r?.phase==='idle'||r?.phase==='loading'):s.phase==='idle'||s.phase==='loading';
 return <View style={styles.screen}>
    <View style={styles.feedHeader}>
      <View style={styles.wordmark}><Text accessibilityRole="header" style={styles.wordmarkText}>RentLease</Text><Image resizeMode="contain" source={rentLeaseHome} style={styles.wordmarkIcon}/></View>
      <View style={styles.headerActions}><Pressable accessibilityLabel="Open Saved Listings" accessibilityRole="button" onPress={viewModel.openSavedListings} style={styles.headerAction}><HeartIcon color={colors.ink}/></Pressable>
        <Pressable accessibilityLabel={notificationUnread===null?'Open Notifications, unread count unavailable':`Open Notifications, ${notificationUnread} unread`} accessibilityRole="button" onPress={onOpenNotifications} style={styles.headerAction}><View style={styles.notificationIcon}><InterfaceIcon name="notifications" color={colors.text}/>{notificationUnread!==null&&notificationUnread>0?<View pointerEvents="none" accessible={false} style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{notificationUnread>99?'99+':String(notificationUnread)}</Text></View>:null}</View></Pressable>
        <Pressable accessibilityLabel="Open Profile" accessibilityRole="button" onPress={onClose} style={styles.headerAction}><PublicAvatar key={avatarKey} url={avatarUrl} size={33}/></Pressable>
      </View>
    </View>
    <View style={styles.feedTabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{selected:!personalized}} style={styles.feedTabTarget} onPress={viewModel.openHome}><Text style={personalized?styles.feedTabMuted:styles.feedTabActive}>Discover</Text></Pressable>
      <View style={styles.tabDivider}/>
      <Pressable accessibilityRole="tab" accessibilityState={{selected:personalized}} style={styles.feedTabTarget} onPress={viewModel.openForYou}><Text style={personalized?styles.feedTabActive:styles.feedTabMuted}>For You</Text></Pressable>
    </View>

 <FlatList data={rows} keyExtractor={row=>row.listingId} style={styles.feedScroll} contentContainerStyle={styles.listContent}
 renderItem={({item})=><View><SearchListingCard discovery listing={item} save={vm.savedControl?.(item.listingId)} onPress={()=>vm.openProperty(item.listingId)}/>{personalized?<Text style={styles.copy}>{r?.recommended.find(row=>row.candidate.listing.listingId===item.listingId)?.reasons.join(' | ')||'Selected property preferences'}</Text>:null}</View>}
 refreshing={personalized?r?.phase==='loading':!!s.refreshing} onRefresh={()=>{if(personalized)void vm.recommendations.load();else if(vm.refreshDiscover)vm.refreshDiscover();else void vm.discover.refresh();}}
 onEndReached={()=>{if(!personalized)void vm.discover.loadMore();}} onEndReachedThreshold={0.4}
 ListHeaderComponent={<View style={styles.searchPad}>
 <View style={styles.hero}><Text style={styles.eyebrow}>{personalized?'A more personal search':'Find your next place'}</Text><Text accessibilityRole="header" style={styles.headline}>{personalized?'Rentals for you.':'A home that fits your everyday.'}</Text></View>
 {personalized?<>
  <Pressable accessibilityRole="button" onPress={vm.openMatchingPreferences} style={styles.preferenceAction}><Text style={styles.preferenceText}>{vm.hasRecommendationPreferences?'Edit preferences':'Set matching preferences'}</Text></Pressable>
  <View style={styles.headingRow}><Text accessibilityRole="header" style={styles.sectionTitle}>Recommended rentals</Text><Pressable accessibilityRole="button" accessibilityLabel="How recommendations work" accessibilityState={{expanded:matchingInfo}} onPress={()=>setMatchingInfo(!matchingInfo)} style={styles.infoAction}><Text style={styles.preferenceText}>How it works</Text></Pressable></View>
  {matchingInfo?<View style={styles.explanation}><Text style={styles.copy}>Recommended ordering uses your preferences (80%), confirmed owner Tier 2 identity verification (10%), and listing completeness (10%). Listings without confirmed verification remain eligible. Verification does not guarantee property ownership or safety.</Text><Text style={styles.copy}>Based on saved preferences and current filters, within a limited pool of recent listings. Not a price prediction. Unknown owner verification earns no bonus.</Text></View>:null}
  <Text style={styles.copy}>{vm.hasRecommendationPreferences?'Recommendations are suggestions, not guarantees.':'Save matching preferences to find rentals based on what matters to you.'}</Text>
  {r?.phase==='success'&&vm.hasRecommendationPreferences?<><Text style={styles.copy}>{r.limited?'Ranking covers the first 100 recent filtered listings.':`Ranking covers ${r.scanned} loaded listings.`}</Text><DiscoveryButton label="View ranked rentals" tone="outline" onPress={vm.openRecommendedResults}/></>:null}
  {r?.phase==='unavailable'?<Text style={styles.copy}>Choose a supported location, budget, property type, room count, furnishing, or amenity preference to enable ranking.</Text>:null}
  {r?.error?<View><Text accessibilityRole="alert" style={styles.error}>{r.error}</Text><DiscoveryButton label="Retry recommendations" tone="outline" onPress={()=>void vm.recommendations.load()}/></View>:null}
 </>:<>
  <DiscoverySearchBar value="" onChangeText={vm.setQuery} onFocus={()=>vm.navigate('searchLocation')} onSubmit={()=>vm.navigate('searchLocation')} placeholder="Search a city or barangay"/>
  <Pressable accessibilityRole="button" accessibilityLabel="Nearby rentals" onPress={vm.requestCurrentLocation} style={styles.nearbyAction}><DiscoveryIcon name="location" color={colors.primaryAction} size={20}/><Text style={styles.nearbyLabel}>Explore nearby rentals</Text><Text style={styles.preferenceText}>Use my location</Text></Pressable>
  <View style={styles.hero}><Text accessibilityRole="header" style={styles.sectionTitle}>Recently published</Text><Text style={styles.copy}>Available rentals across RentLease's supported cities.</Text></View>
  {s.error?<View accessibilityRole="alert"><Text style={styles.error}>{s.error}</Text><DiscoveryButton label="Retry listings" tone="outline" disabled={s.refreshing||s.more} onPress={()=>void vm.discover.retry()}/></View>:null}
 </>}
 {vm.savedState?.error?<SavedListingsFeedback error={vm.savedState.error} notice={null} pending={!!vm.savedState.pending} busy={!!vm.savedState.working} onRetry={vm.savedRetry}/>:null}
 {vm.notice?<Text style={styles.feedNotice}>{vm.notice}</Text>:null}
 {loading?<View style={styles.loading}><ActivityIndicator accessibilityLabel={personalized?'Loading recommendations':'Loading rentals'} color={colors.primaryAction}/><Text style={styles.copy}>{personalized?'Finding matching rentals...':'Loading rentals...'}</Text></View>:null}
 </View>}
 ListEmptyComponent={personalized?r?.phase==='success'&&vm.hasRecommendationPreferences?<View style={styles.empty}><Text style={styles.sectionTitle}>No matching rentals yet</Text><Text style={styles.copy}>Try changing your preferences or filters.</Text></View>:null:s.phase==='success'&&!s.refreshing&&!s.error?<View style={styles.empty}><Text style={styles.sectionTitle}>No available rentals yet.</Text><Text style={styles.copy}>Published rentals will appear here when they are available.</Text></View>:null}
 ListFooterComponent={<View style={styles.loading}>{!personalized?(s.more?<ActivityIndicator accessibilityLabel="Loading more rentals" color={colors.primaryAction}/>:s.hasMore&&!s.error?<DiscoveryButton label="Load more rentals" tone="outline" disabled={s.refreshing} onPress={()=>void vm.discover.loadMore()}/>:null):null}</View>}/>
 {vm.saveToast?<View pointerEvents="none" accessibilityLiveRegion="polite" style={styles.toast}><Text style={styles.toastText}>{vm.saveToast}</Text></View>:null}
 </View>;
}
const styles=StyleSheet.create({
  hero:{gap:6,paddingTop:8,paddingBottom:12},eyebrow:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},headline:{...ui.pageTitle,fontSize:26,lineHeight:33,color:colors.ink},nearbyAction:{flexWrap:'wrap',minHeight:48,padding:12,borderRadius:12,backgroundColor:colors.primaryPale,flexDirection:'row',alignItems:'center',gap:10},nearbyLabel:{...ui.supporting,color:colors.primaryAction,fontWeight:'700',flex:1},toast:{position:'absolute',bottom:16,left:20,right:20,backgroundColor:colors.ink,borderRadius:12,padding:14},toastText:{...ui.supporting,color:colors.white,textAlign:'center'},explanation:{padding:14,gap:8,backgroundColor:colors.primaryPale,borderRadius:12},
  headingRow:{flexWrap:'wrap',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},infoAction:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},preferenceAction:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},preferenceText:{...ui.supporting,color:colors.primaryAction},recommendations:{gap:6,paddingVertical:8},recommendationCards:{gap:12},recommendationCard:{width:280,gap:5},screen:{backgroundColor:colors.canvas,flex:1},feedHeader:{...ui.rule,backgroundColor:colors.background,alignItems:'center',flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',minHeight:64,gap:spacing.sm,paddingHorizontal:spacing.md,paddingVertical:spacing.xs},
  wordmark:{alignItems:'center',flexDirection:'row',gap:spacing.xxs,flex:1,minWidth:0},wordmarkText:{color:colors.ink,fontFamily:typography.family,fontSize:23,fontWeight:'700',letterSpacing:-0.5,flexShrink:1},wordmarkIcon:{height:26,width:26},
  notificationIcon:{position:'relative',width:24,height:24,overflow:'visible'},notificationBadge:{position:'absolute',top:-10,right:-12,minWidth:20,minHeight:20,paddingHorizontal:4,borderRadius:12,backgroundColor:colors.primaryAction,alignItems:'center',justifyContent:'center'},notificationBadgeText:{color:colors.white,fontFamily:typography.family,fontWeight:'700',fontSize:11,lineHeight:15},
  headerActions:{alignItems:'center',flexDirection:'row',gap:spacing.xs},headerAction:{alignItems:'center',justifyContent:'center',minHeight:48,minWidth:48},headerAvatar:{borderColor:colors.border,borderRadius:18,borderWidth:1,height:33,width:33},
  feedTabs:{backgroundColor:colors.background,alignItems:'center',flexDirection:'row',gap:spacing.md,minHeight:50,justifyContent:'center'},feedTabTarget:{minHeight:48,justifyContent:'center',paddingHorizontal:spacing.sm},feedTabMuted:{...ui.supporting,fontSize:14},feedTabActive:{color:colors.primaryAction,fontFamily:typography.family,fontSize:14,fontWeight:'700',borderBottomWidth:2,borderBottomColor:colors.primaryAction,paddingVertical:spacing.xs},tabDivider:{backgroundColor:colors.text,height:18,width:1},
  feedNotice:{...ui.supporting,backgroundColor:colors.background,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},feedScroll:{flex:1},feedContent:{flexGrow:1,justifyContent:'center',alignItems:'center',gap:spacing.sm,padding:spacing.sm,maxWidth:600,width:'100%',alignSelf:'center'},
  listContent:{padding:spacing.md,paddingBottom:spacing.xl,maxWidth:600,width:'100%',alignSelf:'center'},searchPad:{gap:spacing.sm},loading:{gap:spacing.sm,paddingVertical:spacing.sm},copy:{...ui.supporting},error:{...ui.supporting,color:colors.restricted},sectionTitle:{...ui.sectionTitle},
  empty:{gap:spacing.sm,paddingVertical:spacing.xl},stateScreen:{alignItems:'center',flex:1,gap:spacing.md,justifyContent:'center',padding:spacing.xl},stateTitle:{color:colors.text,fontFamily:typography.family,fontSize:24,fontWeight:'900',textAlign:'center'},stateBody:{color:colors.textSecondary,fontFamily:typography.family,fontSize:14,lineHeight:21,maxWidth:330,textAlign:'center'},
});
