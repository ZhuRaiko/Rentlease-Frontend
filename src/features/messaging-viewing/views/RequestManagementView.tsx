import {useCallback,useRef,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import type {RequestScope} from '../services/requestScope';
import {ViewingsWorkspace,ReservationsWorkspace} from './RequestWorkspaces';
export function RequestManagementView({accountId,scope,title,cover,status,onBack,registerBackAction,onOpenConversation,counts}:{accountId:string|undefined;scope:RequestScope;title:string;cover?:string|undefined;status?:string|undefined;counts?:{viewings:number;reservations:number}|undefined;onBack:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined;onOpenConversation?:((id:string)=>void)|undefined}){
 const [tab,setTab]=useState<'viewings'|'reservations'>('viewings');
 // Tabs are disabled while editing so an uncertain write cannot be abandoned by switching tabs.
 const nested=useRef<(()=>void)|null>(null),[locked,setLocked]=useState(false);
 const register=useCallback((action:(()=>void)|null)=>{nested.current=action;registerBackAction?.(action);},[registerBackAction]);
 return <View style={{flex:1,backgroundColor:colors.background}}><ScreenHeader title={title} onBack={()=>nested.current?nested.current():onBack()}/><View style={styles.property}>{cover?<Image source={{uri:cover}} accessibilityLabel="Property cover" style={styles.thumb}/>:<View style={[styles.thumb,styles.noPhoto]}/>}<View style={styles.propertyText}><Text style={ui.sectionTitle}>{title}</Text>{status?<Text style={ui.supporting}>{status}</Text>:null}</View></View>
 <View accessibilityRole="tablist" style={styles.segment}>{(['viewings','reservations'] as const).map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:tab===t,disabled:locked}} disabled={locked} onPress={()=>setTab(t)} style={[styles.segmentItem,tab===t&&styles.segmentOn]}><Text style={[styles.segmentText,tab===t&&styles.segmentTextOn]}>{t==='viewings'?'Viewings':'Reservations'}{counts?` · ${counts[t]}`:''}</Text></Pressable>)}</View>
 {tab==='viewings'?<ViewingsWorkspace key={accountId+JSON.stringify(scope)} accountId={accountId} conversation={null} scope={scope} onBack={onBack} registerBackAction={register} onLocked={setLocked} onOpenConversation={onOpenConversation}/>:<ReservationsWorkspace key={accountId+JSON.stringify(scope)} accountId={accountId} conversation={null} scope={scope} onBack={onBack} registerBackAction={register} onLocked={setLocked} onOpenConversation={onOpenConversation}/>}</View>;
}
const styles=StyleSheet.create({property:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:8},thumb:{width:48,height:48,borderRadius:10},noPhoto:{backgroundColor:colors.surface},propertyText:{flex:1,minWidth:0},segment:{flexDirection:'row',marginHorizontal:16,marginVertical:4,borderWidth:1,borderColor:colors.outline,borderRadius:12,overflow:'hidden'},segmentItem:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',paddingHorizontal:8},segmentOn:{backgroundColor:colors.primaryAction},segmentText:{...ui.body,fontWeight:'600',textAlign:'center'},segmentTextOn:{color:colors.white}});
