/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRealtimeSync} from '../src/features/messaging-viewing/viewModels/realtimeSync';
import {createMessagingRealtimeService} from '../src/features/messaging-viewing/services/messagingRealtimeService';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../src/shared/services/supabase/database.types';
import {readFileSync} from 'node:fs';
const owner='00000000-0000-4000-8000-000000000001',thread='00000000-0000-4000-8000-000000000010';
const tick=()=>new Promise(r=>setImmediate(r));
function harness(denied=false){const registrations:any[]=[],projections:string[]=[];let status!:(s:string)=>void,auth!:(event:string,session:any)=>void,removed=0;
 const channel={on(_type:string,filter:any,callback:any){registrations.push({filter,callback});return channel;},subscribe(callback:any){status=callback;return channel;}};
 const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null}),onAuthStateChange(callback:any){auth=callback;return{data:{subscription:{unsubscribe(){}}}};}},from(){return{select(columns:string){projections.push(columns);return{limit:()=>({abortSignal:async()=>({data:[],error:denied?{code:'42501'}:null})})};}};},channel:()=>channel,removeChannel:async()=>{removed++;}} as unknown as SupabaseClient<Database>;
 return{service:createMessagingRealtimeService(()=>client),registrations,projections,status:(value:string)=>status(value),auth:(session:any)=>auth('SIGNED_OUT',session),removed:()=>removed};
}
test('events coalesce while busy, then catch up without losing a notification',async()=>{
 let calls=0,release!:()=>void;const sync=createRealtimeSync(async()=>{calls++;if(calls===1)await new Promise<void>(r=>release=r);});
 sync.request();sync.request();sync.request();assert.equal(calls,1);release();await new Promise(r=>setImmediate(r));assert.equal(calls,2);sync.stop();sync.request();assert.equal(calls,2);
});
test('subscriptions filter every stream and request metadata only; socket reconnect requests catch-up',async()=>{
 const h=harness();let changes=0;const states:string[]=[];const stop=h.service.watch(owner,thread,()=>changes++,s=>states.push(s),()=>{});await tick();assert.equal(h.registrations.length,6);for(const r of h.registrations){assert.ok(r.filter.filter.includes('=eq.'));assert.doesNotMatch(r.filter.select.join(','),/body|sender|attachment/);}h.status('SUBSCRIBED');assert.equal(states.at(-1),'connected');assert.equal(changes,1);h.registrations.at(-1).callback({new:{conversation_id:thread}});assert.equal(changes,2);h.registrations.at(-1).callback({new:{conversation_id:owner}});assert.equal(changes,2);h.status('CHANNEL_ERROR');h.status('SUBSCRIBED');assert.equal(changes,3);stop();h.registrations.at(-1).callback({new:{conversation_id:thread}});assert.equal(changes,3);assert.equal(h.removed(),1);
});
test('missing grants fail visibly before subscribing; no unfiltered fallback is created',async()=>{const h=harness(true);const states:string[]=[];const stop=h.service.watch(owner,thread,()=>{},s=>states.push(s),()=>{});await tick();assert.equal(states.at(-1),'unavailable');assert.equal(h.registrations.length,0);stop();});
test('sign-out closes the channel and invalidates the old private workspace',async()=>{const h=harness();let revoked=0,changes=0;h.service.watch(owner,thread,()=>changes++,()=>{},()=>revoked++);await tick();h.auth(null);assert.equal(h.removed(),1);assert.equal(revoked,1);h.registrations.at(-1).callback({new:{conversation_id:thread}});assert.equal(changes,0);});
test('inbox listens only to participant conversation changes; no global message stream or polling loop',async()=>{const h=harness();const stop=h.service.watch(owner,null,()=>{},()=>{},()=>{});await tick();assert.equal(h.registrations.length,4);assert.ok(h.registrations.every(r=>r.filter.table==='conversations'));const hook=readFileSync('src/features/messaging-viewing/viewModels/useMessagingViewingViewModel.ts','utf8');assert.doesNotMatch(hook,/setInterval|15000/);assert.match(hook,/AppState.addEventListener/);assert.match(hook,/controller.abort\(\)/);stop();});
