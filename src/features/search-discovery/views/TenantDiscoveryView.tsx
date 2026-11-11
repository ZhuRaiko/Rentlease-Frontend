import {SavedListingsFeedback} from '../components/SaveListingButton';
import {useState} from 'react';
import { InterfaceIcon } from '../../../shared/components/InterfaceIcon';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryHeader, DiscoverySearchBar } from '../components/DiscoveryControls';
import { SearchListingCard } from '../components/SearchListingCard';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';
const profileAvatar = require('../../../assets/authentication/profile-avatar.png');
const rentLeaseHome = require('../../../assets/authentication/rentlease-home.png');
interface TenantDiscoveryViewProps {notificationUnread?:number|null;viewModel:SearchDiscoveryViewModel;onClose:()=>void;onOpenNotifications:()=>void}
export function TenantDiscoveryView({notificationUnread=null,viewModel,onClose,onOpenNotifications}:TenantDiscoveryViewProps){
  const [matchingInfo,setMatchingInfo]=useState(false);
  if(viewModel.screen!=='home')return <View style={styles.screen}><DiscoveryHeader onBack={viewModel.goBack} title="Discovery"/><View style={styles.stateScreen}><Text style={styles.stateTitle}>This feature is not connected yet</Text><Text style={styles.stateBody}>Search available rentals or use Nearby rentals for GPS map results.</Text><DiscoveryButton label="Search rentals" onPress={()=>viewModel.navigate('searchLocation')}/></View></View>;
  const community=viewModel.homeTab==='forYou',s=viewModel.discoverState,r=viewModel.recommendationState;
  return <View style={styles.screen}>
    <View style={styles.feedHeader}>
      <View style={styles.wordmark}><Text accessibilityRole="header" style={styles.wordmarkText}>RentLease</Text><Image resizeMode="contain" source={rentLeaseHome} style={styles.wordmarkIcon}/></View>
      <View style={styles.headerActions}><Pressable accessibilityLabel="Open Saved Listings" accessibilityRole="button" onPress={viewModel.openSavedListings} style={styles.headerAction}><Text style={{fontSize:24,color:colors.primaryAction}}>?</Text></Pressable>
        <Pressable accessibilityLabel={notificationUnread===null?'Open Notifications, unread count unavailable':`Open Notifications, ${notificationUnread} unread`} accessibilityRole="button" onPress={onOpenNotifications} style={styles.headerAction}><InterfaceIcon name="notifications" color={colors.text}/>{notificationUnread!==null&&notificationUnread>0?<Text style={{color:colors.primaryAction,fontWeight:'700'}}>{notificationUnread>99?'99+':notificationUnread}</Text>:null}</Pressable>
        <Pressable accessibilityLabel="Open Profile" accessibilityRole="button" onPress={onClose} style={styles.headerAction}><Image resizeMode="cover" source={profileAvatar} style={styles.headerAvatar}/></Pressable>
      </View>
    </View>
    <View style={styles.feedTabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{selected:!community}} style={styles.feedTabTarget} onPress={viewModel.openHome}><Text style={community?styles.feedTabMuted:styles.feedTabActive}>Discover</Text></Pressable>
      <View style={styles.tabDivider}/>
      <Pressable accessibilityRole="tab" accessibilityState={{selected:community}} style={styles.feedTabTarget} onPress={viewModel.openForYou}><Text style={community?styles.feedTabActive:styles.feedTabMuted}>For You</Text></Pressable>
    </View>
    {viewModel.savedState?<SavedListingsFeedback error={viewModel.savedState.error} notice={viewModel.savedState.notice} pending={!!viewModel.savedState.pending} busy={!!viewModel.savedState.working} onRetry={viewModel.savedRetry}/>:null}
    {viewModel.notice?<Text style={styles.feedNotice}>{viewModel.notice}</Text>:null}
    {community?<ScrollView style={styles.feedScroll} contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={styles.stateTitle}>No community posts yet.</Text><Text style={styles.stateBody}>Posts from landlords and the RentLease community will appear here.</Text><DiscoveryButton label="Discover rentals" onPress={viewModel.openHome}/>
    </ScrollView>:<FlatList data={viewModel.discoverRows??s.rows} keyExtractor={row=>row.listingId} style={styles.feedScroll} contentContainerStyle={styles.listContent}
      renderItem={({item})=><SearchListingCard listing={item} save={viewModel.savedControl?.(item.listingId)} onPress={()=>viewModel.openProperty(item.listingId)}/>}
      refreshing={s.refreshing} onRefresh={()=>viewModel.refreshDiscover?viewModel.refreshDiscover():void viewModel.discover.refresh()}
      onEndReached={()=>void viewModel.discover.loadMore()} onEndReachedThreshold={0.4}
      ListHeaderComponent={<View style={styles.searchPad}>
        <DiscoverySearchBar value="" onChangeText={viewModel.setQuery} onFocus={()=>viewModel.navigate('searchLocation')} onSubmit={()=>viewModel.navigate('searchLocation')} placeholder="Search a city or barangay"/>
        <DiscoveryButton label="Nearby rentals" tone="outline" onPress={viewModel.requestCurrentLocation}/>
        <View style={styles.recommendations}>
        <View style={styles.headingRow}><Text accessibilityRole="header" style={styles.sectionTitle}>Recommended for You</Text><Pressable accessibilityRole="button" accessibilityLabel="About matching recommendations" accessibilityState={{expanded:matchingInfo}} onPress={()=>setMatchingInfo(!matchingInfo)} style={styles.infoAction}><Text style={styles.preferenceText}>ⓘ</Text></Pressable></View>
        <Pressable accessibilityRole="button" onPress={viewModel.openMatchingPreferences} style={styles.preferenceAction}><Text style={styles.preferenceText}>{viewModel.hasRecommendationPreferences?'Edit preferences':'Set matching preferences'}</Text></Pressable>
        <Text style={styles.copy}>Recommended ordering uses your preferences (80%), confirmed owner Tier 2 identity verification (10%), and listing completeness (10%). Listings without confirmed verification remain eligible. Verification does not guarantee property ownership or safety.</Text>
        {matchingInfo?<Text style={styles.copy}>Based on saved preferences and current filters, within a limited pool of recent listings. Not a price prediction. Unknown owner verification earns no bonus.</Text>:null}
        {!viewModel.hasRecommendationPreferences?null:<>
        {r?.phase==='loading'||r?.phase==='idle'?<ActivityIndicator accessibilityLabel="Loading recommendations" color={colors.primaryAction}/>:null}
        {r?.error?<><Text accessibilityRole="alert" style={styles.error}>{r.error}</Text><DiscoveryButton label="Retry recommendations" tone="outline" onPress={()=>void viewModel.recommendations.load()}/></>:null}
        {r?.phase==='unavailable'?<Text style={styles.copy}>Choose a supported location, budget, property type, room count, furnishing, or amenity preference to enable ranking.</Text>:null}
        {r?.phase==='success'?<>
        {!r.recommended.length?<Text style={styles.copy}>No loaded rentals match your selected preferences. Try changing your preferences or filters.</Text>:<><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendationCards}>{r.recommended.slice(0,3).map(row=><View key={row.candidate.listing.listingId} style={styles.recommendationCard}><SearchListingCard listing={row.candidate.listing} save={viewModel.savedControl?.(row.candidate.listing.listingId)} onPress={()=>viewModel.openProperty(row.candidate.listing.listingId)}/><Text style={styles.copy}>{row.reasons.join(' | ')||'Selected property preferences'}</Text></View>)}</ScrollView><DiscoveryButton label="View ranked rentals" tone="outline" onPress={viewModel.openRecommendedResults}/></>}</>:null}
        </>}
        </View>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Recently published</Text>
        <Text style={styles.copy}>Available rentals across RentLease's supported cities.</Text>
        {s.phase==='idle'||s.phase==='loading'?<View accessibilityLiveRegion="polite" style={styles.loading}><ActivityIndicator color={colors.primaryAction}/><Text style={styles.copy}>Loading rentals...</Text></View>:null}
        {s.error?<View accessibilityRole="alert" style={styles.loading}><Text style={styles.error}>{s.error}</Text><DiscoveryButton label="Retry listings" tone="outline" disabled={s.refreshing||s.more} onPress={()=>void viewModel.discover.retry()}/></View>:null}
      </View>}
      ListEmptyComponent={s.phase==='success'&&!s.refreshing&&!r?.recommended.length?<View style={styles.empty}><Text style={styles.sectionTitle}>No available rentals yet.</Text><Text style={styles.copy}>Published rentals will appear here when they are available.</Text></View>:null}
      ListFooterComponent={<View style={styles.loading}>{s.more?<ActivityIndicator accessibilityLabel="Loading more rentals" color={colors.primaryAction}/>:s.hasMore&&!s.error?<DiscoveryButton label="Load more rentals" tone="outline" disabled={s.refreshing} onPress={()=>void viewModel.discover.loadMore()}/>:null}</View>}/> }
  </View>;
}
const styles=StyleSheet.create({
  headingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},infoAction:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},preferenceAction:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},preferenceText:{...ui.supporting,color:colors.primaryAction},recommendations:{gap:6,paddingVertical:8},recommendationCards:{gap:12},recommendationCard:{width:280,gap:5},screen:{backgroundColor:colors.canvas,flex:1},feedHeader:{...ui.rule,backgroundColor:colors.background,alignItems:'center',flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',minHeight:64,gap:spacing.sm,paddingHorizontal:spacing.md,paddingVertical:spacing.xs},
  wordmark:{alignItems:'center',flexDirection:'row',gap:spacing.xxs,flex:1,minWidth:0},wordmarkText:{color:colors.ink,fontFamily:typography.family,fontSize:23,fontWeight:'700',letterSpacing:-0.5,flexShrink:1},wordmarkIcon:{height:26,width:26},
  headerActions:{alignItems:'center',flexDirection:'row',gap:spacing.xs},headerAction:{alignItems:'center',justifyContent:'center',minHeight:48,minWidth:48},headerAvatar:{borderColor:colors.border,borderRadius:18,borderWidth:1,height:33,width:33},
  feedTabs:{backgroundColor:colors.background,alignItems:'center',flexDirection:'row',gap:spacing.md,minHeight:50,justifyContent:'center'},feedTabTarget:{minHeight:48,justifyContent:'center',paddingHorizontal:spacing.sm},feedTabMuted:{...ui.supporting,fontSize:14},feedTabActive:{color:colors.primaryAction,fontFamily:typography.family,fontSize:14,fontWeight:'700',borderBottomWidth:2,borderBottomColor:colors.primaryAction,paddingVertical:spacing.xs},tabDivider:{backgroundColor:colors.text,height:18,width:1},
  feedNotice:{...ui.supporting,backgroundColor:colors.background,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},feedScroll:{flex:1},feedContent:{flexGrow:1,justifyContent:'center',alignItems:'center',gap:spacing.sm,padding:spacing.sm,maxWidth:600,width:'100%',alignSelf:'center'},
  listContent:{padding:spacing.md,paddingBottom:spacing.xl,maxWidth:600,width:'100%',alignSelf:'center'},searchPad:{gap:spacing.sm},loading:{gap:spacing.sm,paddingVertical:spacing.sm},copy:{...ui.supporting},error:{...ui.supporting,color:colors.restricted},sectionTitle:{...ui.sectionTitle},
  empty:{gap:spacing.sm,paddingVertical:spacing.xl},stateScreen:{alignItems:'center',flex:1,gap:spacing.md,justifyContent:'center',padding:spacing.xl},stateTitle:{color:colors.text,fontFamily:typography.family,fontSize:24,fontWeight:'900',textAlign:'center'},stateBody:{color:colors.textSecondary,fontFamily:typography.family,fontSize:14,lineHeight:21,maxWidth:330,textAlign:'center'},
});
