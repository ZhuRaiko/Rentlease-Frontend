import {useCallback,useRef,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {colors} from '../../../shared/theme/colors';
import {ui} from '../../../shared/theme/ui';
import type {RequestScope} from '../services/requestScope';
import {ViewingsWorkspace,ReservationsWorkspace} from './RequestWorkspaces';
export function RequestManagementView({accountId,scope,title,cover,status,onBack,registerBackAction,onOpenConversation}:{accountId:string|undefined;scope:RequestScope;title:string;cover?:string|undefined;status?:string|undefined;onBack:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined;onOpenConversation?:((id:string)=>void)|undefined}){
 const [tab,setTab]=useState<'viewings'|'reservations'>('viewings');
 // Tabs are disabled while editing so an uncertain write cannot be abandoned by switching tabs.
 const nested=useRef<(()=>void)|null>(null),[locked,setLocked]=useState(false);
 const register=useCallback((action:(()=>void)|null)=>{nested.current=action;registerBackAction?.(action);},[registerBackAction]);
 return <View style={{flex:1,backgroundColor:colors.background}}><ScreenHeader title={title} onBack={()=>nested.current?nested.current():onBack()}/>{cover?<Image source={{uri:cover}} accessibilityLabel="Property cover" style={{height:85,width:'100%'}}/>:null}{status?<Text style={[ui.supporting,{paddingHorizontal:16}]}>{status}</Text>:null}
 <View accessibilityRole="tablist" style={{flexDirection:'row',paddingHorizontal:16,gap:12}}>{(['viewings','reservations'] as const).map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:tab===t}} disabled={locked} onPress={()=>setTab(t)} style={{minHeight:48,justifyContent:'center',borderBottomWidth:tab===t?2:0,borderColor:colors.primaryAction}}><Text style={ui.body}>{t==='viewings'?'Viewings':'Reservations'}</Text></Pressable>)}</View>
 {tab==='viewings'?<ViewingsWorkspace key={accountId+JSON.stringify(scope)} accountId={accountId} conversation={null} scope={scope} onBack={onBack} registerBackAction={register} onLocked={setLocked} onOpenConversation={onOpenConversation}/>:<ReservationsWorkspace key={accountId+JSON.stringify(scope)} accountId={accountId} conversation={null} scope={scope} onBack={onBack} registerBackAction={register} onLocked={setLocked} onOpenConversation={onOpenConversation}/>}</View>;
}
