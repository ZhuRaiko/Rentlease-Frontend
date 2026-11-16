import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import {publicIdentityLabel} from '../../../shared/models/PublicIdentity';
import {createTenancyCareService} from '../services/tenancyCareService';
import {createCareJournal} from '../services/tenancyCareJournal';
import {createMaintenanceRequestWorkflow} from './maintenanceRequestWorkflow';
import {createMaintenanceInboxWorkflow} from './maintenanceInboxWorkflow';

const service = createTenancyCareService(getSupabaseClient), journal = createCareJournal(AsyncStorage);

/** One request and its thread. Reloads when the app returns to the foreground. */
export function useMaintenanceRequestViewModel(actor: string | undefined, requestId: string) {
  const workflow = useMemo(() => createMaintenanceRequestWorkflow(service, journal, actor, requestId, randomUUID), [actor, requestId]);
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  useEffect(() => {
    workflow.activate(); void workflow.load();
    const sub = AppState.addEventListener('change', s => {if (s === 'active') void workflow.load();});
    return () => {sub.remove(); workflow.dispose();};
  }, [workflow]);
  return {...state, workflow};
}

/** The landlord's inbox, optionally for one property. */
export function useMaintenanceInboxViewModel(actor: string | undefined, propertyId: string | null) {
  const workflow = useMemo(() => createMaintenanceInboxWorkflow(service, journal, actor, propertyId, randomUUID), [actor, propertyId]);
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  useEffect(() => {
    workflow.activate(); void workflow.load();
    const sub = AppState.addEventListener('change', s => {if (s === 'active') void workflow.load();});
    return () => {sub.remove(); workflow.dispose();};
  }, [workflow]);
  return {...state, workflow};
}

/** Tenant names for a landlord's tenancies, from the tenancy's people (never from inbox rows). A tenancy that is not found, or an identity that does not load, shows the neutral "Renter". */
export function useTenantNames(actor: string | undefined, enabled: boolean) {
  const [tenancies, setTenancies] = useState<{id: string; tenant_id: string}[]>([]);
  useEffect(() => {
    if (!actor || !enabled) return;
    const c = new AbortController();
    let live = true;
    void service.list(actor, c.signal).then(rows => {if (live) setTenancies(rows.map(t => ({id: t.id, tenant_id: t.tenant_id})));}).catch(() => {});
    return () => {live = false; c.abort();};
  }, [actor, enabled]);
  const identities = usePublicIdentitiesViewModel(actor, tenancies.map(t => t.tenant_id));
  return useMemo(() => (tenancyId: string): string => {
    const t = tenancies.find(x => x.id === tenancyId);
    return publicIdentityLabel(t ? identities[t.tenant_id] : undefined, 'renter');
  }, [tenancies, identities]);
}
