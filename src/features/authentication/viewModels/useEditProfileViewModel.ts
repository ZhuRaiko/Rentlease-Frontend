import {useEffect,useRef} from 'react';
import type {AuthProfilesViewModel} from './useAuthProfilesViewModel';
import {usePublicIdentityEditorViewModel} from './usePublicIdentityEditorViewModel';

/** One save action; separate receipts remain honest if preferences fail after identity saves. */
export function useEditProfileViewModel(account:AuthProfilesViewModel){
 const owner=account.account?.user.id;
 const identity=usePublicIdentityEditorViewModel(owner??'');
 const saving=useRef(false),alive=useRef(true),currentOwner=useRef(owner);
 currentOwner.current=owner;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const busy=identity.busy||account.asyncState==='loading';
 const publicChanged=identity.changed||identity.uncertain;
 const publicReady=!!identity.baseline&&!identity.loading&&(identity.uncertain||(identity.valid&&(!identity.consent||identity.confirmed)));
 const canSave=!busy&&(publicChanged?publicReady:account.canSaveProfile)&&(publicChanged||account.canSaveProfile);
 const save=async()=>{
  if(!canSave||saving.current||!owner)return;
  saving.current=true;
  try{
   if(publicChanged){
    await identity.workflow.save();
    if(!alive.current||currentOwner.current!==owner)return;
    const state=identity.workflow.getSnapshot();
    if(!state.baseline||state.baseline.id!==owner||state.error||state.uncertain||identity.workflow.info().changed)return;
   }
   if(alive.current&&currentOwner.current===owner&&account.canSaveProfile)await account.saveProfile();
  }finally{saving.current=false;}
 };
 return{identity,busy,canSave,save};
}
