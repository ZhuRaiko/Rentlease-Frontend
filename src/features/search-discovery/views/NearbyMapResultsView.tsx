import {useMemo,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import type {SearchDiscoveryViewModel} from '../viewModels/useSearchDiscoveryViewModel';
import {NearbyPropertyMap} from '../components/NearbyPropertyMap';
import {NearbyPropertyPreview} from '../components/NearbyPropertyPreview';
import {DiscoveryButton} from '../components/DiscoveryControls';
import {NearbyRadiusSlider} from '../components/NearbyRadiusSlider';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
export function NearbyMapResultsView({viewModel:vm}:{viewModel:SearchDiscoveryViewModel}){
  const s=vm.gpsState,busy=s.phase==='locating'||s.phase==='searching'||s.loadingMore;
  const selected=s.rows.find(row=>row.listingId===s.selectedListingId);
  const [radiusOpen,setRadiusOpen]=useState(false),[optionsOpen,setOptionsOpen]=useState(false);
  const [topHeight,setTopHeight]=useState(132),[bottomHeight,setBottomHeight]=useState(100);
  const onCamera=useMemo(()=>(camera:import('../models/NearbyMap').NearbyCamera)=>vm.gps.setCamera(camera,s.radiusKm,s.approximateOrigin),[vm.gps,s.radiusKm,s.approximateOrigin]);
  const insets={top:topHeight+16,bottom:bottomHeight+40,left:16,right:16};
  return <View style={styles.screen}>
    <View style={styles.mapStage}>
      <NearbyPropertyMap key={`${s.approximateOrigin?.latitude}:${s.approximateOrigin?.longitude}`} state={s} styleUrl={vm.nearbyMapStyle} insets={insets} initialCamera={vm.gps.getCamera()} onSelect={vm.gps.selectListing} onCamera={onCamera}/>
    </View>
    <View pointerEvents="box-none" style={styles.top} onLayout={e=>setTopHeight(e.nativeEvent.layout.height)}>
      <View style={styles.toolbar}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={vm.goBack} style={styles.iconButton}><Text accessible={false} style={styles.back}>{'\u2039'}</Text></Pressable>
          <View style={styles.context}><Text accessibilityRole="header" style={styles.title}>Nearby rentals</Text><View style={styles.resultRow}>{busy?<ActivityIndicator size="small" color={colors.primaryAction}/>:null}<Text accessibilityLiveRegion="polite" style={styles.caption}>{busy?(s.phase==='locating'?'Finding your location...':'Searching...'):`${s.rows.length} loaded \u00b7 Nearest first`}</Text></View></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Nearby search options" accessibilityState={{expanded:optionsOpen}} onPress={()=>setOptionsOpen(v=>!v)} style={styles.iconButton}><Text accessible={false} style={styles.more}>{'\u22ef'}</Text></Pressable>
        </View>
        <View style={styles.controlRow}>
          <View accessibilityRole="tablist" style={styles.segments}>
            <Pressable accessibilityRole="tab" accessibilityState={{selected:true}} accessibilityLabel="Map" onPress={()=>vm.gps.setPresentation('map')} style={[styles.segment,styles.activeSegment]}><Text style={styles.activeText}>Map</Text></Pressable>
            <Pressable accessibilityRole="tab" accessibilityState={{selected:false}} accessibilityLabel="List" onPress={()=>vm.gps.setPresentation('list')} style={styles.segment}><Text style={styles.segmentText}>List</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Search radius ${s.radiusKm} kilometers`} accessibilityState={{expanded:radiusOpen}} onPress={()=>setRadiusOpen(v=>!v)} style={styles.radiusButton}><Text style={styles.radiusText}>Radius {s.radiusKm} km</Text><Text accessible={false} style={styles.caption}>{radiusOpen?'Hide':'Adjust'}</Text></Pressable>
        </View>
        {radiusOpen?<View style={styles.radiusPanel}><NearbyRadiusSlider compact value={s.radiusKm} disabled={s.phase==='locating'} onComplete={r=>void vm.gps.setRadius(r)}/></View>:null}
        {optionsOpen?<View style={styles.options}><Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={()=>{setOptionsOpen(false);void vm.gps.start();}} style={styles.option}><Text style={styles.segmentText}>Update my location</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>vm.navigate('searchLocation')} style={styles.option}><Text style={styles.segmentText}>Search by city</Text></Pressable></View>:null}
      </View>
      {s.error?<View style={styles.feedback}><Text accessibilityRole="alert" style={styles.caption}>{s.error.message}</Text><DiscoveryButton label={s.error.kind==='blocked'?'Open app settings':'Try again'} tone="outline" disabled={busy} onPress={()=>void(s.error?.kind==='blocked'?vm.gps.openSettings():vm.gps.retry())}/></View>:null}
      {s.photoError?<Text accessibilityRole="alert" style={styles.feedbackCopy}>{s.photoError}</Text>:null}
    </View>
    <View pointerEvents="box-none" style={styles.bottom} onLayout={e=>setBottomHeight(e.nativeEvent.layout.height)}>
      {s.hasMore&&!s.error?<Pressable disabled={busy} accessibilityRole="button" accessibilityState={{disabled:busy}} onPress={()=>void vm.gps.loadMore()} style={styles.moreResults}><Text style={styles.radiusText}>{s.loadingMore?'Loading...':'Load more rentals'}</Text></Pressable>:null}
      {selected?<ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent} bounces={false}><NearbyPropertyPreview listing={selected} onClose={vm.gps.clearSelection} onDetails={()=>vm.openProperty(selected.listingId)}/></ScrollView>:<View style={styles.hintPanel}><Text style={styles.hint}>{s.phase==='success'&&!s.rows.length?`No rentals within ${s.radiusKm} km. Adjust the radius or search by city.`:'Tap a price to preview a rental'}</Text><Text style={styles.caption}>Property pins and your position are approximate.</Text></View>}
    </View>
    <Text pointerEvents="none" style={styles.credit}>{'\u00a9 MapTiler \u00b7 \u00a9 OpenStreetMap contributors'}</Text>
  </View>;
}
const styles=StyleSheet.create({screen:{flex:1,overflow:'hidden',backgroundColor:colors.canvas},mapStage:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden'},top:{position:'absolute',top:12,left:16,right:16,gap:8},toolbar:{backgroundColor:colors.background,borderRadius:20,elevation:5,padding:6},headerRow:{flexDirection:'row',alignItems:'center'},iconButton:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},back:{...ui.pageTitle,fontSize:34,lineHeight:40},more:{...ui.pageTitle,fontSize:26},context:{flex:1,paddingVertical:4},title:{...ui.sectionTitle},caption:{...ui.supporting,fontSize:12,lineHeight:18},resultRow:{flexDirection:'row',alignItems:'center',gap:6},controlRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,paddingHorizontal:8,paddingBottom:6},segments:{flexDirection:'row',backgroundColor:colors.canvas,borderRadius:12,padding:3},segment:{minWidth:58,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:10,paddingHorizontal:10},activeSegment:{backgroundColor:colors.ink},activeText:{...ui.body,fontWeight:'600',color:colors.white},segmentText:{...ui.body,fontWeight:'500'},radiusButton:{flex:1,minHeight:48,justifyContent:'center',alignItems:'flex-end',paddingHorizontal:8},radiusText:{...ui.body,fontWeight:'600',color:colors.primaryAction},radiusPanel:{paddingHorizontal:16,paddingTop:4},options:{borderTopWidth:1,borderTopColor:colors.outline,paddingHorizontal:12},option:{minHeight:48,justifyContent:'center'},feedback:{backgroundColor:colors.background,padding:12,borderRadius:12,gap:8},feedbackCopy:{...ui.supporting,backgroundColor:colors.background,padding:10,borderRadius:10},bottom:{position:'absolute',left:16,right:16,bottom:32,maxHeight:'48%',alignItems:'stretch',gap:10},previewScroll:{flexGrow:0,borderRadius:20,elevation:6,backgroundColor:colors.background},previewContent:{flexGrow:0},hintPanel:{backgroundColor:colors.background,borderRadius:16,padding:14,gap:4,elevation:3},hint:{...ui.body,fontWeight:'600'},moreResults:{alignSelf:'center',minHeight:48,paddingHorizontal:20,justifyContent:'center',borderRadius:24,backgroundColor:colors.background,elevation:3},credit:{...ui.supporting,position:'absolute',bottom:7,right:12,fontSize:10,lineHeight:14,backgroundColor:colors.background,paddingHorizontal:4,borderRadius:3}});
