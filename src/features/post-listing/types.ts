export type ChatThread = {
  id: string;
  listingRef: string | null;
  tenantId: string;
  landlordId: string | null;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type ViewingStatus = 'pending' | 'approved' | 'declined' | 'rescheduled';
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved';
export type MaintenanceUrgency = 'low' | 'normal' | 'urgent';

export type ViewingSchedule = {
  id: string;
  listingRef: string;
  tenantId: string;
  landlordId: string | null;
  requestedAt: string;
  message: string | null;
  status: ViewingStatus;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceRequest = {
  id: string;
  listingRef: string | null;
  tenantId: string;
  landlordId: string | null;
  title: string;
  description: string | null;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  createdAt: string;
  updatedAt: string;
};

export type RentReminder = {
  id: string;
  userId: string;
  listingRef: string | null;
  rentDueDay: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
