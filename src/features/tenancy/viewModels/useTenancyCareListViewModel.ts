import {useEffect,useMemo,useState} from 'react';
import {AppState} from 'react-native';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyCareService} from '../services/tenancyCareService';
import type {RentalRelationship} from '../models/TenancyWorkspace';
const service=createTenancyCareService(getSupabaseClient);
export function useTenancyCareListViewModel(actor:string|undefined){const owner=useMemo(()=>({actor}),[actor]),[state,setState]=useState({owner,rows:[] as RentalRelationship[],busy:true,error:null as string|null}),[version,setVersion]=useState(0);
 useEffect(()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);let live=true;setState({owner,rows:[],busy:true,error:null});if(actor)void service.list(actor,c.signal).then(rows=>{if(live&&!c.signal.aborted)setState({owner,rows,busy:false,error:null});}).catch(()=>{if(live)setState({owner,rows:[],busy:false,error:'Your rental relationships could not load. Retry.'});});else setState({owner,rows:[],busy:false,error:'Sign in to view maintenance.'});const sub=AppState.addEventListener('change',s=>{if(s==='active')setVersion(v=>v+1);});return()=>{live=false;c.abort();clearTimeout(timer);sub.remove();};},[owner,version]);return{...(state.owner===owner?state:{owner,rows:[],busy:true,error:null}),refresh:()=>setVersion(v=>v+1)};}
