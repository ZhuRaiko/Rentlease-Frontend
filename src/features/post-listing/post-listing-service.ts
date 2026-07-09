import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';
import {
  ChatMessage,
  ChatThread,
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenanceUrgency,
  RentReminder,
  ViewingSchedule,
  ViewingStatus,
} from '@/features/post-listing/types';

type ChatThreadRow = {
  id: string;
  listing_ref: string | null;
  tenant_id: string;
  landlord_id: string | null;
  last_message: string | null;
  created_at: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ViewingRow = {
  id: string;
  listing_ref: string;
  tenant_id: string;
  landlord_id: string | null;
  requested_at: string;
  message: string | null;
  status: ViewingStatus;
  created_at: string;
  updated_at: string;
};

type MaintenanceRow = {
  id: string;
  listing_ref: string | null;
  tenant_id: string;
  landlord_id: string | null;
  title: string;
  description: string | null;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
};

type ReminderRow = {
  id: string;
  user_id: string;
  listing_ref: string | null;
  rent_due_day: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const demoThreadId = '00000000-0000-0000-0000-000000000001';

export function rowToThread(row: ChatThreadRow): ChatThread {
  return {
    id: row.id,
    listingRef: row.listing_ref,
    tenantId: row.tenant_id,
    landlordId: row.landlord_id,
    lastMessage: row.last_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function rowToViewing(row: ViewingRow): ViewingSchedule {
  return {
    id: row.id,
    listingRef: row.listing_ref,
    tenantId: row.tenant_id,
    landlordId: row.landlord_id,
    requestedAt: row.requested_at,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMaintenance(row: MaintenanceRow): MaintenanceRequest {
  return {
    id: row.id,
    listingRef: row.listing_ref,
    tenantId: row.tenant_id,
    landlordId: row.landlord_id,
    title: row.title,
    description: row.description,
    urgency: row.urgency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReminder(row: ReminderRow): RentReminder {
  return {
    id: row.id,
    userId: row.user_id,
    listingRef: row.listing_ref,
    rentDueDay: row.rent_due_day,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateThread(listingRef: string, tenantId: string, landlordId?: string | null) {
  const payload = {
    listing_ref: listingRef,
    tenant_id: tenantId,
    landlord_id: isUuid(landlordId) ? landlordId : null,
  };

  const { data, error } = await supabase
    .from('chat_threads')
    .upsert(payload, { onConflict: 'listing_ref,tenant_id,landlord_id' })
    .select('*')
    .single();

  if (error) {
    console.warn('Using demo chat thread because thread creation failed.', error.message);
    return {
      id: demoThreadId,
      listingRef,
      tenantId,
      landlordId: landlordId ?? null,
      lastMessage: 'Demo thread ready.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return rowToThread(data as ChatThreadRow);
}

export async function getThreads(userId?: string) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('Chat threads unavailable.', error.message);
    return [];
  }

  return (data as ChatThreadRow[]).map(rowToThread);
}

export async function getMessages(threadId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Chat messages unavailable.', error.message);
    return [
      {
        id: 'demo-message',
        threadId,
        senderId: 'demo',
        body: 'This is where messages will appear once the Supabase migration is pushed.',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return (data as ChatMessageRow[]).map(rowToMessage);
}

export async function sendMessage(threadId: string, senderId: string, body: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ thread_id: threadId, sender_id: senderId, body })
    .select('*')
    .single();

  if (error) throw error;

  await supabase.from('chat_threads').update({ last_message: body }).eq('id', threadId);
  return rowToMessage(data as ChatMessageRow);
}

export async function requestViewing(input: {
  listingRef: string;
  tenantId: string;
  landlordId?: string | null;
  requestedAt: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from('viewing_schedules')
    .insert({
      listing_ref: input.listingRef,
      tenant_id: input.tenantId,
      landlord_id: isUuid(input.landlordId) ? input.landlordId : null,
      requested_at: input.requestedAt,
      message: input.message,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToViewing(data as ViewingRow);
}

export async function getViewingSchedules(userId?: string) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('viewing_schedules')
    .select('*')
    .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
    .order('requested_at', { ascending: true });

  if (error) {
    console.warn('Viewing schedules unavailable.', error.message);
    return [];
  }
  return (data as ViewingRow[]).map(rowToViewing);
}

export async function updateViewingStatus(id: string, status: ViewingStatus) {
  const { data, error } = await supabase.from('viewing_schedules').update({ status }).eq('id', id).select('*').single();
  if (error) throw error;
  return rowToViewing(data as ViewingRow);
}

export async function getMaintenanceRequests(userId?: string) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*')
    .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Maintenance requests unavailable.', error.message);
    return [];
  }
  return (data as MaintenanceRow[]).map(rowToMaintenance);
}

export async function createMaintenanceRequest(input: {
  tenantId: string;
  landlordId?: string | null;
  listingRef?: string | null;
  title: string;
  description: string;
  urgency: MaintenanceUrgency;
}) {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert({
      tenant_id: input.tenantId,
      landlord_id: isUuid(input.landlordId) ? input.landlordId : null,
      listing_ref: input.listingRef,
      title: input.title,
      description: input.description,
      urgency: input.urgency,
      status: 'open',
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToMaintenance(data as MaintenanceRow);
}

export async function updateMaintenanceStatus(id: string, status: MaintenanceStatus) {
  const { data, error } = await supabase.from('maintenance_requests').update({ status }).eq('id', id).select('*').single();
  if (error) throw error;
  return rowToMaintenance(data as MaintenanceRow);
}

export async function getRentReminders(userId?: string) {
  if (!userId) return [];
  const { data, error } = await supabase.from('rent_reminders').select('*').eq('user_id', userId);
  if (error) {
    console.warn('Rent reminders unavailable.', error.message);
    return [];
  }
  return (data as ReminderRow[]).map(rowToReminder);
}

export async function saveRentReminder(userId: string, rentDueDay: number) {
  const { data, error } = await supabase
    .from('rent_reminders')
    .upsert({ user_id: userId, rent_due_day: rentDueDay, enabled: true }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rent due soon',
      body: `Your rent reminder is set for day ${rentDueDay} of each month.`,
    },
    trigger: null,
  });

  return rowToReminder(data as ReminderRow);
}

function isUuid(value?: string | null) {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  );
}
