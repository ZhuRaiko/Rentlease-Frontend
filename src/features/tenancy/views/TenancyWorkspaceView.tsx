import {TenancyDetailsView} from './TenancyDetailsView';
import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {RentLeaseBottomNavigation} from '../../../shared/components/RentLeaseBottomNavigation';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {useTenancyWorkspaceViewModel} from '../viewModels/useTenancyWorkspaceViewModel';
import {TILE_COLORS,TILE_LABELS,type TileKind} from '../models/TenancyPresentation';
import type {AttentionItem,PastCard,StayCard,UpcomingCard} from '../models/TenancyWorkspaceScreen';
import {TenancySetupView} from './TenancySetupView';
import {TenancyDashboardIcon} from './TenancyDashboardIcon';
import {ReleaseSheet} from '../components/ReleaseSheet';
import {ButtonRow,Cell,CellRow,HeroPhoto,PersonRow,Slot,Stars,TenancyButton,TenancyChip,Thumb} from '../components/TenancyParts';
import type {TenancyDetailsPanel} from '../viewModels/tenancyDetailsWorkflow';
type Details={actor:string|undefined;id:string;sourceId:string|null;panel?:TenancyDetailsPanel};
const ICON={confirm_terms:'upcoming',start_setup:'upcoming',end_request:'history',maintenance:'maintenance'} as const;
interface Props {
  accountId:string|undefined;onBack:()=>void;onDiscover:()=>void;onListings:()=>void;onPost:()=>void;onChat:()=>void;registerBackAction:(action:(()=>void)|null)=>void;onOpenConversation?:((id:string)=>void)|undefined;
  /** Opens the reservation request for a conversation after the held reservation was released. */
  onStartRequest?:((conversationId:string)=>void)|undefined;
  /** Opens Discover filtered to a city and property type. */
  onFindSimilar?:((city:string,type:string)=>void)|undefined;
  /** Opens the property screen (today's list of properties; a single property's Manage screen replaces it later). */
  onOpenProperty?:((propertyId:string)=>void)|undefined;
  externalPanelOpen?:boolean;
}
export function TenancyWorkspaceView({accountId,onBack,onDiscover,onListings,onPost,onChat,registerBackAction,onOpenConversation,onStartRequest,onFindSimilar,onOpenProperty,externalPanelOpen=false}:Props){
 const vm=useTenancyWorkspaceViewModel(accountId,onStartRequest),[setup,setSetup]=useState<{actor:string|undefined;reservationId:string}|null>(null),[reload,setReload]=useState(0),[details,setDetails]=useState<Details|null>(null);
 const activeDetails=details?.actor===accountId?details:null,screen=vm.screen;
 const scroll=useRef<ScrollView|null>(null),at=useRef<Partial<Record<TileKind,number>>>({});
 useEffect(()=>{if((!setup||setup.actor!==accountId)&&!activeDetails&&!externalPanelOpen){registerBackAction(onBack);return()=>registerBackAction(null);}},[registerBackAction,onBack,setup,accountId,activeDetails,externalPanelOpen]);
 useEffect(()=>{if(reload)void vm.refresh();},[reload]);
 if(setup&&setup.actor===accountId)return <ScreenContainer padded={false}><TenancySetupView accountId={accountId} reservationId={setup.reservationId} onBack={()=>{setSetup(null);setReload(v=>v+1);}} onChanged={()=>setReload(v=>v+1)} registerBackAction={registerBackAction}/></ScreenContainer>;
 const ready=!vm.busy&&!vm.error,bothEmpty=ready&&!screen.active.length&&!screen.upcoming.length;
 const open=(tenancyId:string,panel?:TenancyDetailsPanel)=>setDetails({actor:accountId,id:tenancyId,sourceId:vm.links?.find(l=>l.tenancy_id===tenancyId)?.reservation_id??null,...(panel?{panel}:{})});
 const act=(item:AttentionItem)=>item.action.kind==='setup'?setSetup({actor:accountId,reservationId:item.action.reservationId}):open(item.action.tenancyId,item.action.panel);
 const goTile=(kind:TileKind)=>{const y=at.current[kind];if(y!==undefined)scroll.current?.scrollTo({y:Math.max(0,y-8),animated:true});};
 const section=(kind:TileKind)=>({onLayout:(e:{nativeEvent:{layout:{y:number}}})=>{at.current[kind]=e.nativeEvent.layout.y;}});
 const stay=(s:StayCard)=><View key={s.id} style={styles.card}><HeroPhoto photos={s.photos} chip={s.chip}/>
   <View style={{gap:2}}><Text accessibilityRole="header" style={ui.sectionTitle}>{s.title}</Text><Text style={ui.supporting}>{s.place}</Text></View><PersonRow person={s.other}/>
   <CellRow><Cell label="Rent" value={s.rent}/><Cell label="Next rent due" value={s.nextDue}/></CellRow>
   <ButtonRow><Slot><TenancyButton tone="primary" label={s.primary.label} onPress={()=>s.primary.kind==='report'?open(s.id,'care'):onOpenProperty?.(s.propertyId)}/></Slot><Slot><TenancyButton label={s.secondary.label} accessibilityLabel={`Details: ${s.title}`} onPress={()=>open(s.id)}/></Slot></ButtonRow></View>;
 const upcoming=(u:UpcomingCard)=><View key={u.id} style={styles.card}><View style={styles.head}><Thumb photos={u.photos}/><View style={styles.grow}><Text style={ui.body}>{u.title}</Text>{u.place?<Text style={ui.supporting}>{u.place}</Text>:null}</View><TenancyChip chip={u.chip}/></View>
   <CellRow><Cell label="Move-in" value={u.moveIn}/>{u.rent?<Cell label="Rent" value={u.rent}/>:null}</CellRow>
   <TenancyButton label={u.buttonLabel} accessibilityLabel={`Open: ${u.title}`} onPress={()=>{if(u.reservationId)setSetup({actor:accountId,reservationId:u.reservationId});else if(u.tenancyId)open(u.tenancyId);}}/></View>;
 const past=(p:PastCard)=><View key={p.id} style={styles.card}><View style={styles.head}><Thumb photos={p.photos}/><View style={styles.grow}><Text style={ui.body}>{p.title}</Text><Text style={ui.supporting}>{p.subtitle}</Text></View><TenancyChip chip={p.chip}/></View>
   {p.note?<Text style={ui.supporting}>{p.note}</Text>:null}
   {p.prompt?<View style={styles.prompt}><View style={styles.promptHead}><Stars/><Text style={styles.promptTitle}>{p.prompt.title}</Text></View><Text style={ui.supporting}>{p.prompt.body}</Text></View>:null}
   {p.buttons.length?<ButtonRow>{p.buttons.map(b=><Slot key={b.key}><TenancyButton tone={b.primary?'primary':'secondary'} label={b.label} accessibilityLabel={`${b.label}: ${p.title}`} onPress={()=>{
     if(b.key==='start_request'||b.key==='release')vm.startRequest(p.id);
     else if(b.key==='message'&&p.conversationId)onOpenConversation?.(p.conversationId);
     else if(b.key==='find_similar'&&p.similar)onFindSimilar?.(p.similar.city,p.similar.type);
     else open(p.id,b.key==='rate'?'reviews':undefined);}}/></Slot>)}</ButtonRow>:null}</View>;
 const attentionRow=(x:AttentionItem)=><Pressable key={x.key} accessibilityRole="button" accessibilityLabel={`${x.title}. ${x.subtitle}`} onPress={()=>act(x)} style={styles.attentionRow}><TenancyDashboardIcon kind={ICON[x.kind]}/><View style={styles.grow}><Text style={ui.body}>{x.title}</Text><Text style={ui.supporting}>{x.subtitle}</Text></View><TenancyChip chip={x.chip}/></Pressable>;
 return <ScreenContainer padded={false} includeBottomInset={!!activeDetails}><View style={{flex:1}} importantForAccessibility={activeDetails||externalPanelOpen?'no-hide-descendants':'auto'}><ScreenHeader title="Tenancy" onBack={onBack}/>
  <ScrollView ref={scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={vm.busy} onRefresh={()=>void vm.refresh()}/>}>
   <View style={styles.tiles}>{screen.tiles.map(t=>{const c=TILE_COLORS[t.kind];return <Pressable key={t.kind} accessibilityRole="button" accessibilityLabel={`${TILE_LABELS[t.kind]} rentals: ${ready?t.count:'unavailable'}. Go to this section`} onPress={()=>goTile(t.kind)} style={[styles.tile,{backgroundColor:c.backgroundColor}]}><Text style={[styles.count,{color:c.color}]}>{ready?t.count:'--'}</Text><Text style={[ui.supporting,{color:c.labelColor,fontWeight:'700'}]}>{TILE_LABELS[t.kind]}</Text></Pressable>;})}</View>
   {vm.busy?<ActivityIndicator accessibilityLabel="Loading rental dashboard" color={colors.primaryAction}/>:null}
   {vm.error?<View accessibilityRole="alert" style={styles.card}><Text style={ui.body}>{vm.error}</Text><TenancyButton label="Retry" onPress={()=>void vm.refresh()}/></View>:null}
   {vm.contextWarning?<Text style={ui.supporting}>{vm.contextWarning}</Text>:null}
   {ready&&screen.needsOk.map(x=><View key={x.key} style={styles.okCard}><TenancyChip chip={x.chip}/><Text style={ui.sectionTitle}>{x.title}</Text><Text style={ui.body}>{x.subtitle}</Text><TenancyButton tone="warning" label={x.buttonLabel} accessibilityLabel={`${x.buttonLabel}: ${x.subtitle}`} onPress={()=>act(x)}/></View>)}
   {ready&&screen.attention.length?<View style={{gap:spacing.xs}}><View style={styles.headRow}><Text accessibilityRole="header" style={ui.sectionTitle}>Needs your attention</Text><View accessible accessibilityLabel={`${screen.attention.length} waiting`} style={styles.badge}><Text style={styles.badgeText}>{screen.attention.length}</Text></View></View><View style={styles.card}>{screen.attention.map(attentionRow)}</View></View>:null}
   {bothEmpty?<View onLayout={e=>{at.current.active=at.current.upcoming=e.nativeEvent.layout.y;}} style={styles.section}><Text style={ui.supporting}>No active or upcoming rentals right now.</Text><Pressable accessibilityRole="link" onPress={onChat} style={styles.linkRow}><Text style={styles.linkText}>Browse reservations in Chat</Text></Pressable></View>:<>
   <View {...section('active')} style={styles.section}><Text accessibilityRole="header" style={ui.sectionTitle}>{screen.activeTitle}</Text>{ready?(screen.active.length?screen.active.map(stay):<Text style={ui.supporting}>No active rentals right now.</Text>):<Text style={ui.supporting}>Active rentals appear after loading succeeds.</Text>}</View>
   <View {...section('upcoming')} style={styles.section}><Text accessibilityRole="header" style={ui.sectionTitle}>Upcoming</Text>{ready?(screen.upcoming.length?screen.upcoming.map(upcoming):<><Text style={ui.supporting}>No approved reservations or tenancy setups waiting to start.</Text><Pressable accessibilityRole="link" onPress={onChat} style={styles.linkRow}><Text style={styles.linkText}>Browse reservations in Chat</Text></Pressable></>):<Text style={ui.supporting}>Upcoming rentals appear after loading succeeds.</Text>}</View></>}
   <View {...section('past')} style={styles.section}><Text accessibilityRole="header" style={ui.sectionTitle}>Past</Text>{ready?(screen.past.length?screen.past.map(past):<Text style={ui.supporting}>Ended and cancelled rentals appear here.</Text>):<Text style={ui.supporting}>Past rentals appear after loading succeeds.</Text>}</View>
  </ScrollView><RentLeaseBottomNavigation active="tenancy" onTenancy={()=>void vm.refresh()} onDiscover={onDiscover} onListing={onListings} onPost={onPost} onChat={onChat}/></View>
  {activeDetails?<View style={{position:'absolute',top:0,right:0,bottom:0,left:0}}><TenancyDetailsView key={`${accountId}:${activeDetails.id}`} accountId={accountId} tenancyId={activeDetails.id} reservationId={activeDetails.sourceId} initialPanel={activeDetails.panel} externalPanelOpen={externalPanelOpen} registerBackAction={registerBackAction} onBack={()=>{setDetails(null);setReload(v=>v+1);}} onOpenConversation={onOpenConversation} onOpenProperty={onOpenProperty}/></View>:null}
  <ReleaseSheet request={vm.release.request} saving={vm.release.saving} error={vm.release.error} onConfirm={()=>void vm.release.confirm()} onRetry={()=>void vm.release.retry()} onKeep={vm.release.keep}/>
 </ScreenContainer>;
}
const styles=StyleSheet.create({
 content:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.lg},section:{gap:spacing.sm},tiles:{flexDirection:'row',flexWrap:'wrap',gap:spacing.xs},tile:{flex:1,flexBasis:90,minHeight:72,padding:spacing.sm,gap:2,borderRadius:14,justifyContent:'center'},count:{...ui.pageTitle,fontSize:26,lineHeight:32},
 card:{...ui.panel,padding:spacing.md,gap:spacing.sm,borderRadius:16},head:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm},headRow:{flexDirection:'row',alignItems:'center',gap:spacing.xs},
 okCard:{padding:spacing.md,gap:spacing.sm,borderRadius:16,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},
 attentionRow:{minHeight:48,flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm,paddingVertical:spacing.xs},badge:{minWidth:24,height:24,paddingHorizontal:6,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:colors.warning},badgeText:{...ui.supporting,color:colors.white,fontWeight:'700'},
 prompt:{padding:spacing.sm,gap:spacing.xs,borderRadius:radius.control,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},promptHead:{flexDirection:'row',alignItems:'center',gap:spacing.xs,flexWrap:'wrap'},promptTitle:{...ui.body,fontWeight:'700',color:colors.warning},
 grow:{flexGrow:1,flexShrink:1,flexBasis:140,gap:2},linkRow:{alignSelf:'flex-start',minHeight:48,justifyContent:'center'},linkText:{...ui.body,color:colors.primaryAction,fontWeight:'600'},
});
