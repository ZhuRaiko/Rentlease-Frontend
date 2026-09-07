import { useState } from 'react';

import {
  initialVerificationDraft,
  type GovernmentIdType,
  type OwnershipDocumentType,
  type VerificationActor,
  type VerificationDraft,
  type VerificationScreen,
  type VerificationStatus,
  type VerificationTier,
} from '../models/Verification';

interface TierStatuses {
  1: VerificationStatus;
  2: VerificationStatus;
  3: VerificationStatus;
}

export function useUserVerificationViewModel(
  initialActor: VerificationActor,
  onLandlordVerified?: () => void,
) {
  const [actor, setActorState] = useState<VerificationActor>(initialActor);
  const [screen, setScreen] = useState<VerificationScreen>('overview');
  const [history, setHistory] = useState<VerificationScreen[]>([]);
  const [draft, setDraft] = useState<VerificationDraft>(initialVerificationDraft);
  const [statuses, setStatuses] = useState<TierStatuses>({
    1: 'notStarted',
    2: 'locked',
    3: 'locked',
  });
  const [notice, setNotice] = useState<string | null>(null);

  const navigate = (nextScreen: VerificationScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(nextScreen);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'overview';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const goToOverview = () => {
    setHistory([]);
    setScreen('overview');
    setNotice(null);
  };

  const updateCodeDigit = (field: 'emailCode' | 'mobileCode', index: number, digit: string) => {
    const nextDigit = digit.replace(/\D/g, '').slice(-1);
    setDraft((current) => {
      const digits = current[field].padEnd(4, ' ').slice(0, 4).split('');
      digits[index] = nextDigit || ' ';
      return { ...current, [field]: digits.join('').trimEnd() };
    });
  };

  const startTier = (tier: VerificationTier) => {
    if (tier === 1) {
      setStatuses((current) => ({ ...current, 1: 'inProgress' }));
      navigate('tier1Intro');
      return;
    }
    if (tier === 2 && statuses[1] !== 'approved') {
      setNotice('Complete Tier 1 before starting trusted ID verification.');
      return;
    }
    if (tier === 2) {
      setStatuses((current) => ({ ...current, 2: 'inProgress' }));
      navigate(statuses[2] === 'rejected' ? 'tier2Resubmission' : 'tier2Intro');
      return;
    }
    if (statuses[2] !== 'approved') {
      setNotice('Tier 2 approval is required before starting Tier 3.');
      return;
    }
    setStatuses((current) => ({ ...current, 3: 'inProgress' }));
    navigate('tier3Intro');
  };

  const openTier = (tier: VerificationTier) => {
    const status = statuses[tier];
    if (status === 'pending') {
      navigate(tier === 2 ? 'tier2Pending' : 'tier3Pending');
      return;
    }
    if (status === 'approved') {
      navigate(tier === 1 ? 'tier1Complete' : tier === 2 ? 'tier2Approved' : 'tier3Approved');
      return;
    }
    if (status === 'rejected') {
      navigate(tier === 2 ? 'tier2Rejected' : 'tier3Rejected');
      return;
    }
    startTier(tier);
  };

  const completeTierOne = () => {
    setStatuses((current) => ({ ...current, 1: 'approved', 2: 'notStarted' }));
    navigate('tier1Complete');
  };

  const selectGovernmentId = (governmentIdType: GovernmentIdType) => {
    setDraft((current) => ({ ...current, governmentIdType, tier2FileName: null }));
    navigate('tier2Upload');
  };

  const selectTierTwoDocumentPreview = () => {
    setDraft((current) => ({
      ...current,
      tier2FileName: `${(current.governmentIdType ?? 'government-id').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-front.jpg`,
    }));
    setNotice('Figma sample selected locally. Nothing was uploaded.');
  };

  const submitTierTwoPreview = () => {
    setStatuses((current) => ({ ...current, 2: 'pending' }));
    navigate('tier2Pending');
  };

  const previewTierTwoDecision = (decision: 'approved' | 'rejected') => {
    setStatuses((current) => ({
      ...current,
      2: decision,
      3: decision === 'approved' ? 'notStarted' : 'locked',
    }));
    navigate(decision === 'approved' ? 'tier2Approved' : 'tier2Rejected');
  };

  const startTierTwoResubmission = () => {
    setDraft((current) => ({ ...current, tier2FileName: null }));
    setStatuses((current) => ({ ...current, 2: 'inProgress' }));
    navigate('tier2Resubmission');
  };

  const selectProperty = (propertyId: string) => {
    setDraft((current) => ({ ...current, propertyId }));
    navigate('tier3Document');
  };

  const selectOwnershipDocument = (ownershipDocumentType: OwnershipDocumentType) => {
    setDraft((current) => ({ ...current, ownershipDocumentType, tier3FileName: null }));
  };

  const selectTierThreeDocumentPreview = () => {
    setDraft((current) => ({
      ...current,
      tier3FileName: `${(current.ownershipDocumentType ?? 'ownership-document').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`,
    }));
    setNotice('Figma sample selected locally. Nothing was uploaded.');
  };

  const submitTierThreePreview = () => {
    setStatuses((current) => ({ ...current, 3: 'pending' }));
    navigate('tier3Pending');
  };

  const previewTierThreeDecision = (decision: 'approved' | 'rejected') => {
    setStatuses((current) => ({ ...current, 3: decision }));
    if (decision === 'approved') {
      setActorState('landlord');
      onLandlordVerified?.();
    }
    navigate(decision === 'approved' ? 'tier3Approved' : 'tier3Rejected');
  };

  const startTierThreeResubmission = () => {
    setDraft((current) => ({ ...current, tier3FileName: null }));
    setStatuses((current) => ({ ...current, 3: 'inProgress' }));
    navigate('tier3Document');
    setNotice('Replace the ownership or authorization document before reviewing again.');
  };

  return {
    actor,
    screen,
    draft,
    statuses,
    notice,
    navigate,
    goBack,
    goToOverview,
    setNotice,
    updateCodeDigit,
    startTier,
    openTier,
    completeTierOne,
    selectGovernmentId,
    selectTierTwoDocumentPreview,
    submitTierTwoPreview,
    previewTierTwoDecision,
    startTierTwoResubmission,
    selectProperty,
    selectOwnershipDocument,
    selectTierThreeDocumentPreview,
    submitTierThreePreview,
    previewTierThreeDecision,
    startTierThreeResubmission,
  };
}

export type UserVerificationViewModel = ReturnType<typeof useUserVerificationViewModel>;
