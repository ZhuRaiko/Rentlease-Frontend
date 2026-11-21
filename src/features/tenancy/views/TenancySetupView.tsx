import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,RefreshControl,StyleSheet,Text,TextInput,View} from 'react-native';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {useBottomClearance} from '../../../shared/components/useBottomClearance';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {PinnedFooter} from '../../../shared/components/PinnedFooter';
import {ButtonRow,Slot,StatusButton,StatusChip} from '../../../shared/components/StatusParts';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useTenancyEstablishmentViewModel} from '../viewModels/useTenancyEstablishmentViewModel';
import {useTenancyMoveInViewModel} from '../viewModels/useTenancyMoveInViewModel';
import {setupActions,type SetupAction} from '../models/TenancyEstablishment';
import {COPY,moveInScreen,moveInSheetView} from '../models/TenancyMoveIn';
import {HOW_IT_WORKS,UNCERTAIN_COPY,setupScreen,type SetupScreen} from '../models/TenancySetupScreen';
import {StepList} from '../components/MaintenanceParts';
import {SetupCancelSheet} from '../components/SetupCancelSheet';
import {MoveInBanner,MoveInStatusBlock} from '../components/MoveInBanner';
import {MoveInSheet} from '../components/MoveInSheet';
import {MoveInRequestActions,MoveInRequestBody} from './MoveInRequestPanel';

const titles:Record<Exclude<SetupAction,'cancel'>,string>={create:'Send terms',confirm:'Confirm terms',activate:'Start stay',review:'Review updated property'};
// The one existing confirmation wording, kept for every step that asks before it sends.
const CONFIRM_BODY='Confirm the displayed property, rental period, agreed monthly rent and rent day. No payment is collected. The tenancy becomes active only after both parties confirm and its start date arrives.';
const FALLBACK_NAMES={owner:'the owner',renter:'the renter'};

export function TenancySetupView({accountId,reservationId,onBack,onChanged,registerBackAction,conversationId=null,names=FALLBACK_NAMES,onMessage}:{accountId:string|undefined;reservationId:string;onBack:()=>void;onChanged:()=>void;registerBackAction?:((action:(()=>void)|null)=>void)|undefined;
  /** The chat for this reservation, when the caller knows it. Without it there is no Message button. */
  conversationId?:string|null|undefined;names?:{owner:string;renter:string}|undefined;onMessage?:((conversationId:string)=>void)|undefined}){
 // Every hook runs before anything is returned: the screen renders loading, loaded and sheet states with the same hooks.
 const vm=useTenancyEstablishmentViewModel(accountId,reservationId),ctx=vm.context,locked=vm.busy||vm.saving||vm.uncertain;
 const bottom=useBottomClearance();
 const [howOpen,setHowOpen]=useState(false),[cancelOpen,setCancelOpen]=useState(false),[askOpen,setAskOpen]=useState(false),[declineNote,setDeclineNote]=useState('');
 // Early move-in: read for a tenancy that still waits for its start date. The tenancy's real start date comes from here, never from the reservation (which stays old after an accept).
 const waiting=!!ctx?.tenancy&&['proposed','pending_confirmation'].includes(ctx.tenancy.status),moveIn=useTenancyMoveInViewModel(accountId,ctx?.tenancy?.id??'',waiting,onChanged);
 const partner=accountId&&ctx&&accountId===ctx.landlordId?names.renter:names.owner,stay={moveOut:ctx?.endDate??null,rent:ctx?.tenancy?.rent??null,dueDay:ctx?.tenancy?.dueDay??null};
 const mv=moveInScreen({read:moveIn.read,enabled:waiting,busy:moveIn.busy,ready:moveIn.ready,loadFailed:moveIn.loadFailed,partnerName:partner,stay,now:Date.now()}),startDate=mv.start;
 useEffect(()=>{vm.workflow.setStartDate(startDate);},[vm.workflow,startDate]);
 const movingBusy=moveIn.saving;
 const back=()=>{if(vm.saving||movingBusy)return;if(vm.uncertain){Alert.alert('We could not confirm it went through','Try again, or check the saved status. You can also leave and open this reservation again.',[{text:'Keep reviewing',style:'cancel'},{text:'Leave setup',onPress:onBack}]);}else onBack();};
 useEffect(()=>{registerBackAction?.(back);return()=>registerBackAction?.(null);});
 const send=async(action:SetupAction)=>{await vm.workflow.submit(action);if(vm.workflow.getSnapshot().notice)onChanged();};
 const act=(action:SetupAction)=>{
  if(action==='cancel'){setCancelOpen(true);return;}
  Alert.alert(titles[action],CONFIRM_BODY,[{text:'Keep reviewing',style:'cancel'},{text:titles[action],onPress:()=>void send(action)}]);
 };
 const actions=ctx&&accountId?setupActions(ctx,accountId,startDate):vm.actions;
 const screen:SetupScreen|null=ctx&&accountId?setupScreen({ctx,actor:accountId,actions,names,conversationId,startDate}):null;
 const canMessage=!!screen?.message&&!!conversationId&&!!onMessage;
 const respond=mv.respond,askVisible=mv.ask&&screen?.state==='ready',unconfirmed=moveIn.pending&&moveIn.pending.action==='request'?moveIn.pending.payload.requestedStartDate??null:null;
 const messagePerson=()=>{if(conversationId)onMessage?.(conversationId);};
 return <View style={styles.root}>
  <ScreenHeader title={respond?COPY.requestTitle:screen?.headerTitle??'Tenancy setup'} onBack={back} disabled={vm.saving||movingBusy} action={respond&&canMessage?<Pressable accessibilityRole="button" accessibilityLabel={`${COPY.message} ${partner}`} onPress={messagePerson} style={styles.headerAction}><Text style={styles.headerActionText}>{COPY.message}</Text></Pressable>:undefined}/>
  <KeyboardAwareScrollView contentContainerStyle={[styles.content,{paddingBottom:bottom}]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={vm.busy&&!!ctx} onRefresh={()=>void vm.workflow.load()} colors={[colors.primaryAction]}/>}>
   {vm.busy&&!ctx?<ActivityIndicator accessibilityLabel="Loading tenancy setup" color={colors.primaryAction}/>:null}
   {vm.error&&!vm.uncertain?<View accessibilityRole="alert" style={styles.alertRed}><Text style={styles.alertRedTitle}>{vm.error}</Text>
    <StatusButton label="Reload" disabled={vm.busy||vm.saving} onPress={()=>void vm.workflow.retry()}/></View>:null}
   {vm.uncertain?<View accessibilityRole="alert" style={styles.alertRed}><Text style={styles.alertRedTitle}>{UNCERTAIN_COPY.title}</Text><Text style={ui.supporting}>{UNCERTAIN_COPY.text}</Text>
    <ButtonRow><Slot><StatusButton label={UNCERTAIN_COPY.retry} disabled={vm.saving} onPress={()=>void vm.workflow.retry()}/></Slot><Slot><StatusButton label={UNCERTAIN_COPY.check} disabled={vm.saving} onPress={()=>void vm.workflow.load()}/></Slot></ButtonRow></View>:null}
   {vm.notice?<Text accessibilityLiveRegion="polite" style={ui.body}>{vm.notice}</Text>:null}
   {screen&&waiting?<MoveInStatusBlock loading={mv.load==='loading'} loadFailed={mv.load==='failed'} error={moveIn.error} notice={moveIn.notice} uncertain={!!moveIn.pending&&!moveIn.saving} saving={movingBusy} onReload={()=>void moveIn.workflow.load()} onRetry={()=>void moveIn.workflow.retry()} onCheck={()=>void moveIn.workflow.checkStatus()}/>:null}
   {respond&&screen?<MoveInRequestBody view={respond} property={`${screen.property.name}${screen.property.line?` · ${screen.property.line}`:''}`} note={declineNote} onNote={setDeclineNote} saving={movingBusy}/>:null}
   {screen&&!respond?<>
    {mv.banner?<MoveInBanner banner={mv.banner} saving={movingBusy} onWithdraw={()=>void moveIn.workflow.withdraw()}/>:null}
    <View style={styles.card}>
     <Text accessibilityRole="header" style={ui.sectionTitle}>{screen.property.name}</Text>
     {screen.property.line?<Text style={ui.supporting}>{screen.property.line}</Text>:null}
     {screen.chip?<StatusChip chip={screen.chip}/>:null}
    </View>
    {screen.prompt?<View style={[styles.callout,screen.prompt.tone==='warning'?styles.calloutWarn:styles.calloutInfo]}>
     {screen.prompt.title?<Text style={styles.calloutTitle}>{screen.prompt.title}</Text>:null}<Text style={ui.supporting}>{screen.prompt.text}</Text></View>:null}
    {screen.form?<View style={styles.card}>
     <Text style={ui.sectionTitle}>Proposed terms</Text>
     <Text style={ui.supporting}>Rent is filled from the listing. Dates come from the reservation.</Text>
     <Text style={styles.label}>Monthly rent (PHP)</Text>
     <TextInput accessibilityLabel="Agreed monthly rent" keyboardType="decimal-pad" editable={!locked} value={vm.draft.rent} onChangeText={rent=>vm.workflow.setDraft({rent})} style={[ui.control,ui.body,styles.input]}/>
     <Text style={styles.label}>Rent due day</Text>
     <TextInput accessibilityLabel="Monthly rent due day" placeholder="Pick a day, 1 – 28" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={2} editable={!locked} value={vm.draft.dueDay} onChangeText={dueDay=>vm.workflow.setDraft({dueDay})} style={[ui.control,ui.body,styles.input]}/>
     <View style={styles.rule}/>
     <Fact label="Move-in" value={screen.stay.start}/><Fact label="Move-out" value={screen.stay.end}/>
     <Text style={ui.supporting}>{screen.stay.length}. To change dates, update the reservation.</Text>
    </View>:null}
    {screen.facts?<View style={styles.card}>{screen.facts.map(f=><Fact key={f.label} label={f.label} value={f.value}/>)}</View>:null}
    {screen.steps?<View style={styles.card}><StepList steps={screen.steps}/></View>:null}
    {screen.reason?<Text style={ui.supporting}>{screen.reason}</Text>:null}
    {screen.note?<Text style={ui.supporting}>{screen.note}</Text>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="How this works" accessibilityState={{expanded:howOpen}} onPress={()=>setHowOpen(v=>!v)} style={styles.disclosure}>
     <Text style={styles.disclosureTitle}>How this works</Text><Text style={styles.disclosureAction}>{howOpen?'Hide':'Show'}</Text></Pressable>
    {howOpen?<View style={styles.card}>{HOW_IT_WORKS.map(line=><Text key={line} style={ui.body}>{line}</Text>)}</View>:null}
   </>:null}
  </KeyboardAwareScrollView>
  {respond?<PinnedFooter><MoveInRequestActions view={respond} saving={movingBusy} onAccept={()=>void moveIn.workflow.accept()} onDecline={()=>{void moveIn.workflow.decline(declineNote).then(ok=>{if(ok)setDeclineNote('');});}}/></PinnedFooter>:null}
  {!respond&&screen&&(screen.main||askVisible||canMessage||screen.cancel)?<PinnedFooter>
   {screen.main?<StatusButton tone={screen.main.tone} label={vm.saving&&screen.main.action?'Saving…':screen.main.label} disabled={screen.main.disabled||locked||!screen.main.action} onPress={()=>{if(screen.main?.action)act(screen.main.action);}}/>:null}
   {askVisible?<StatusButton label={COPY.ask} disabled={locked||movingBusy} onPress={()=>setAskOpen(true)}/>:null}
   {screen.cancelStyle==='button'&&(canMessage||screen.cancel)?<ButtonRow>
    {canMessage?<Slot><StatusButton label="Message" disabled={vm.saving} onPress={()=>{if(conversationId)onMessage?.(conversationId);}}/></Slot>:null}
    {screen.cancel?<Slot><StatusButton tone="dangerOutline" label="Cancel setup" disabled={locked} onPress={()=>act('cancel')}/></Slot>:null}</ButtonRow>:null}
   {screen.cancelStyle==='link'&&canMessage?<StatusButton label="Message" disabled={vm.saving} onPress={()=>{if(conversationId)onMessage?.(conversationId);}}/>:null}
   {screen.cancelStyle==='link'&&screen.cancel?<Pressable accessibilityRole="button" accessibilityLabel="Cancel setup" accessibilityState={{disabled:locked}} disabled={locked} onPress={()=>act('cancel')} style={styles.link}><Text style={styles.linkText}>Cancel setup</Text></Pressable>:null}
  </PinnedFooter>:null}
  <MoveInSheet visible={askOpen&&!!moveIn.read} view={moveInSheetView(moveIn.read,stay,partner)} start={startDate} saving={movingBusy} error={moveIn.error} conflictDate={moveIn.conflictDate} unconfirmed={unconfirmed}
   onSend={(date)=>moveIn.workflow.request(date)} onRetry={()=>moveIn.workflow.retry()} onCheck={async()=>{await moveIn.workflow.checkStatus();return !moveIn.workflow.getSnapshot().pending;}} onClose={()=>setAskOpen(false)}/>
  <SetupCancelSheet visible={cancelOpen} saving={vm.saving} onKeep={()=>setCancelOpen(false)} onConfirm={()=>{setCancelOpen(false);void send('cancel');}}/>
 </View>;
}
function Fact({label,value}:{label:string;value:string}){return <View style={styles.fact}><Text style={ui.supporting}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.background},content:{padding:spacing.md,gap:spacing.sm+2},
 card:{padding:spacing.md,gap:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background},
 callout:{padding:spacing.sm,gap:2,borderRadius:radius.control,borderWidth:1},calloutWarn:{borderColor:colors.warning,backgroundColor:colors.warningSurface},calloutInfo:{borderColor:colors.outline,backgroundColor:colors.identitySurface},
 calloutTitle:{...ui.body,fontWeight:'700'},
 alertRed:{padding:spacing.md,gap:spacing.sm,borderRadius:radius.control,borderWidth:1,borderColor:colors.restricted,backgroundColor:colors.restrictedSurface},alertRedTitle:{...ui.body,fontWeight:'700',color:colors.restricted},
 label:{...ui.body,fontWeight:'700'},input:{paddingHorizontal:12},rule:{height:1,backgroundColor:colors.border},
 fact:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',gap:spacing.sm},factValue:{...ui.body,fontWeight:'700',flexShrink:1,textAlign:'right'},
 disclosure:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.md,borderRadius:radius.control,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background},
 disclosureTitle:{...ui.body,fontWeight:'700'},disclosureAction:{...ui.supporting,color:colors.primaryAction,fontWeight:'700'},
 link:{minHeight:48,alignItems:'center',justifyContent:'center'},linkText:{...ui.body,fontWeight:'700',color:colors.restricted},
 headerAction:{minHeight:48,minWidth:48,paddingHorizontal:spacing.sm,alignItems:'center',justifyContent:'center'},headerActionText:{...ui.body,fontWeight:'700',color:colors.primaryAction},
});
