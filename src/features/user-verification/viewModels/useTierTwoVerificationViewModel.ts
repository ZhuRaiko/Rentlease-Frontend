import { needsVerificationRecovery } from '../../../shared/models/verificationPresentation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { selectLocalDocument } from '../../../shared/services/documents/documentPickerService';
import { getSupabaseClient } from '../../../shared/services/supabase/client';
import { uploadVerificationDocument } from '../../../shared/services/supabase/storage/verificationDocumentStorageService';
import { createTierTwoVerificationService } from '../services/tierTwoVerificationService';
import { createTierTwoVerificationWorkflow } from './tierTwoVerificationWorkflow';

export function useTierTwoVerificationViewModel() {
  const [workflow] = useState(() => createTierTwoVerificationWorkflow({
    service: createTierTwoVerificationService(getSupabaseClient),
    selectDocument: selectLocalDocument,
    uploadDocument: uploadVerificationDocument,
  }));
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot);
  useEffect(() => {
    workflow.activate();
    void workflow.refresh();
    return () => workflow.dispose();
  }, [workflow]);
  const backScreens = {
    overview: 'overview', tier2Intro: 'overview', tier2IdType: 'tier2Intro',
    tier2Upload: 'tier2IdType', tier2Review: 'tier2Upload', tier2Status: 'overview',
  } as const;
  const goBack = () => {
    const current = workflow.getSnapshot();
    workflow.navigate(current.editingApplication && current.screen === 'tier2IdType' ? 'tier2Status' : backScreens[current.screen]);
  };
  return { ...state, ...workflow, showRecovery: needsVerificationRecovery(state), goBack, canStartRecovery: workflow.canStartRecovery(), canSubmit: workflow.canSubmit(), busy: state.isLoading || state.isSelectingDocument || state.isSubmitting };
}

export type TierTwoVerificationViewModel = ReturnType<typeof useTierTwoVerificationViewModel>;
