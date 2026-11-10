import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
import {publicIdentityService,publicIdentityChanges} from '../services/publicIdentityService';
import type {PublicIdentity} from '../models/PublicIdentity';
/** Account/item-scoped batched optional presentation; failures always use neutral labels. */
export function usePublicIdentitiesViewModel(owner:string|undefined,ids:readonly string[]){
 const key=[...new Set(ids)].sort().join(','),[revision,setRevision]=useState(0),[state,setState]=useState<{owner:string;key:string;rows:PublicIdentity[]}|null>(null);
 useEffect(()=>{const changed=()=>setRevision(v=>v+1),stop=publicIdentityChanges.subscribe(changed),sub=AppState.addEventListener('change',s=>{if(s==='active')changed();});return()=>{stop();sub.remove();};},[]);
 useEffect(()=>{const c=new AbortController();let active=true;setState(null);if(owner&&key){const values=key.split(','),batches=[];for(let at=0;at<values.length;at+=50)batches.push(values.slice(at,at+50));void Promise.all(batches.map(batch=>publicIdentityService.read(owner,batch,c.signal))).then(rows=>{if(active)setState({owner,key,rows:rows.flat()});}).catch(()=>{if(active)setState(null);});}return()=>{active=false;c.abort();};},[owner,key,revision]);
 return state&&state.owner===owner&&state.key===key?Object.fromEntries(state.rows.map(row=>[row.id,row])) as Record<string,PublicIdentity>:{};
}
