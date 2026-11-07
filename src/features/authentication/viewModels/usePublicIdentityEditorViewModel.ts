import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {randomUUID} from 'expo-crypto';
import {publicIdentityService} from '../../../shared/services/publicIdentityService';
import {publicIdentityMedia} from '../services/publicIdentityMedia';
import {createPublicIdentityWorkflow} from './publicIdentityWorkflow';
export function usePublicIdentityEditorViewModel(owner:string){const workflow=useMemo(()=>createPublicIdentityWorkflow(owner,publicIdentityService,publicIdentityMedia,randomUUID),[owner]),state=useSyncExternalStore(workflow.subscribe,workflow.getSnapshot,workflow.getSnapshot);useEffect(()=>{workflow.activate();void workflow.load();return()=>workflow.dispose();},[workflow]);return{...state,workflow,...workflow.info()};}
