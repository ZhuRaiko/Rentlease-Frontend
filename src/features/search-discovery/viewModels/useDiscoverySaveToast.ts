import {useEffect,useState} from 'react';
import type {createSavedListingsWorkflow} from './savedListingsWorkflow';
/** Listen only for new confirmed writes; old notices never replay on navigation. */
export function useDiscoverySaveToast(workflow:ReturnType<typeof createSavedListingsWorkflow>,owner:string|undefined,visible:boolean){
 const [toast,setToast]=useState<{owner:string|undefined;message:string}|null>(null);
 useEffect(()=>{
  setToast(null);let timer:ReturnType<typeof setTimeout>|undefined;
  let seen=workflow.getSnapshot().noticeId;
  const stop=workflow.subscribe(()=>{const s=workflow.getSnapshot();if(s.noticeId===seen)return;seen=s.noticeId;if(!visible||!s.notice||s.error||s.pending)return;
   if(timer)clearTimeout(timer);setToast({owner,message:s.notice});workflow.clearNotice();timer=setTimeout(()=>setToast(null),3500);
  });
  return()=>{stop();if(timer)clearTimeout(timer);};
 },[workflow,owner,visible]);
 return visible&&toast?.owner===owner?toast?.message??null:null;
}
