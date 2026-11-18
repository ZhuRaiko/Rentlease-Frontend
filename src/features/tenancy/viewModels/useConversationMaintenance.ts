import {useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {createTenancyCareService} from '../services/tenancyCareService';
import {maintenanceStrip, type MaintenanceStrip} from '../models/ConversationMaintenance';

const service = createTenancyCareService(getSupabaseClient);

/**
 * The maintenance strip of one chat: one read of get_tenancy_care when the thread opens and again when the app returns to the foreground. No
 * live updates. A result for another account or tenancy, or one that arrives after the screen closed, is dropped. A failed read leaves the last
 * strip (or none): the chat itself never waits for it.
 */
export function useConversationMaintenance(accountId: string | undefined, tenancyId: string): MaintenanceStrip | null {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{key: string; strip: MaintenanceStrip} | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', status => { if (status === 'active') setRevision(v => v + 1); });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!accountId) return;
    const key = accountId + ':' + tenancyId, controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    let live = true;
    void service.read(accountId, tenancyId, 0, controller.signal).then(care => { if (live && !controller.signal.aborted) setState({key, strip: maintenanceStrip(care)}); }).catch(() => undefined);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [accountId, tenancyId, revision]);
  return state && state.key === accountId + ':' + tenancyId ? state.strip : null;
}
