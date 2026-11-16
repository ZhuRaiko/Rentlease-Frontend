import {TenancyReviewPanel,type ReviewSubject} from '../../../shared/components/TenancyReviewPanel';
import {TagPills} from '../../../shared/components/ReviewParts';
import {dateRange} from '../../../shared/utils/rentalDates';
import {TenancyLifecyclePanel} from './TenancyLifecyclePanel';
import {MaintenanceFlowView} from './MaintenanceFlowView';
import {RentLedgerPanel} from './RentLedgerPanel';
import {payableRow} from '../models/RentLedger';
import {useRentLedgerViewModel} from '../viewModels/useRentLedgerViewModel';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,RefreshControl,StyleSheet,Text,View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {AppButton} from '../../../shared/components/AppButton';
import {ui} from '../../../shared/theme/ui';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {useTenancyDetailsViewModel} from '../viewModels/useTenancyDetailsViewModel';
import {useTenancyCareViewModel} from '../viewModels/useTenancyCareViewModel';
import {useTenancyLifecycleViewModel} from '../viewModels/useTenancyLifecycleViewModel';
import {useRentalReviews} from '../../../shared/viewModels/useRentalReviews';
import {generalizedLocation} from '../models/TenancyDetails';
import {detailsScreen,stars,REVIEWS_NOTE,type DetailsScreen} from '../models/TenancyDetailsScreen';
import type {TenancyDetailsPanel} from '../viewModels/tenancyDetailsWorkflow';
import {effectiveReservationStatus,reservationStatusLabels} from '../../messaging-viewing/models/RentalReservation';
import {ButtonRow,Slot,StatusButton,StatusChip} from '../../../shared/components/StatusParts';
import {HeroPhoto,PersonRow,Stars} from '../components/TenancyParts';
interface Props {
  accountId:string|undefined;tenancyId:string;reservationId:string|null;onBack:()=>void;onOpenConversation?:((id:string)=>void)|undefined;externalPanelOpen?:boolean;registerBackAction:((action:(()=>void)|null)=>void);
  /** Opens a panel as soon as the details have loaded (for example the care panel from "Report an issue"). */
  initialPanel?:TenancyDetailsPanel|undefined;
  /** With the care panel: opens this maintenance request straight away. */
  initialRequestId?:string|undefined;
  /** Opens the property screen (today's list of properties until a single property's Manage screen exists). */
  onOpenProperty?:((propertyId:string)=>void)|undefined;
}
function reviewSubject(screen:DetailsScreen,photos:ReviewSubject['photos'],start:string,end:string|null|undefined):ReviewSubject{const range=dateRange(start,end);return screen.role==='tenant'?{title:screen.title,subtitle:`${screen.place} · ${range}`,photos,initial:null}:{title:screen.person.label,subtitle:`Tenant at ${screen.title} · ${range}`,photos:null,initial:screen.person.label.trim().charAt(0).toUpperCase()};}
function Row({label,onPress}:{label:string;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.docRow}><Text style={ui.body}>{label}</Text><Text accessible={false} style={styles.chevron}>›</Text></Pressable>;}
function Card({title,right,children}:{title?:string;right?:React.ReactNode;children:React.ReactNode}){return <View style={styles.card}>{title?<View style={styles.cardHead}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>{right}</View>:null}{children}</View>;}
function Timeline({items}:{items:NonNullable<DetailsScreen['timeline']>}){return <View>{items.map((e,index)=><View key={e.key} style={styles.timelineRow}><View style={styles.rail}><View style={[styles.dot,index===items.length-1&&{backgroundColor:colors.warning}]}/>{index<items.length-1?<View style={styles.line}/>:null}</View><View style={{flex:1,paddingBottom:spacing.sm}}><Text style={ui.body}>{e.label}</Text><Text style={ui.supporting}>{e.date}{e.note?` · ${e.note}`:''}</Text></View></View>)}</View>;}
export function TenancyDetailsView({accountId,tenancyId,reservationId,onBack,onOpenConversation,externalPanelOpen=false,registerBackAction,initialPanel,initialRequestId,onOpenProperty}:Props){
 const vm=useTenancyDetailsViewModel(accountId,tenancyId,reservationId,externalPanelOpen),d=vm.data,t=d?.tenancy;
 const care=useTenancyCareViewModel(accountId,tenancyId),life=useTenancyLifecycleViewModel(accountId,tenancyId),reviews=useRentalReviews(accountId,{mode:'tenancy',id:tenancyId});
 const [reviewTitle,setReviewTitle]=useState('Ratings'),[careTitle,setCareTitle]=useState('My maintenance requests');
 const exitGuard=useRef<(()=>boolean)|null>(null),registerExitGuard=useCallback((guard:(()=>boolean)|null)=>{exitGuard.current=guard;},[]);
 const back=()=>{if(exitGuard.current&&!exitGuard.current())return;if(!vm.workflow.back())onBack();};
 useEffect(()=>{if(externalPanelOpen)return;registerBackAction(back);return()=>registerBackAction(null);});
 const requestOnce=useRef(initialRequestId),wasCare=useRef(false);
 useEffect(()=>{if(vm.panel==='care')wasCare.current=true;else if(wasCare.current)requestOnce.current=undefined;},[vm.panel]);
 const applied=useRef(false);
 useEffect(()=>{if(!applied.current&&initialPanel&&vm.phase==='success'){applied.current=true;vm.workflow.open(initialPanel);}},[initialPanel,vm.phase]);
 const screen=d&&t&&accountId?detailsScreen({actor:accountId,tenancy:t,context:d.context,identities:vm.identities,care:care.data,lifecycle:life.data,reviews:reviews.data?.type==='context'?reviews.data.value:null,reservation:d.reservation,conversationId:d.conversationId,now:Date.now()}):null;
 const counterpart=screen?.person.label??'the other person',rent=useRentLedgerViewModel(accountId,tenancyId,d?.conversationId??null,counterpart);
 const payable=t?payableRow(rent.rows,accountId===t.tenant_id?'tenant':'landlord',t.status):undefined;
 const title=vm.panel==='rent'?`Rent · ${screen?.title??'Rental'}`:vm.panel==='reviews'?reviewTitle:vm.panel==='lifecycle'?'Tenancy completion':vm.panel==='care'||vm.panel==='report'?careTitle:vm.panel==='property'?'Property information':vm.panel==='reservation'?'Reservation reference':'Tenancy details';
 const message=()=>{if(d?.conversationId)onOpenConversation?.(d.conversationId);};
 return <View style={styles.screen}><ScreenHeader title={title} onBack={back}/><KeyboardAwareScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={vm.phase==='loading'} onRefresh={()=>void vm.workflow.load()}/>}>
 {vm.phase==='loading'||vm.phase==='idle'?<ActivityIndicator accessibilityLabel="Loading tenancy details" color={colors.primaryAction}/>:null}
 {vm.error?<View style={styles.card}><Text accessibilityRole="alert" style={ui.body}>{vm.error}</Text><AppButton label="Retry tenancy details" variant="secondary" onPress={()=>void vm.workflow.load()}/></View>:null}
 {d&&t&&screen?<>
 {vm.panel==='reviews'?<TenancyReviewPanel key={`${accountId}:${t.id}`} accountId={accountId} tenancyId={t.id} otherName={screen.person.label} subject={reviewSubject(screen,d.context.photos,t.start_date,t.actual_end_date??t.expected_end_date)} endDate={t.actual_end_date??t.expected_end_date} registerExitGuard={registerExitGuard} onTitle={setReviewTitle} onDone={()=>{void reviews.workflow.load();vm.workflow.back();}}/>
  :vm.panel==='lifecycle'?<TenancyLifecyclePanel key={`${accountId}:${t.id}`} accountId={accountId} tenancyId={t.id} registerExitGuard={registerExitGuard} onChanged={()=>void vm.workflow.load()}/>
  :vm.panel==='rent'?<RentLedgerPanel accountId={accountId} counterpart={counterpart} hasConversation={!!d.conversationId} rent={rent}/>
  :vm.panel==='care'||vm.panel==='report'?<MaintenanceFlowView key={`${accountId}:${t.id}:${vm.panel}`} accountId={accountId} role={screen.role} tenancyId={t.id} propertyId={t.property_id} propertyTitle={screen.title} otherName={screen.person.label} start={vm.panel==='report'&&screen.role==='tenant'?{kind:'report'}:requestOnce.current&&vm.panel==='care'?{kind:'request',requestId:requestOnce.current}:{kind:'list'}} registerExitGuard={registerExitGuard} onTitle={setCareTitle}/>
  :vm.panel==='property'?<View style={styles.card}>{d.context.property?<><Text style={ui.sectionTitle}>Authorized property information</Text><Text style={ui.body}>{d.context.property.type.replace(/_/g,' ')}</Text><Text style={ui.body}>Generalized public location: {generalizedLocation(d.context.property)}</Text><Text style={ui.body}>{d.context.property.bedrooms??'Unknown'} bedrooms; {d.context.property.bathrooms??'Unknown'} bathrooms</Text><Text style={ui.body}>Floor area: {d.context.property.floorArea===null?'Unknown':`${d.context.property.floorArea} sqm`}</Text><Text style={ui.body}>Furnishing: {d.context.property.furnishing?.replace(/_/g,' ')??'Unknown'}</Text><Text style={ui.supporting}>Property: {d.context.property.active?'active':'inactive'}. Listing: {d.context.listingStatus??'unavailable'}.</Text><Text style={ui.supporting}>Only authorized public property fields are shown. Exact addresses and private map points are excluded.</Text></>:<Text style={ui.body}>Property information is inaccessible or unavailable.</Text>}</View>
  :vm.panel==='reservation'?<View style={styles.card}>{d.reservation?<><Text style={ui.sectionTitle}>Source reservation</Text><Text style={ui.body}>Status: {reservationStatusLabels[effectiveReservationStatus(d.reservation,Date.parse(d.reservation.serverNow))]}</Text><Text style={ui.body}>Move-in: {d.reservation.moveInDate}</Text><Text style={ui.body}>Reservation ends: {d.reservation.endDate} (exclusive)</Text><Text style={ui.supporting}>This is the source commitment. Its status is separate from the actual tenancy; no reservation action is performed here.</Text></>:<Text style={ui.body}>No accessible source reservation was established for this tenancy.</Text>}</View>
  :<>
   <Card>
    <HeroPhoto photos={d.context.photos} chip={screen.chip} muted={screen.muted}/>
    <View style={{gap:2}}><Text accessibilityRole="header" style={ui.sectionTitle}>{screen.title}</Text><Text style={ui.supporting}>{screen.place}</Text></View>
    {screen.dates.progress?<><View style={styles.datesRow}><Text style={ui.supporting}>{screen.dates.start}</Text><Text style={ui.supporting}>{screen.dates.end}</Text></View>
      <View accessibilityRole="progressbar" accessibilityLabel={screen.dates.progress.label} accessibilityValue={{min:0,max:100,now:Math.round(screen.dates.progress.fraction*100)}} style={styles.track}><View style={[styles.fill,{width:`${Math.round(screen.dates.progress.fraction*100)}%`}]}/></View>
      <Text style={ui.supporting}>{screen.dates.progress.label}{t.agreed_monthly_rent!==undefined?` · agreed rent ₱${t.agreed_monthly_rent.toLocaleString('en-PH')} / month`:''}</Text></>
     :<Text style={ui.supporting}>{screen.dates.start}{screen.dates.end?` – ${screen.dates.end}`:''}</Text>}
    {screen.summary?<Text style={ui.body}>{screen.summary}</Text>:null}
   </Card>
   {screen.actions?<ButtonRow><Slot><StatusButton tone="primary" label={screen.actions.primary.label} onPress={()=>screen.actions!.primary.kind==='report'?vm.workflow.open('report'):onOpenProperty?.(t.property_id)}/></Slot>{screen.actions.message?<Slot><StatusButton label="Message" onPress={message}/></Slot>:null}</ButtonRow>:null}
   {screen.ratingPrompt?<View style={styles.prompt}><View style={styles.promptHead}><Stars/><Text style={styles.promptTitle}>{screen.ratingPrompt.title}</Text></View><Text style={ui.supporting}>{screen.ratingPrompt.body}</Text><StatusButton tone="warning" label={screen.ratingPrompt.button} onPress={()=>vm.workflow.open('reviews')}/></View>:null}
   {screen.reviews?<Card title="Reviews from this tenancy">{screen.reviews.length?screen.reviews.map(r=><View key={r.key} style={{gap:2}}><Text style={ui.supporting}>{r.status?`${r.label} · ${r.status}`:r.label}</Text><Text accessibilityLabel={`${r.rating} out of 5 stars`} style={styles.starsText}>{stars(r.rating)}</Text><Text style={ui.body}>{r.text||'Rating only; no written feedback.'}</Text><TagPills labels={r.tags}/></View>):<Text style={ui.supporting}>No reviews yet.</Text>}<Text style={ui.supporting}>{REVIEWS_NOTE}</Text></Card>:null}
   {screen.timeline?<Card title="What happened"><Timeline items={screen.timeline}/></Card>:null}
   {screen.rent?<Card title="Rent" right={<Text style={ui.supporting}>{screen.rent.dueOn}</Text>}>{screen.rent.rows.length?screen.rent.rows.map(row=><View key={row} style={styles.rentRow}><Text style={ui.body}>Due {row}</Text></View>):<Text style={ui.supporting}>No upcoming date is scheduled.</Text>}<Text style={ui.supporting}>{screen.rent.note}</Text>
    {rent.notice?<Text accessibilityLiveRegion="polite" style={styles.rentNotice}>{rent.notice}</Text>:null}{rent.error?<Text accessibilityRole="alert" style={ui.supporting}>{rent.error}</Text>:null}
    {t.status==='active'?<ButtonRow>{payable?<Slot><StatusButton tone="primary" label="I've paid" accessibilityLabel={`I've paid for ${payable.dueDate}`} disabled={rent.saving||rent.busy} onPress={()=>void rent.workflow.act('mark_paid',payable.dueDate)}/></Slot>:null}{rent.pending?<Slot><StatusButton label="Retry" disabled={rent.saving||rent.busy} onPress={()=>void rent.workflow.retry()}/></Slot>:null}<Slot><StatusButton label="View ledger" onPress={()=>vm.workflow.open('rent')}/></Slot></ButtonRow>:null}</Card>:null}
   <Card title={screen.person.relation}><PersonRow accountId={accountId} person={screen.person} showRelation={false}/></Card>
   {screen.maintenance?<Pressable accessibilityRole="button" accessibilityLabel={`Maintenance, ${screen.maintenance.chip}`} onPress={()=>vm.workflow.open('care')} style={styles.card}><View style={styles.cardHead}><Text accessibilityRole="header" style={ui.sectionTitle}>Maintenance</Text><StatusChip chip={{label:screen.maintenance.chip,tone:'warning'}}/></View>{screen.maintenance.latest?<View style={styles.docRow}><View style={{flex:1}}><Text style={ui.body}>{screen.maintenance.latest.title}</Text><Text style={ui.supporting}>{screen.maintenance.latest.meta}</Text></View><Text accessible={false} style={styles.chevron}>›</Text></View>:<Text style={ui.supporting}>No requests yet.</Text>}</Pressable>:null}
   {screen.documents.length?<Card title="Tenancy documents">{screen.documents.map(doc=><Row key={doc.key} label={doc.label} onPress={()=>vm.workflow.open(doc.key)}/>)}</Card>:null}
   {screen.openConversation?<StatusButton label="Open conversation" onPress={message}/>:null}
   {screen.endEarly?<StatusButton tone="dangerOutline" label="Request to end early" onPress={()=>vm.workflow.open('lifecycle')}/>:null}
  </>}
 {[d.context.notice,d.conversationNotice,d.reservationNotice].filter(Boolean).length?<View style={styles.card}><Text style={ui.supporting}>{[d.context.notice,d.conversationNotice,d.reservationNotice].filter(Boolean).join(' ')}</Text><AppButton label="Retry related information" variant="secondary" onPress={()=>void vm.workflow.load()}/></View>:null}
 </>:null}
 </KeyboardAwareScrollView></View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.lg},
 card:{...ui.panel,padding:spacing.md,gap:spacing.sm,borderRadius:16},cardHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:spacing.xs},
 datesRow:{flexDirection:'row',justifyContent:'space-between',flexWrap:'wrap',gap:spacing.xs},track:{height:6,borderRadius:3,backgroundColor:colors.primaryPale,overflow:'hidden'},fill:{height:6,backgroundColor:colors.primaryAction},
 rentRow:{minHeight:36,justifyContent:'center'},rentNotice:{...ui.supporting,color:colors.primaryAction,fontWeight:'600'},docRow:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:spacing.sm},chevron:{...ui.sectionTitle,color:colors.textSecondary},
 prompt:{padding:spacing.sm,gap:spacing.xs,borderRadius:radius.panel,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningSurface},promptHead:{flexDirection:'row',alignItems:'center',gap:spacing.xs,flexWrap:'wrap'},promptTitle:{...ui.body,fontWeight:'700',color:colors.warning},starsText:{color:colors.reviewOrange,fontSize:16,letterSpacing:2},
 timelineRow:{flexDirection:'row',gap:spacing.sm},rail:{width:12,alignItems:'center'},dot:{width:10,height:10,borderRadius:5,marginTop:5,backgroundColor:colors.primaryAction},line:{flex:1,width:2,backgroundColor:colors.outline},
});
