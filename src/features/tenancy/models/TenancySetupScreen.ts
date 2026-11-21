import {philippineDate} from '../../messaging-viewing/models/RentalReservation';
import {propertyCityOptions,propertyTypeOptions} from '../../property-listing/models/DraftProperty';
import type {Chip} from '../../../shared/models/StatusChip';
import {daysBetween,inDays,pesos,shortDate} from '../../../shared/utils/rentalDates';
import type {SetupAction,SetupContext} from './TenancyEstablishment';

/**
 * What the Tenancy setup screen shows for one person in one state. Pure: it reads the setup context and what setupActions allows, and
 * decides the chip, the facts, the step line, the one main action and the quiet ones. The View only draws it.
 */
export type SetupState='proposing'|'waiting_for_owner'|'owner_waiting'|'renter_confirms'|'ready'|'start_now'|'property_changed'|'not_eligible'|'active'|'closed';
export interface SetupStep {key:string;label:string;detail:string;state:'done'|'current'|'upcoming'}
export interface SetupMain {action:SetupAction|null;label:string;tone:'primary'|'warning';disabled:boolean}
export interface SetupPrompt {tone:'warning'|'info';title:string|null;text:string}
export interface SetupScreen {
  state:SetupState;headerTitle:string;
  property:{name:string;line:string};chip:Chip|null;prompt:SetupPrompt|null;
  /** The editable owner form: only when nothing has been proposed yet. */
  form:boolean;
  facts:{label:string;value:string}[]|null;stay:{start:string;end:string;length:string};
  steps:SetupStep[]|null;
  main:SetupMain|null;
  /** Message is a real button only when a conversation is known. */
  message:boolean;
  cancel:boolean;cancelStyle:'button'|'link';
  note:string|null;reason:string|null;
}
export interface SetupInput {ctx:SetupContext;actor:string;actions:readonly SetupAction[];names:{owner:string;renter:string};conversationId:string|null;
  /** The tenancy's real start date (get_tenancy_move_in). When absent the reservation's date in the setup context is used, which is only right before an early move-in is accepted. */
  startDate?:string|null}

const SUMMARY_TAIL=/(bedrooms|bathrooms|sqm)$/;
/** "condominium, tagaytay, Maharlika West, 1 bedrooms, ..." becomes "Condominium · Maharlika West, Tagaytay". An unreadable summary is shown as it is. */
export function propertyLine(summary:string):string{
  const parts=summary.split(', ').map(p=>p.trim()).filter(Boolean);
  if(parts.length<2)return summary.trim();
  const [type,city,third]=parts,barangay=third&&!SUMMARY_TAIL.test(third)?third:null;
  const typeLabel=propertyTypeOptions.find(o=>o.value===type)?.label??type!.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
  const cityLabel=propertyCityOptions.find(o=>o.value===city)?.label??city!.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
  return `${typeLabel} · ${[barangay,cityLabel].filter(Boolean).join(', ')}`;
}

const addDays=(date:string,days:number):string=>new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
/** "3 months" when the stay is whole calendar months, else the number of days. The end date is the last day of the stay. */
export function stayLength(start:string,end:string):string{
  const after=addDays(end,1),[sy,sm,sd]=start.split('-').map(Number),[ey,em,ed]=after.split('-').map(Number);
  const months=(ey!-sy!)*12+(em!-sm!);
  if(months>0&&sd===ed)return `${months} ${months===1?'month':'months'}`;
  const days=daysBetween(start,after);
  return `${days} ${days===1?'day':'days'}`;
}
const longDay=(date:string)=>`${shortDate(date)}, ${date.slice(0,4)}`;

export function setupScreen(i:SetupInput):SetupScreen{
  const {ctx,actor,actions,names}=i,t=ctx.tenancy,owner=actor===ctx.landlordId,today=philippineDate(Date.parse(ctx.serverNow)),startDate=t&&i.startDate?i.startDate:ctx.startDate;
  const base={property:{name:ctx.listingTitle,line:propertyLine(ctx.propertySummary)},stay:{start:longDay(startDate),end:longDay(ctx.endDate),length:stayLength(startDate,ctx.endDate)},reason:!ctx.eligible?ctx.reason:null};
  const none={form:false,facts:null,steps:null,main:null,message:false,cancel:false,cancelStyle:'link' as const,note:null,prompt:null,chip:null};
  const facts=t?[{label:'Rent',value:`${pesos(t.rent)} / month`},{label:'Rent due',value:`The ${ordinalDay(t.dueDay)} of each month`},{label:'Stay',value:`${shortDate(startDate)} – ${shortDate(ctx.endDate)} (${stayLength(startDate,ctx.endDate)})`}]:null;
  const cancel=actions.includes('cancel'),message=!!i.conversationId;

  if(!t){
    if(owner&&ctx.eligible)return {...none,...base,state:'proposing',headerTitle:'Set up tenancy',form:true,main:{action:'create',label:`Send terms to ${names.renter}`,tone:'primary',disabled:false},note:`Nothing starts until ${names.renter} confirms.`};
    if(owner)return {...none,...base,state:'not_eligible',headerTitle:'Tenancy setup'};
    return {...none,...base,state:'waiting_for_owner',headerTitle:'Tenancy setup',chip:{label:`Waiting for ${names.owner}`,tone:'warning'},prompt:{tone:'warning',title:`${names.owner} has not sent terms yet`,text:'Nothing to do now. Check back later.'},message};
  }
  if(t.status==='active')return {...none,...base,state:'active',headerTitle:'Tenancy setup',chip:{label:'Active',tone:'positive'},facts,prompt:{tone:'info',title:null,text:'This tenancy is active.'}};
  if(t.status==='ended'||t.status==='cancelled')return {...none,...base,state:'closed',headerTitle:'Tenancy setup',chip:t.status==='ended'?{label:'Ended',tone:'neutral'}:{label:'Cancelled',tone:'restricted'},facts};

  // A proposal is waiting on someone.
  const stale=t.propertyVersion!==ctx.propertyVersion||t.identityRevision!==ctx.identityRevision;
  const steps=(rows:[string,string,SetupStep['state'],(string|undefined)?][]):SetupStep[]=>rows.map(([key,label,state,detail])=>({key,label,state,detail:detail??''}));
  const moveIn=`Move-in ${shortDate(startDate)}`;
  if(!ctx.eligible)return {...none,...base,state:'not_eligible',headerTitle:'Tenancy setup',chip:{label:'On hold',tone:'warning'},facts,cancel,cancelStyle:'link'};
  if(stale){
    return owner
      ?{...none,...base,state:'property_changed',headerTitle:'Tenancy setup',chip:{label:'Property changed',tone:'warning'},facts,prompt:{tone:'warning',title:'The property was edited after you proposed',text:'Review the update, then send the terms again.'},main:actions.includes('review')?{action:'review',label:'Review updated property',tone:'warning',disabled:false}:null,cancel,cancelStyle:'link'}
      :{...none,...base,state:'property_changed',headerTitle:'Tenancy setup',chip:{label:'Property changed',tone:'warning'},facts,prompt:{tone:'warning',title:`The property was edited after ${names.owner} proposed`,text:`Waiting for ${names.owner} to review the update. Nothing to do now.`},cancel,cancelStyle:'link',message};
  }
  if(t.ownerConfirmed&&t.tenantConfirmed){
    const reached=startDate<=today,start:SetupMain=reached&&actions.includes('activate')?{action:'activate',label:'Start stay',tone:'primary',disabled:false}:{action:null,label:`Start stay · available ${shortDate(startDate)}`,tone:'primary',disabled:true};
    const stepRows=steps([['sent','Terms sent','done'],['owner',owner?'You confirmed':`${names.owner} confirmed`,'done'],['renter',owner?`${names.renter} confirmed`:'You confirmed','done'],['move','Move-in',reached?'done':'current',reached?undefined:`${shortDate(startDate)} · ${inDays(startDate,Date.parse(ctx.serverNow))}`]]);
    return {...none,...base,state:reached?'start_now':'ready',headerTitle:'Tenancy setup',chip:reached?{label:'Ready to start',tone:'info'}:{label:`Ready · starts ${inDays(startDate,Date.parse(ctx.serverNow))}`,tone:'info'},facts,steps:stepRows,main:start,cancel,cancelStyle:'link'};
  }
  if(owner){
    return {...none,...base,state:'owner_waiting',headerTitle:'Tenancy setup',chip:{label:`Waiting for ${names.renter}`,tone:'warning'},facts,steps:steps([['sent','Terms sent','done'],['owner','You confirmed','done'],['renter',`${names.renter} confirms`,'current','Waiting. Check back or message them'],['move',moveIn,'upcoming']]),message,cancel,cancelStyle:'link'};
  }
  return {...none,...base,state:'renter_confirms',headerTitle:'Tenancy setup',chip:{label:'Needs your OK',tone:'warning'},prompt:{tone:'warning',title:null,text:`${names.owner} sent these terms. Check them, then confirm.`},facts,steps:steps([['sent','Terms sent','done',`${names.owner} proposed them`],['renter','You confirm','current','Your turn'],['move',moveIn,'upcoming']]),main:actions.includes('confirm')?{action:'confirm',label:'Confirm terms',tone:'warning',disabled:false}:null,message,cancel,cancelStyle:'button'};
}
const ordinalDay=(n:number):string=>{const v=n%100;return `${n}${v>=11&&v<=13?'th':['th','st','nd','rd'][n%10]??'th'}`;};

/** The fixed wording of the "How this works" row, in plain words. */
export const HOW_IT_WORKS=[
  'A reservation holds the place. A tenancy starts only when you both agree to the terms.',
  'The owner sends the terms: monthly rent and the day rent is due. The dates come from the reservation.',
  'The renter checks the terms and confirms. The stay can start on or after the move-in date.',
  'RentLease does not take payments. Rent is tracked by what each person records.',
] as const;
export const CANCEL_SHEET={
  title:'Cancel this setup?',
  body:'This cancels the setup for both of you. The reservation stays held until it is released.',
  confirm:'Cancel setup',keep:'Keep it',
} as const;
export const UNCERTAIN_COPY={title:'We could not confirm it went through',text:'Your connection may have dropped. Nothing was lost.',retry:'Try again',check:'Check status'} as const;
