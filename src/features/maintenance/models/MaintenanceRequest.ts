export type MaintenanceActor = 'tenant' | 'landlord';

export type MaintenanceScreen =
  | 'requests'
  | 'empty'
  | 'create'
  | 'issueDetails'
  | 'priority'
  | 'photoUpload'
  | 'review'
  | 'submitted'
  | 'requestDetails'
  | 'submittedStatus'
  | 'landlordDetails'
  | 'acknowledge'
  | 'requestMoreInfo'
  | 'tenantAddInfo'
  | 'scheduleRepair'
  | 'scheduled'
  | 'inProgress'
  | 'markResolved'
  | 'resolutionPending'
  | 'confirmResolution'
  | 'reopen'
  | 'landlordReject'
  | 'rejectionReason'
  | 'rejectionResponse';

export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Emergency';

export type MaintenanceStatus =
  | 'Submitted'
  | 'Acknowledged'
  | 'More information needed'
  | 'Scheduled'
  | 'In progress'
  | 'Awaiting tenant confirmation'
  | 'Resolved'
  | 'Reopened'
  | 'Rejected'
  | 'Disputed';

export interface MaintenanceDraft {
  propertyId: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  photoCount: number;
}

export interface MaintenanceSchedule {
  date: string;
  time: string;
  contact: string;
  note: string;
}

export interface MaintenanceRequestPreview extends MaintenanceDraft {
  id: string;
  propertyTitle: string;
  propertyAddress: string;
  unitCode: string;
  createdAt: string;
  updatedAt: string;
  status: MaintenanceStatus;
  tenantName: string;
}

export const priorityOptions: Array<{
  value: MaintenancePriority;
  label: string;
  description: string;
}> = [
  { value: 'Low', label: 'Low', description: 'Cosmetic or non-urgent issue' },
  { value: 'Medium', label: 'Medium', description: 'Needs attention within a few days' },
  { value: 'High', label: 'High', description: 'Affects daily use of the property' },
  { value: 'Emergency', label: 'Emergency', description: 'Immediate safety or major property risk' },
];

export const maintenanceDates = [
  'Tuesday, September 22, 2026',
  'Wednesday, September 23, 2026',
  'Friday, September 25, 2026',
] as const;

export const maintenanceTimes = ['9:00 AM', '11:00 AM', '2:00 PM', '4:30 PM'] as const;

export const emptyMaintenanceDraft: MaintenanceDraft = {
  propertyId: 'imus-house-uc06',
  title: '',
  description: '',
  priority: 'Medium',
  photoCount: 0,
};

export const initialMaintenanceSchedule: MaintenanceSchedule = {
  date: maintenanceDates[0],
  time: maintenanceTimes[1],
  contact: 'Cavite Home Repair Services',
  note: 'The repair team will inspect the sink and bring replacement plumbing fittings.',
};

export const previewMaintenanceRequests: MaintenanceRequestPreview[] = [
  {
    id: 'maintenance-kitchen-sink',
    propertyId: 'imus-house-uc06',
    propertyTitle: '2-Bedroom House with Balcony',
    propertyAddress: 'Brgy. Alapan II-B, Imus, Cavite',
    unitCode: 'UC-06',
    title: 'Kitchen sink is leaking',
    description:
      'Water is leaking from the pipe below the kitchen sink whenever the faucet is used. The cabinet floor is starting to get wet.',
    priority: 'High',
    photoCount: 2,
    createdAt: 'September 18, 2026 · 9:42 AM',
    updatedAt: 'Today · 10:15 AM',
    status: 'Submitted',
    tenantName: 'Maria Santos',
  },
  {
    id: 'maintenance-bedroom-light',
    propertyId: 'dasma-studio-uc12',
    propertyTitle: 'Studio Unit near DLSU-D',
    propertyAddress: 'Dasmariñas City, Cavite',
    unitCode: 'UC-12',
    title: 'Bedroom ceiling light flickers',
    description: 'The ceiling light flickers after it has been switched on for a few minutes.',
    priority: 'Medium',
    photoCount: 1,
    createdAt: 'September 14, 2026 · 6:18 PM',
    updatedAt: 'September 16 · 2:00 PM',
    status: 'Scheduled',
    tenantName: 'Juan Dela Cruz',
  },
  {
    id: 'maintenance-cabinet-hinge',
    propertyId: 'imus-house-uc06',
    propertyTitle: '2-Bedroom House with Balcony',
    propertyAddress: 'Brgy. Alapan II-B, Imus, Cavite',
    unitCode: 'UC-06',
    title: 'Loose bedroom cabinet hinge',
    description: 'The upper hinge is loose and the cabinet door no longer closes evenly.',
    priority: 'Low',
    photoCount: 0,
    createdAt: 'August 28, 2026 · 1:20 PM',
    updatedAt: 'September 2 · 4:35 PM',
    status: 'Resolved',
    tenantName: 'Maria Santos',
  },
];
