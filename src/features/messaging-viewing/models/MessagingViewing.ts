export type MessagingActor = 'tenant' | 'landlord';

export type MessagingViewingScreen =
  | 'inbox'
  | 'emptyInbox'
  | 'conversation'
  | 'newInquiry'
  | 'attachment'
  | 'proposeViewing'
  | 'selectDate'
  | 'selectTime'
  | 'reviewProposal'
  | 'proposalPending'
  | 'proposalAccepted'
  | 'proposalDeclined'
  | 'counterProposal'
  | 'viewingDetails'
  | 'upcomingViewing'
  | 'cancelViewing'
  | 'viewingCancelled'
  | 'viewingCompleted'
  | 'listingUnavailable';

export type ViewingStatus =
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'countered'
  | 'cancelled'
  | 'completed';

export interface ConversationPreview {
  id: string;
  participantName: string;
  participantRole: string;
  listingTitle: string;
  listingAddress: string;
  listingRent: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  online: boolean;
  available: boolean;
}

export interface ChatMessage {
  id: string;
  body: string;
  sentAt: string;
  direction: 'incoming' | 'outgoing';
  delivery: 'sent' | 'read';
  kind: 'text' | 'attachment' | 'viewing';
}

export interface ViewingProposalDraft {
  date: string;
  time: string;
  note: string;
  status: ViewingStatus;
}

export const viewingDates = [
  { day: '20', weekday: 'Sun', full: 'Sunday, September 20, 2026' },
  { day: '21', weekday: 'Mon', full: 'Monday, September 21, 2026' },
  { day: '22', weekday: 'Tue', full: 'Tuesday, September 22, 2026' },
  { day: '23', weekday: 'Wed', full: 'Wednesday, September 23, 2026' },
] as const;

export const viewingTimes = [
  '9:00 AM',
  '10:30 AM',
  '1:00 PM',
  '2:30 PM',
  '4:00 PM',
  '5:30 PM',
] as const;

export const previewConversations: ConversationPreview[] = [
  {
    id: 'conversation-imus-house',
    participantName: 'Samuel Feliciano',
    participantRole: 'Tier 3 Verified Landlord',
    listingTitle: '2-Bedroom House with Balcony',
    listingAddress: 'Brgy. Alapan II-B, Imus, Cavite',
    listingRent: '₱60,800 / month',
    lastMessage: 'Sunday at 10:30 AM works for me.',
    timestamp: '3:02 PM',
    unreadCount: 2,
    online: true,
    available: true,
  },
  {
    id: 'conversation-dasma-studio',
    participantName: 'Juan Dela Cruz',
    participantRole: 'Verified Tenant',
    listingTitle: 'Studio Unit near DLSU-D',
    listingAddress: 'Dasmariñas City, Cavite',
    listingRent: '₱18,500 / month',
    lastMessage: 'Is the unit still available next month?',
    timestamp: 'Yesterday',
    unreadCount: 0,
    online: false,
    available: true,
  },
  {
    id: 'conversation-tagaytay-condo',
    participantName: 'Andrea Santos',
    participantRole: 'Tenant',
    listingTitle: 'Furnished Condo with Ridge View',
    listingAddress: 'Tagaytay City, Cavite',
    listingRent: '₱32,000 / month',
    lastMessage: 'This listing is no longer available.',
    timestamp: 'Aug 30',
    unreadCount: 0,
    online: false,
    available: false,
  },
];

export const previewMessages: ChatMessage[] = [
  {
    id: 'message-1',
    body: 'Hi! I am interested in the 2-bedroom house in Imus. Is it still available?',
    sentAt: '2:41 PM',
    direction: 'outgoing',
    delivery: 'read',
    kind: 'text',
  },
  {
    id: 'message-2',
    body: 'Hello! Yes, it is available. I can also arrange an in-person viewing this week.',
    sentAt: '2:48 PM',
    direction: 'incoming',
    delivery: 'read',
    kind: 'text',
  },
  {
    id: 'message-3',
    body: 'Great, I would like to see it this Sunday morning.',
    sentAt: '2:52 PM',
    direction: 'outgoing',
    delivery: 'read',
    kind: 'text',
  },
];

export const initialViewingProposal: ViewingProposalDraft = {
  date: viewingDates[0].full,
  time: '10:30 AM',
  note: 'I would like to tour the bedrooms, balcony, and parking area.',
  status: 'draft',
};
