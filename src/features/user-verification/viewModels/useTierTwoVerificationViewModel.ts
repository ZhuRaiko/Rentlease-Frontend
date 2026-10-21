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
  const goBack = () => workflow.navigate(backScreens[workflow.getSnapshot().screen]);
  return { ...state, ...workflow, goBack, canSubmit: workflow.canSubmit(), busy: state.isLoading || state.isSelectingDocument || state.isSubmitting };
}

export type TierTwoVerificationViewModel = ReturnType<typeof useTierTwoVerificationViewModel>;
