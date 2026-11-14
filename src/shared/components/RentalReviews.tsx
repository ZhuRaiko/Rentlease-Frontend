import {RatingScale} from './RatingScale';
import type {ReactNode} from 'react';
import {PropertyReviewWordCloud} from './PropertyReviewWordCloud';
import {useEffect,useState} from 'react';import {ActivityIndicator,Alert,Text,TextInput,View} from 'react-native';
import {AppButton} from './AppButton';import {ui} from '../theme/ui';import {colors} from '../theme/colors';import {useRentalReviews} from '../viewModels/useRentalReviews';import {reviewNotEligibleText,reviewScreenFor,reviewStatusLabel,type ReviewKind,type ReviewRow} from '../models/RentalReview';
type Model=ReturnType<typeof useRentalReviews>;
function State({vm,compact=false}:{vm:Model;compact?:boolean}){return <>{vm.busy?<ActivityIndicator accessibilityLabel="Loading reviews"/>:null}{vm.error?<Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text>:null}{vm.notice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{vm.notice}</Text>:null}{vm.pending?<><Text style={ui.supporting}>A review action needs reconciliation. Retry the same saved operation; keep app data until it is confirmed.</Text><AppButton label="Retry pending review action" disabled={!vm.ready||vm.busy||vm.saving} onPress={()=>void vm.workflow.retry()}/></>:null}{!compact||vm.error?<AppButton label={compact?'Retry reviews':'Refresh reviews'} variant="secondary" disabled={vm.busy||vm.saving} onPress={()=>void vm.workflow.load()}/>:null}</>;}
function Card({row}:{row:ReviewRow}){return <View style={{borderTopWidth:1,borderColor:colors.outline,paddingTop:12,gap:6}}><Text style={ui.body}>{row.rating} / 5</Text>{row.text?<Text style={ui.body}>{row.text}</Text>:<Text style={ui.supporting}>Rating only; no written feedback.</Text>}<Text style={ui.supporting}>{new Date(row.createdAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</Text></View>;}
function Pages({vm,count}:{vm:Model;count:number}){return <>{vm.offset>0?<AppButton label="Previous review page" variant="secondary" disabled={vm.busy||vm.saving||!!vm.pending} onPress={()=>void vm.workflow.load(Math.max(0,vm.offset-20))}/>:null}{count===20?<AppButton label="More reviews" variant="secondary" disabled={vm.busy||vm.saving||!!vm.pending||vm.offset>=10000} onPress={()=>void vm.workflow.load(vm.offset+20)}/>:null}</>;}
export function PublishedRentalReviews({accountId,kind,targetId,compact=false,navigation}:{accountId:string|undefined;kind:ReviewKind;targetId:string;compact?:boolean;navigation?:ReactNode}){const vm=useRentalReviews(accountId,{mode:kind,id:targetId}),d=vm.data?.type==='public'?vm.data.value:null;return <View style={{gap:11}}>{compact?<><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingBottom:12,borderBottomWidth:1,borderBottomColor:colors.outline}}><View accessible={false} style={{width:53,height:53,borderRadius:13,backgroundColor:colors.primaryPale,alignItems:'center',justifyContent:'center'}}><Text style={{...ui.body,fontSize:24,color:colors.primaryAction}}>{'\u2606'}</Text></View><View style={{flex:1,gap:4}}><Text style={{...ui.body,fontSize:14,fontWeight:'700'}}>{d&&d.count>0?`${d.average!.toFixed(1)} / 5`:vm.busy?'Loading feedback':vm.error?'Feedback unavailable':kind==='property'?'Property experiences':'Landlord feedback'}</Text><Text style={{...ui.supporting,fontSize:11}}>{d&&d.count>0?`${d.count} approved ${d.count===1?'review':'reviews'}`:'Only approved feedback appears here.'}</Text></View></View>{navigation}</>:null}{!compact?<Text style={ui.sectionTitle}>{kind==='property'?'Property ratings and reviews':'Participant ratings and reviews'}</Text>:null}{!accountId?<Text style={ui.supporting}>Sign in to view published feedback.</Text>:<State compact={compact} vm={vm}/>}{d?<>{d.count>0?!compact?<Text style={ui.body}>{d.average!.toFixed(1)} / 5 from {d.count} published {d.count===1?'review':'reviews'}</Text>:null:<Text style={ui.supporting}>{kind==='property'?'No approved property reviews yet.':'No approved landlord feedback available.'}</Text>}{kind==='property'&&!compact?<PropertyReviewWordCloud key={`${accountId}:${targetId}`} accountId={accountId} propertyId={targetId}/>:null}{d.rows.map(r=><Card key={r.id} row={r}/>)}<Pages vm={vm} count={d.rows.length}/>{!compact||d.count>0?<Text style={ui.supporting}>Only approved feedback is included. Reviewer identities are protected.</Text>:null}</>:null}</View>;}
/**
 * One review screen per person (decision D1). The tenant reviews the property and is never offered a rating of the landlord; the landlord rates the tenant.
 * Everything that decides what is shown lives in reviewScreenFor / reviewNotEligibleText (models/RentalReview.ts).
 */
export function TenancyReviewPanel({accountId,tenancyId,registerExitGuard,endDate}:{accountId:string|undefined;tenancyId:string;registerExitGuard?:((guard:(()=>boolean)|null)=>void)|undefined;endDate?:string|null|undefined}){
 const vm=useRentalReviews(accountId,{mode:'tenancy',id:tenancyId}),c=vm.data?.type==='context'?vm.data.value:null,[rating,setRating]=useState<number|null>(null),[body,setBody]=useState('');
 const screen=c&&accountId?reviewScreenFor(c,accountId):null,locked=!vm.ready||vm.busy||vm.saving||!!vm.pending;
 useEffect(()=>{registerExitGuard?.(()=>{if(vm.saving){Alert.alert('Review in progress','Wait until the submission result is confirmed.');return false;}return true;});return()=>registerExitGuard?.(null);},[vm.saving,registerExitGuard]);
 useEffect(()=>{if(vm.notice){setRating(null);setBody('');}},[vm.notice]);
 const send=()=>{if(!screen||rating===null)return;const kind=screen.kind,score=rating,text=body;Alert.alert(screen.role==='tenant'?'Send your review?':'Send your rating?',`${screen.role==='tenant'?'Your review of the property':'Your rating of this tenant'}: ${score} / 5. You can't edit it afterward.`,[{text:'Cancel',style:'cancel'},{text:'Send',onPress:()=>{void vm.workflow.submit({action:'submit',tenancyId,kind,rating:score,text});}}]);};
 return <View style={{gap:12}}>
  <Text accessibilityRole="header" style={ui.sectionTitle}>{screen?screen.title:'Tenancy review'}</Text>
  <State vm={vm}/>
  {screen?<>
   {screen.state==='not_eligible'?<Text style={ui.body}>{reviewNotEligibleText(endDate)}</Text>:null}
   {screen.state==='legacy'?<Text style={ui.supporting}>An existing participant review is retained and cannot be duplicated. Its publication requires administrative recovery review.</Text>:null}
   {[...(screen.own?[screen.own]:[]),...screen.earlier].map(r=><View key={r.id} style={{...ui.panel,padding:14,gap:8}}>
    <Text style={ui.sectionTitle}>{r.id===screen.own?.id?'Your review':screen.role==='tenant'?'Your earlier rating of the landlord':'Your earlier review'}</Text>
    <Text style={ui.supporting}>{reviewStatusLabel(r.status)}</Text>
    <Card row={r}/>
   </View>)}
   {screen.state==='form'?<>
    <Text style={ui.supporting}>{screen.helper}</Text>
    <RatingScale value={rating} onChange={setRating} disabled={locked}/>
    <TextInput accessibilityLabel="Optional written review" multiline editable={!locked} value={body} onChangeText={setBody} maxLength={2000} placeholder="Optional feedback in your own words" style={{...ui.control,minHeight:100,padding:12,borderWidth:1,borderColor:colors.controlBorder,borderRadius:10,color:colors.ink,textAlignVertical:'top'}}/>
    <Text style={ui.supporting}>A review can't be edited after it is sent. Avoid sharing contact details or sensitive information.</Text>
    <AppButton label={vm.saving?'Sending...':screen.role==='tenant'?'Submit review':'Submit rating'} disabled={locked||rating===null} onPress={send}/>
   </>:null}
  </>:null}
 </View>;
}
