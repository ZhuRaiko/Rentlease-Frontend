import { useMemo, useState } from 'react';

import {
  initialViewingProposal,
  previewConversations,
  previewMessages,
  type ChatMessage,
  type MessagingActor,
  type MessagingViewingScreen,
  type ViewingProposalDraft,
  type ViewingStatus,
} from '../models/MessagingViewing';

function proposalMessage(proposal: ViewingProposalDraft) {
  return `Viewing proposed for ${proposal.date} at ${proposal.time}`;
}

export function useMessagingViewingViewModel(
  actor: MessagingActor,
  initialScreen: 'inbox' | 'newInquiry' = 'inbox',
) {
  const [screen, setScreen] = useState<MessagingViewingScreen>(initialScreen);
  const [history, setHistory] = useState<MessagingViewingScreen[]>(
    initialScreen === 'newInquiry' ? ['inbox'] : [],
  );
  const [selectedConversationId, setSelectedConversationId] = useState(
    previewConversations[0]?.id ?? '',
  );
  const [messages, setMessages] = useState<ChatMessage[]>(previewMessages);
  const [composerText, setComposerText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ViewingProposalDraft>(initialViewingProposal);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedConversation =
    previewConversations.find((item) => item.id === selectedConversationId) ??
    previewConversations[0];

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query) return previewConversations;
    return previewConversations.filter(
      (item) =>
        item.participantName.toLocaleLowerCase().includes(query) ||
        item.listingTitle.toLocaleLowerCase().includes(query),
    );
  }, [searchText]);

  const navigate = (next: MessagingViewingScreen) => {
    setHistory((current) => [...current, screen]);
    setScreen(next);
    setNotice(null);
  };

  const replace = (next: MessagingViewingScreen) => {
    setScreen(next);
    setNotice(null);
  };

  const goBack = () => {
    setHistory((current) => {
      const previous = current.at(-1) ?? 'inbox';
      setScreen(previous);
      return current.slice(0, -1);
    });
    setNotice(null);
  };

  const openInbox = () => {
    setScreen('inbox');
    setHistory([]);
    setNotice(null);
  };

  const openConversation = (conversationId: string) => {
    const conversation = previewConversations.find((item) => item.id === conversationId);
    setSelectedConversationId(conversationId);
    setScreen(conversation?.available === false ? 'listingUnavailable' : 'conversation');
    setHistory(['inbox']);
    setNotice(null);
  };

  const startInquiry = () => navigate('newInquiry');

  const submitInquiry = () => {
    const body = composerText.trim() || 'Hi! Is this property still available for viewing?';
    setMessages([
      {
        id: `inquiry-${Date.now()}`,
        body,
        sentAt: 'Now',
        direction: 'outgoing',
        delivery: 'sent',
        kind: 'text',
      },
    ]);
    setComposerText('');
    setSelectedConversationId(previewConversations[0]?.id ?? '');
    setScreen('conversation');
    setHistory(['inbox']);
    setNotice('Inquiry added locally. No message was sent to Supabase.');
  };

  const sendMessage = () => {
    const body = composerText.trim();
    if (!body) return;
    setMessages((current) => [
      ...current,
      {
        id: `message-${Date.now()}`,
        body,
        sentAt: 'Now',
        direction: 'outgoing',
        delivery: 'sent',
        kind: 'text',
      },
    ]);
    setComposerText('');
    setNotice('Message added to this frontend preview only.');
  };

  const chooseAttachment = (name: string) => {
    setAttachmentName(name);
    setMessages((current) => [
      ...current,
      {
        id: `attachment-${Date.now()}`,
        body: name,
        sentAt: 'Now',
        direction: 'outgoing',
        delivery: 'sent',
        kind: 'attachment',
      },
    ]);
    replace('conversation');
    setNotice('Attachment preview added locally; no file was uploaded.');
  };

  const beginViewingProposal = () => {
    setProposal(initialViewingProposal);
    navigate('proposeViewing');
  };

  const selectDate = (date: string) => setProposal((current) => ({ ...current, date }));
  const selectTime = (time: string) => setProposal((current) => ({ ...current, time }));
  const setProposalNote = (note: string) => setProposal((current) => ({ ...current, note }));

  const updateProposalStatus = (status: ViewingStatus) =>
    setProposal((current) => ({ ...current, status }));

  const submitProposal = () => {
    const pendingProposal = { ...proposal, status: 'pending' as const };
    setProposal(pendingProposal);
    setMessages((current) => [
      ...current,
      {
        id: `viewing-${Date.now()}`,
        body: proposalMessage(pendingProposal),
        sentAt: 'Now',
        direction: 'outgoing',
        delivery: 'sent',
        kind: 'viewing',
      },
    ]);
    replace('proposalPending');
  };

  const acceptProposal = () => {
    updateProposalStatus('accepted');
    replace('proposalAccepted');
  };

  const declineProposal = () => {
    updateProposalStatus('declined');
    replace('proposalDeclined');
  };

  const counterProposal = () => {
    updateProposalStatus('countered');
    replace('counterProposal');
  };

  const submitCounterProposal = () => {
    updateProposalStatus('pending');
    replace('proposalPending');
    setNotice('Counter-proposal saved locally and marked pending.');
  };

  const cancelViewing = () => {
    updateProposalStatus('cancelled');
    replace('viewingCancelled');
  };

  const completeViewing = () => {
    updateProposalStatus('completed');
    replace('viewingCompleted');
  };

  return {
    backFromWorkspace: (onClose: () => void) => { if (screen === 'inbox' || screen === 'emptyInbox') onClose(); else goBack(); },
    actor,
    screen,
    selectedConversation,
    filteredConversations,
    messages,
    composerText,
    searchText,
    attachmentName,
    proposal,
    notice,
    navigate,
    replace,
    goBack,
    openInbox,
    openConversation,
    startInquiry,
    submitInquiry,
    sendMessage,
    chooseAttachment,
    beginViewingProposal,
    selectDate,
    selectTime,
    setProposalNote,
    submitProposal,
    acceptProposal,
    declineProposal,
    counterProposal,
    submitCounterProposal,
    cancelViewing,
    completeViewing,
    setComposerText,
    setSearchText,
    setNotice,
  };
}

export type MessagingViewingViewModel = ReturnType<typeof useMessagingViewingViewModel>;
