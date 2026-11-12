import {useEffect,useState} from 'react';
import {Map,Camera} from '@maplibre/maplibre-react-native';
import {ActivityIndicator,Text,View} from 'react-native';
import {usePublicLocationMap} from '../viewModels/usePublicLocationMap';
import {AppButton} from './AppButton';
import {ui} from '../theme/ui';
/** Receives only the existing public point; never queries or derives a location. */
export function PublicLocationMap({latitude,longitude,compact=false}:{latitude:number;longitude:number;compact?:boolean}){
 const style=usePublicLocationMap(),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);
 useEffect(()=>{setStatus('loading');},[latitude,longitude]);
 useEffect(()=>{if(status!=='loading')return;const t=setTimeout(()=>setStatus('error'),20000);return()=>clearTimeout(t);},[status,attempt]);
 if(!style||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85.05112878||Math.abs(longitude)>180)return <Text style={ui.supporting}>Map is unavailable. Public location and nearby places remain below.</Text>;
 return <View style={{gap:8}}><View style={{height:compact?150:210,borderRadius:12,overflow:'hidden'}}><Map key={`${latitude}:${longitude}:${attempt}`} style={{flex:1}} mapStyle={style} androidView="texture" attribution accessibilityLabel="Approximate rental area map; exact property location is private" onDidFinishLoadingMap={()=>setStatus('ready')} onDidFailLoadingMap={()=>setStatus('error')}><Camera initialViewState={{center:[longitude,latitude],zoom:13}}/></Map></View>{status==='loading'?<ActivityIndicator accessibilityLabel="Loading approximate area map"/>:null}{status==='error'?<><Text accessibilityRole="alert" style={ui.supporting}>Map could not load. Nearby places can be used independently.</Text><AppButton label="Retry map" variant="secondary" onPress={()=>{setAttempt(v=>v+1);setStatus('loading');}}/></>:null}{!compact?<Text style={ui.supporting}>Centered on the public approximate area, not the private property pin. Map attribution is available on the map.</Text>:null}</View>;
}
