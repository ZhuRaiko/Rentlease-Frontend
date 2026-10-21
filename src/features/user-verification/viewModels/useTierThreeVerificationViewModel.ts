import { needsVerificationRecovery } from '../../../shared/models/verificationPresentation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { selectLocalDocument } from '../../../shared/services/documents/documentPickerService';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { uploadVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import { createTierThreeVerificationService } from '../services/tierThreeVerificationService';
import { createTierThreeVerificationWorkflow } from './tierThreeVerificationWorkflow';

export function useTierThreeVerificationViewModel(enabled: boolean) {
  const [workflow] = useState(() => createTierThreeVerificationWorkflow({ service: createTierThreeVerificationService(getSupabaseClient), selectDocument: selectLocalDocument, uploadDocument: uploadVerificationDocument }));
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot);
  useEffect(() => {
    workflow.activate();
    return () => workflow.dispose();
  }, [workflow]);
  useEffect(() => { void workflow.setEnabled(enabled); }, [workflow, enabled]);
  return { ...state, ...workflow, showRecovery: needsVerificationRecovery(state), canSubmit: workflow.canSubmit(), busy: state.isLoading || state.isSelectingDocument || state.isSubmitting };
}
export type TierThreeVerificationViewModel = ReturnType<typeof useTierThreeVerificationViewModel>;
