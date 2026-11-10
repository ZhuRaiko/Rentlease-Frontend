import {ActivityIndicator,FlatList,StyleSheet,Text,View} from 'react-native';
import {DiscoveryHeader,DiscoveryChip,DiscoveryButton} from '../components/DiscoveryControls';
import {SearchListingCard} from '../components/SearchListingCard';
import {SaveListingButton,SavedListingsFeedback} from '../components/SaveListingButton';
import type {SearchDiscoveryViewModel} from '../viewModels/useSearchDiscoveryViewModel';
import type {SavedSort} from '../models/SavedListing';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
const sorts:{id:SavedSort;label:string}[]=[{id:'recent',label:'Recently saved'},{id:'price_low',label:'Price: low to high'},{id:'price_high',label:'Price: high to low'}];
export function SavedListingsView({viewModel:vm}:{viewModel:SearchDiscoveryViewModel}){
 const s=vm.savedState,busy=s.loading||s.more||!!s.working;
 return <View style={styles.screen}><DiscoveryHeader title="Saved Listings" onBack={vm.goBack}/><FlatList data={s.rows} keyExtractor={r=>r.listingId} contentContainerStyle={styles.content} refreshing={s.loading} onRefresh={vm.savedRefresh}
 ListHeaderComponent={<View style={styles.header}><Text style={ui.supporting}>Your bookmarked rental listings. Availability and asking rent may change.</Text><Text accessibilityLiveRegion="polite" style={ui.sectionTitle}>{s.count===null?'Saved listings':`${s.count} saved ${s.count===1?'listing':'listings'}`}</Text><View style={styles.controls}>{sorts.map(sort=><DiscoveryChip key={sort.id} label={sort.label} selected={s.sort===sort.id} disabled={busy||!!s.pending} onPress={()=>void vm.savedListings.sort(sort.id)}/>)}</View>
 <SavedListingsFeedback error={s.error} notice={s.notice} pending={!!s.pending} busy={!!s.working} onRetry={vm.savedRetry}/>
 {s.loading?<ActivityIndicator accessibilityLabel="Loading Saved Listings" color={colors.primaryAction}/>:null}
 </View>}
 renderItem={({item})=>item.listing?<SearchListingCard horizontal listing={item.listing} save={vm.savedControl(item.listingId)} onPress={()=>vm.openProperty(item.listingId)}/>:<View style={styles.unavailable}><Text style={ui.sectionTitle}>Listing unavailable</Text><Text style={ui.supporting}>This rental is no longer publicly available. Its details are hidden; you can remove the bookmark.</Text><View style={{alignSelf:'flex-end'}}><SaveListingButton control={vm.savedControl(item.listingId)}/></View></View>}
 ListEmptyComponent={s.count===0&&!s.loading&&!s.error?<View style={styles.empty}><Text style={ui.sectionTitle}>Keep rentals you want to revisit</Text><Text style={ui.supporting}>Tap the heart on a rental in Home, Search, or Rental Details. Your saved listings stay with your account.</Text><DiscoveryButton label="Browse rentals" onPress={vm.openHome}/></View>:null}
 ListFooterComponent={<View style={styles.footer}>{s.more?<ActivityIndicator accessibilityLabel="Loading more saved listings" color={colors.primaryAction}/>:s.hasMore&&!s.error?<DiscoveryButton label="Load more saved listings" tone="outline" disabled={busy||!!s.pending} onPress={()=>void vm.savedListings.more()}/>:null}</View>}/></View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.canvas},content:{padding:16,paddingBottom:32,maxWidth:600,width:'100%',alignSelf:'center'},header:{gap:12},controls:{flexDirection:'row',flexWrap:'wrap',gap:6},unavailable:{paddingVertical:20,gap:8,borderBottomWidth:1,borderBottomColor:colors.outline},empty:{paddingVertical:30,gap:12},footer:{paddingVertical:16}});
