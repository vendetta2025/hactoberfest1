export type Role = 'OWNER' | 'PRIMARY_HELPER' | 'HELPER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  reminderAdvanceHours: number;
  browserNotificationsEnabled: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  ownerId: string;
  ownerName?: string;
  title: string;
  description: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
  sharedWith: string[];
  lastUpdatedBy: string;
  lastUpdatedByName: string;
  lastUpdatedRole?: string;
  isOwner?: boolean;
  userRoleForTask?: Role | 'VIEWER';
  createdAt: string;
  updatedAt: string;
}

export interface TrustedRelationship {
  id: string;
  ownerId: string;
  trustedUserId: string;
  trustedUserName: string;
  trustedUserEmail: string;
  role: 'PRIMARY_HELPER' | 'HELPER';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerWhoTrustsMe extends TrustedRelationship {
  ownerName: string;
  ownerEmail: string;
}

export interface Reminder {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  remindAt: string;
  offsetHoursBefore: number;
  status: 'scheduled' | 'triggered' | 'dismissed';
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  actorId: string;
  actorName: string;
  actorRole: 'PRIMARY_HELPER' | 'HELPER' | 'OWNER';
  taskId: string;
  taskTitle: string;
  type: 'DEADLINE_CHANGED' | 'TASK_UPDATED' | 'TASK_CREATED' | 'APPROVAL_REQUEST' | 'CHANGE_APPROVED' | 'ROLE_CHANGED';
  details: {
    field: string;
    oldValue: string;
    newValue: string;
  };
  read: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  taskId: string;
  taskTitle: string;
  ownerId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  description: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  createdAt: string;
}

export interface ChangeRequest {
  id: string;
  taskId: string;
  taskTitle: string;
  ownerId: string;
  requesterId: string;
  requesterName: string;
  proposedDeadline?: string;
  proposedTitle?: string;
  proposedDescription?: string;
  proposedStatus?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
}

export interface NudgeCommandResult {
  success: boolean;
  message?: string;
  conversationalResponse?: string;
  toolUsed?: string;
  toolArgs?: any;
  toolResult?: any;
  error?: string;
  clarificationRequired?: boolean;
  field?: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  role?: string;
  remindersAdjusted?: boolean;
  reminders?: Reminder[];
  task?: Task;
  tasks?: Task[];
  activityLogs?: ActivityLog[];
  notifications?: Notification[];
  targetUser?: string;
  notificationSent?: string;
  requiresApproval?: boolean;
  changeRequest?: ChangeRequest;
  intent?: any;
}
