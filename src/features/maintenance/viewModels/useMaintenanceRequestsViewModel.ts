import { useMemo, useState } from 'react';

import {
  emptyMaintenanceDraft,
  initialMaintenanceSchedule,
  previewMaintenanceRequests,
  type MaintenanceActor,
  type MaintenanceDraft,
  type MaintenancePriority,
  type MaintenanceRequestPreview,
  type MaintenanceSchedule,
  type MaintenanceScreen,
  type MaintenanceStatus,
} from '../models/MaintenanceRequest';

export function useMaintenanceRequestsViewModel(actor: MaintenanceActor) {
  const [screen, setScreen] = useState<MaintenanceScreen>('requests');
  const [history, setHistory] = useState<MaintenanceScreen[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequestPreview[]>(previewMaintenanceRequests);
  const [selectedRequestId, setSelectedRequestId] = useState(
    previewMaintenanceRequests[0]?.id ?? '',
  );
  const [draft, setDraft] = useState<MaintenanceDraft>(emptyMaintenanceDraft);
  const [schedule, setSchedule] = useState<MaintenanceSchedule>(initialMaintenanceSchedule);
  const [moreInformation, setMoreInformation] = useState('');
  const [resolutionNote, setResolutionNote] = useState('Replaced the damaged P-trap and tested the sink for leaks.');
  const [reopenReason, setReopenReason] = useState('The leak returned after the sink was used again.');
  const [rejectionReason, setRejectionReason] = useState('The issue appears to be caused by an unapproved fixture modification.');
  const [disputeText, setDisputeText] = useState('I did not modify the fixture. Please review the attached move-in inspection photos.');
  const [notice, setNotice] = useState<string | null>(null);

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) ?? requests[0];

  const openCount = useMemo(
    () => requests.filter((request) => request.status !== 'Resolved' && request.status !== 'Rejected').length,
    [requests],
  );

  const navigate = (next: MaintenanceScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(next);
    setNotice(null);
  };

  const replace = (next: MaintenanceScreen) => {
    setScreen(next);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'requests';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const openRequests = () => {
    setScreen('requests');
    setHistory([]);
    setNotice(null);
  };

  const startRequest = () => {
    setDraft(emptyMaintenanceDraft);
    navigate('create');
  };

  const openRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
    setScreen(actor === 'landlord' ? 'landlordDetails' : 'requestDetails');
    setHistory(['requests']);
    setNotice(null);
  };

  const updateDraft = <TField extends keyof MaintenanceDraft>(
    field: TField,
    value: MaintenanceDraft[TField],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const choosePriority = (priority: MaintenancePriority) =>
    setDraft((current) => ({ ...current, priority }));

  const addPhotoPreview = () =>
    setDraft((current) => ({ ...current, photoCount: Math.min(3, current.photoCount + 1) }));

  const removePhotoPreview = () =>
    setDraft((current) => ({ ...current, photoCount: Math.max(0, current.photoCount - 1) }));

  const canReview = draft.title.trim().length > 2 && draft.description.trim().length > 9;

  const submitRequest = () => {
    const request: MaintenanceRequestPreview = {
      ...draft,
      id: `maintenance-local-${Date.now()}`,
      propertyTitle: '2-Bedroom House with Balcony',
      propertyAddress: 'Brgy. Alapan II-B, Imus, Cavite',
      unitCode: 'UC-06',
      createdAt: 'Today · Just now',
      updatedAt: 'Today · Just now',
      status: 'Submitted',
      tenantName: 'Maria Santos',
    };
    setRequests((current) => [request, ...current]);
    setSelectedRequestId(request.id);
    setScreen('submitted');
    setNotice(null);
  };

  const updateSelectedStatus = (status: MaintenanceStatus) => {
    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequestId
          ? { ...request, status, updatedAt: 'Today · Just now' }
          : request,
      ),
    );
  };

  const acknowledge = () => {
    updateSelectedStatus('Acknowledged');
    replace('acknowledge');
  };

  const requestInformation = () => {
    updateSelectedStatus('More information needed');
    replace('tenantAddInfo');
  };

  const submitAdditionalInformation = () => {
    updateSelectedStatus('Acknowledged');
    replace('submittedStatus');
    setNotice('Additional information added locally. No backend update was sent.');
  };

  const scheduleRepair = () => {
    updateSelectedStatus('Scheduled');
    replace('scheduled');
  };

  const startWork = () => {
    updateSelectedStatus('In progress');
    replace('inProgress');
  };

  const markResolved = () => {
    updateSelectedStatus('Awaiting tenant confirmation');
    replace('resolutionPending');
  };

  const confirmResolution = () => {
    updateSelectedStatus('Resolved');
    replace('confirmResolution');
  };

  const reopenRequest = () => {
    updateSelectedStatus('Reopened');
    replace('reopen');
  };

  const rejectRequest = () => {
    updateSelectedStatus('Rejected');
    replace('rejectionResponse');
  };

  const acceptRejection = () => {
    updateSelectedStatus('Rejected');
    replace('rejectionResponse');
    setNotice('Rejection accepted in this local preview.');
  };

  const disputeRejection = () => {
    updateSelectedStatus('Disputed');
    replace('rejectionResponse');
    setNotice('Dispute saved locally. No notification was sent.');
  };

  return {
    backFromWorkspace: (onClose: () => void) => { if (screen === 'requests' || screen === 'empty') onClose(); else goBack(); },
    actor,
    screen,
    requests,
    selectedRequest,
    openCount,
    draft,
    schedule,
    moreInformation,
    resolutionNote,
    reopenReason,
    rejectionReason,
    disputeText,
    notice,
    navigate,
    replace,
    goBack,
    openRequests,
    startRequest,
    openRequest,
    updateDraft,
    choosePriority,
    addPhotoPreview,
    removePhotoPreview,
    canReview,
    submitRequest,
    acknowledge,
    requestInformation,
    submitAdditionalInformation,
    scheduleRepair,
    startWork,
    markResolved,
    confirmResolution,
    reopenRequest,
    rejectRequest,
    acceptRejection,
    disputeRejection,
    setSchedule,
    setMoreInformation,
    setResolutionNote,
    setReopenReason,
    setRejectionReason,
    setDisputeText,
    setNotice,
  };
}

export type MaintenanceRequestsViewModel = ReturnType<typeof useMaintenanceRequestsViewModel>;
