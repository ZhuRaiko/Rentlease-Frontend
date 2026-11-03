import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {Camera,GeoJSONSource,Images,Layer,Map,type CameraRef,type GeoJSONSourceRef,type SymbolLayerSpecification,type FilterSpecification} from '@maplibre/maplibre-react-native';
import {Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import type {GpsProximityState} from '../models/GpsProximity';
import {nearbyInitialCamera,nearbyMarkerSources,radiusPolygon,type MapInsets,type NearbyCamera} from '../models/NearbyMap';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
interface Props {state:GpsProximityState;styleUrl:string|null;onSelect:(id:string)=>void;onCamera:(camera:NearbyCamera)=>void;insets?:MapInsets;initialCamera?:NearbyCamera|null}
const defaultInsets:MapInsets={top:160,bottom:280,left:16,right:16};
const sprites={ 'nearby-price':require('../assets/price-pill.png'),'nearby-selected':require('../assets/selected-price-pill.png') };
const priceLayout:NonNullable<SymbolLayerSpecification['layout']>={ 'text-field':['get','label'] as ['get',string],'text-font':['Noto Sans Bold'],'text-size':14,'text-allow-overlap':true,'text-ignore-placement':true,'icon-image':'nearby-price','icon-text-fit':'both' as const,'icon-text-fit-padding':[7,12,7,12],'icon-allow-overlap':true,'icon-ignore-placement':true };
const noCluster:FilterSpecification=['!', ['has','point_count']];
function NearbyPropertyMapView({state,styleUrl,onSelect,onCamera,insets=defaultInsets,initialCamera}:Props){
  const origin=state.approximateOrigin,window=useWindowDimensions();
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);
  const camera=useRef<CameraRef|null>(null),source=useRef<GeoJSONSourceRef|null>(null),ready=useRef(false),generation=useRef(0);
  const initial=useRef(initialCamera?{...initialCamera,padding:initialCamera.padding??insets}:(origin?{...nearbyInitialCamera(origin,state.radiusKm,Math.min(window.width-80,window.height-insets.top-insets.bottom-40)),padding:insets}:null));
  const appliedFrame=useRef({origin,radius:state.radiusKm});
  const data=useMemo(()=>nearbyMarkerSources(state.rows,state.selectedListingId),[state.rows,state.selectedListingId]);
  const polygon=useMemo(()=>origin?radiusPolygon(origin,state.radiusKm):null,[origin,state.radiusKm]);
  const user=useMemo(()=>origin?{type:'Point' as const,coordinates:[origin.longitude,origin.latitude]}:null,[origin]);
  useEffect(()=>()=>{ready.current=false;generation.current++;},[]);
  useEffect(()=>{generation.current++;},[data.ordinary]);
  useEffect(()=>{
    if(!origin||!ready.current||status!=='ready'||(appliedFrame.current.origin===origin&&appliedFrame.current.radius===state.radiusKm))return;
    appliedFrame.current={origin,radius:state.radiusKm};
    camera.current?.easeTo({...nearbyInitialCamera(origin,state.radiusKm,Math.min(window.width-80,window.height-insets.top-insets.bottom-40)),padding:initial.current!.padding,duration:250});
  },[origin,state.radiusKm,status]);
  useEffect(()=>{if(status!=='loading')return;const timer=setTimeout(()=>setStatus('error'),20000);return()=>clearTimeout(timer);},[status,attempt]);
  const choose=async(features:GeoJSON.Feature[])=>{
    const g=++generation.current;if(!ready.current)return;
    const feature=features[0];if(!feature)return;
    const props=feature.properties;
    if(typeof props?.listingId==='string'&&state.rows.some(r=>r.listingId===props.listingId)){onSelect(props.listingId);return;}
    if(typeof props?.cluster_id==='number'&&feature.geometry.type==='Point'){
      const point=feature.geometry.coordinates;
      try{const zoom=await source.current?.getClusterExpansionZoom(props.cluster_id);if(g===generation.current&&ready.current&&typeof zoom==='number'&&point.length>=2)camera.current?.easeTo({center:[point[0]!,point[1]!],zoom:Math.min(22,zoom+0.1),duration:250});}catch{/* No data fallback; the same rentals remain accessible in List. */}
    }
  };
  if(!origin||!initial.current)return <View style={styles.message}><Text style={styles.copy}>Your search area will appear after location access is allowed.</Text></View>;
  if(!styleUrl)return <View style={styles.message}><Text accessibilityRole="alert" style={styles.copy}>Map configuration is unavailable. Use List to view nearby rentals.</Text></View>;
  return <View style={styles.shell}>
    <Map key={attempt} style={styles.map} mapStyle={styleUrl} androidView="texture" attribution attributionPosition={{bottom:8,left:8}} accessibilityLabel="Nearby rentals map" accessibilityHint="Use List to browse each rental with a screen reader."
      onDidFinishLoadingStyle={()=>{ready.current=true;setStatus('ready');}}
      onDidFinishLoadingMap={()=>{ready.current=true;setStatus('ready');}}
      onDidFailLoadingMap={()=>{ready.current=false;generation.current++;setStatus('error');}}
      onRegionWillChange={event=>{if(event.nativeEvent.userInteraction)generation.current++;}}
      onRegionDidChange={event=>{const {center,zoom,bearing,pitch}=event.nativeEvent;onCamera({center,zoom,bearing,pitch,padding:initial.current!.padding});}}>
      <Camera ref={camera} initialViewState={initial.current} maxZoom={22}/>
      <Images images={sprites}/>
      {polygon?<GeoJSONSource id="nearby-radius" data={polygon}><Layer id="nearby-radius-fill" type="fill" paint={{'fill-color':colors.primary,'fill-opacity':0.04}}/><Layer id="nearby-radius-edge" type="line" paint={{'line-color':colors.primary,'line-opacity':0.25,'line-width':1}}/></GeoJSONSource>:null}
      {user?<GeoJSONSource id="nearby-user" data={user}><Layer id="nearby-user-dot" type="circle" paint={{'circle-radius':7,'circle-color':colors.primaryAction,'circle-stroke-width':3,'circle-stroke-color':colors.white}}/></GeoJSONSource>:null}
      <GeoJSONSource id="nearby-rentals" ref={source} data={data.ordinary} cluster clusterRadius={60} clusterMaxZoom={20} clusterMinPoints={2} hitbox={{top:24,right:24,bottom:24,left:24}} onPress={event=>{event.stopPropagation();void choose(event.nativeEvent.features);}}>
        <Layer id="nearby-cluster-background" type="circle" filter={['has','point_count']} paint={{'circle-radius':23,'circle-color':colors.primaryAction,'circle-stroke-color':colors.white,'circle-stroke-width':2}}/>
        <Layer id="nearby-cluster-count" type="symbol" filter={['has','point_count']} layout={{'text-field':['concat',['to-string',['get','point_count']],' rentals'],'text-font':['Noto Sans Bold'],'text-size':12,'text-allow-overlap':true,'text-ignore-placement':true}} paint={{'text-color':colors.white}}/>
        <Layer id="nearby-rental-prices" type="symbol" filter={noCluster} layout={priceLayout} paint={{'text-color':colors.ink}}/>
      </GeoJSONSource>
      <GeoJSONSource id="nearby-selected-rental" data={data.selected} hitbox={{top:24,right:24,bottom:24,left:24}} onPress={event=>{event.stopPropagation();void choose(event.nativeEvent.features);}}>
        <Layer id="nearby-selected-price" type="symbol" layout={{...priceLayout,'icon-image':'nearby-selected'}} paint={{'text-color':colors.white}}/>
      </GeoJSONSource>
    </Map>
    {status==='loading'?<View pointerEvents="none" style={[styles.banner,{top:insets.top+8}]}><Text accessibilityLiveRegion="polite" style={styles.copy}>Loading map...</Text></View>:null}
    {status==='error'?<View style={[styles.banner,{top:insets.top+8}]}><Text accessibilityRole="alert" style={styles.copy}>Map could not load. Rentals are still available in List.</Text><Pressable accessibilityRole="button" onPress={()=>{ready.current=false;generation.current++;setStatus('loading');setAttempt(a=>a+1);}} style={styles.retry}><Text style={styles.copy}>Retry map</Text></Pressable></View>:null}
  </View>;
}
// Camera persistence is imperative and cannot trigger rendering; unrelated preview/
// toolbar state does not rebuild native map inputs or reload property photos.
export const NearbyPropertyMap=memo(NearbyPropertyMapView,(a,b)=>a.state.rows===b.state.rows&&a.state.selectedListingId===b.state.selectedListingId&&a.state.radiusKm===b.state.radiusKm&&a.state.approximateOrigin===b.state.approximateOrigin&&a.styleUrl===b.styleUrl&&a.onSelect===b.onSelect&&a.onCamera===b.onCamera&&a.insets?.top===b.insets?.top&&a.insets?.bottom===b.insets?.bottom&&a.insets?.left===b.insets?.left&&a.insets?.right===b.insets?.right);
const styles=StyleSheet.create({shell:{flex:1,overflow:'hidden',backgroundColor:colors.canvas},map:{flex:1},message:{flex:1,padding:24,justifyContent:'center',backgroundColor:colors.canvas},copy:{...ui.supporting},banner:{position:'absolute',left:24,right:24,backgroundColor:colors.background,padding:12,borderRadius:12,elevation:3},retry:{minHeight:48,justifyContent:'center'}});
