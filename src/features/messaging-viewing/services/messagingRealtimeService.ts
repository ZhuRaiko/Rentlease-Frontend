import type {SupabaseClient,RealtimeChannel} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {isUuid} from '../models/PersistentMessaging';
export type MessagingConnection='connecting'|'connected'|'unavailable';
export function createMessagingRealtimeService(getClient:()=>SupabaseClient<Database>){
 return{watch(owner:string,conversationId:string|null,onChange:()=>void,onStatus:(status:MessagingConnection)=>void,onAccountChanged:()=>void){
  let stopped=false,channel:RealtimeChannel|null=null,authStop=()=>{};
  const client=getClient();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);controller.abort();if(channel)void client.removeChannel(channel);authStop();};
  const auth=client.auth.onAuthStateChange((_event,session)=>{if(stopped)return;if(!session||session.user.id!==owner){stop();onAccountChanged();}});
  authStop=()=>auth.data.subscription.unsubscribe();if(stopped)authStop();
  void (async()=>{
   try{
    onStatus('connecting');const {data,error}=await client.auth.getUser();if(stopped)return;if(error||data.user?.id!==owner){stop();onAccountChanged();return;}
    // Publication membership alone does not authorize Postgres Changes.
    const checks=await Promise.all([
     client.from('messages').select('id,conversation_id').limit(0).abortSignal(controller.signal),
     client.from('conversations').select('id,tenant_id,landlord_id').limit(0).abortSignal(controller.signal),
    ]);
    clearTimeout(timer);if(stopped)return;if(checks.some(r=>r.error)){onStatus('unavailable');return;}
    if(!isUuid(owner)||(conversationId!==null&&!isUuid(conversationId))){onStatus('unavailable');return;}
    channel=client.channel(`inquiry:${owner}:${conversationId??'inbox'}`);
    for(const participant of ['tenant_id','landlord_id'] as const)for(const event of ['INSERT','UPDATE'] as const){
     channel.on('postgres_changes',{event,schema:'public',table:'conversations',filter:`${participant}=eq.${owner}`,select:['id','tenant_id','landlord_id']},payload=>{
      const row=payload.new;if(!stopped&&(('tenant_id' in row&&row.tenant_id===owner)||('landlord_id' in row&&row.landlord_id===owner)))onChange();
     });
    }
    if(conversationId)for(const event of ['INSERT','UPDATE'] as const)channel.on('postgres_changes',{event,schema:'public',table:'messages',filter:`conversation_id=eq.${conversationId}`,select:['id','conversation_id']},payload=>{if(!stopped&&'conversation_id' in payload.new&&payload.new.conversation_id===conversationId)onChange();});
    channel.subscribe(status=>{if(stopped)return;if(status==='SUBSCRIBED'){onStatus('connected');onChange();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')onStatus('unavailable');});
   }catch{if(!stopped)onStatus('unavailable');}finally{clearTimeout(timer);}
  })();
  return stop;
 }};
}
