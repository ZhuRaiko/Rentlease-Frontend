export type NotificationCategory =
  | 'All'
  | 'Messages'
  | 'Viewings'
  | 'Maintenance'
  | 'Verification'
  | 'Listings'
  | 'Safety';

export type NotificationDayGroup = 'Today' | 'Earlier this week';

export type NotificationTarget =
  | 'messages'
  | 'maintenance'
  | 'verification'
  | 'listings'
  | 'ratingsReports'
  | 'discovery'
  | 'none';

export type NotificationScreen =
  | 'center'
  | 'empty'
  | 'permissionPrompt'
  | 'permissionDenied'
  | 'androidExample';

export type NotificationPermissionState = 'notDetermined' | 'granted' | 'denied';

export interface RentLeaseNotification {
  id: string;
  title: string;
  body: string;
  category: Exclude<NotificationCategory, 'All'>;
  dayGroup: NotificationDayGroup;
  time: string;
  read: boolean;
  target: NotificationTarget;
}

export const notificationCategories: NotificationCategory[] = [
  'All',
  'Messages',
  'Viewings',
  'Maintenance',
  'Verification',
  'Listings',
  'Safety',
];

export const previewNotifications: RentLeaseNotification[] = [
  {
    id: 'maintenance-scheduled',
    title: 'Repair visit scheduled',
    body: 'Your kitchen sink repair is scheduled for tomorrow at 10:30 AM.',
    category: 'Maintenance',
    dayGroup: 'Today',
    time: '9:42 AM',
    read: false,
    target: 'maintenance',
  },
  {
    id: 'new-message',
    title: 'New message from Samuel',
    body: 'The apartment is still available. Would you like to arrange a viewing?',
    category: 'Messages',
    dayGroup: 'Today',
    time: '8:18 AM',
    read: false,
    target: 'messages',
  },
  {
    id: 'verification-approved',
    title: 'Tier 2 verification approved',
    body: 'Your identity has been verified. You can now continue to landlord verification.',
    category: 'Verification',
    dayGroup: 'Today',
    time: '7:05 AM',
    read: false,
    target: 'verification',
  },
  {
    id: 'viewing-accepted',
    title: 'Viewing proposal accepted',
    body: 'Your viewing at 2-BR House with Balcony is confirmed for September 8.',
    category: 'Viewings',
    dayGroup: 'Earlier this week',
    time: 'Mon',
    read: true,
    target: 'messages',
  },
  {
    id: 'listing-inquiry',
    title: 'Your listing has a new inquiry',
    body: 'A renter asked about Studio Unit near DLSU-D.',
    category: 'Listings',
    dayGroup: 'Earlier this week',
    time: 'Sun',
    read: true,
    target: 'listings',
  },
  {
    id: 'report-update',
    title: 'Report status updated',
    body: 'The RENTLEASE safety team has completed its review of your report.',
    category: 'Safety',
    dayGroup: 'Earlier this week',
    time: 'Fri',
    read: true,
    target: 'ratingsReports',
  },
];
