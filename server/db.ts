import fs from 'fs';
import path from 'path';

export type UserRole = 'OWNER' | 'PRIMARY_HELPER' | 'HELPER';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatarColor: string;
  reminderAdvanceHours: number;
  browserNotificationsEnabled: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  deadline: string; // ISO string e.g. 2026-10-20T23:59:00.000Z
  status: 'pending' | 'in_progress' | 'completed';
  sharedWith: string[]; // User IDs allowed to see this task (e.g. Helpers)
  lastUpdatedBy: string; // User ID
  lastUpdatedByName: string;
  lastUpdatedRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrustedRelationship {
  id: string;
  ownerId: string; // User who owns the tasks
  trustedUserId: string; // User who is granted helper rights
  trustedUserName: string;
  trustedUserEmail: string;
  role: 'PRIMARY_HELPER' | 'HELPER';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string; // Recipient owner
  remindAt: string; // ISO string
  offsetHoursBefore: number; // e.g. 24 for 1 day before
  status: 'scheduled' | 'triggered' | 'dismissed';
  label: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_UPDATED'
  | 'DEADLINE_CHANGED'
  | 'TASK_COMPLETED'
  | 'TASK_REOPENED'
  | 'APPROVAL_REQUIRED'
  | 'DEADLINE_24_HOURS'
  | 'TASK_OVERDUE'
  | 'CUSTOM_REMINDER'
  | 'TASK_CREATED'
  | 'APPROVAL_REQUEST'
  | 'CHANGE_APPROVED'
  | 'ROLE_CHANGED';

export interface Notification {
  id: string;
  userId: string; // Target recipient (e.g. Muskan)
  title: string;
  message: string;
  actorId: string; // Who made the change (e.g. Apoorv)
  actorName: string;
  actorRole: 'PRIMARY_HELPER' | 'HELPER' | 'OWNER';
  taskId: string;
  taskTitle: string;
  type: NotificationType;
  details: {
    field: string;
    oldValue: string;
    newValue: string;
  };
  read: boolean;
  createdAt: string;
}

export interface UserPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
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

export interface DatabaseSchema {
  users: User[];
  tasks: Task[];
  trustedRelationships: TrustedRelationship[];
  reminders: Reminder[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  changeRequests: ChangeRequest[];
  pushSubscriptions: UserPushSubscription[];
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'nudge-db.json');

// Initial seed data with Muskan (Owner) and Apoorv (Primary Helper)
export function getInitialSeed(): DatabaseSchema {
  const muskanId = 'user_muskan_demo';
  const apoorvId = 'user_apoorv_demo';
  const rohanId = 'user_rohan_demo';
  const taskId = 'task_dbms_demo';

  // Base dates anchored to the current demo timeline in October 2026
  const deadlineOct20 = '2026-10-20T23:59:00.000Z';
  const reminderOct19 = '2026-10-19T10:00:00.000Z';

  return {
    users: [
      {
        id: muskanId,
        email: 'muskan@demo.nudge.app',
        name: 'Muskan',
        passwordHash: 'demo_password_hash',
        avatarColor: '#6366f1', // Indigo
        reminderAdvanceHours: 24,
        browserNotificationsEnabled: true,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
      {
        id: apoorvId,
        email: 'apoorv@demo.nudge.app',
        name: 'Apoorv',
        passwordHash: 'demo_password_hash',
        avatarColor: '#0ea5e9', // Sky
        reminderAdvanceHours: 24,
        browserNotificationsEnabled: true,
        createdAt: '2026-10-01T08:30:00.000Z',
      },
      {
        id: rohanId,
        email: 'rohan@demo.nudge.app',
        name: 'Rohan',
        passwordHash: 'demo_password_hash',
        avatarColor: '#10b981', // Emerald
        reminderAdvanceHours: 24,
        browserNotificationsEnabled: true,
        createdAt: '2026-10-01T09:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: taskId,
        ownerId: muskanId,
        title: 'DBMS Assignment',
        description: 'Complete Relational Algebra, B+ Tree indexing problems, and normalized schema design (BCNF).',
        deadline: deadlineOct20,
        status: 'in_progress',
        sharedWith: [apoorvId, rohanId],
        lastUpdatedBy: muskanId,
        lastUpdatedByName: 'Muskan',
        lastUpdatedRole: 'OWNER',
        createdAt: '2026-10-02T10:00:00.000Z',
        updatedAt: '2026-10-02T10:00:00.000Z',
      },
      {
        id: 'task_os_demo',
        ownerId: muskanId,
        title: 'Operating Systems Lab 3',
        description: 'Implement multi-threaded producer-consumer problem with mutex locks and semaphores.',
        deadline: '2026-10-28T18:00:00.000Z',
        status: 'pending',
        sharedWith: [apoorvId],
        lastUpdatedBy: muskanId,
        lastUpdatedByName: 'Muskan',
        lastUpdatedRole: 'OWNER',
        createdAt: '2026-10-03T11:00:00.000Z',
        updatedAt: '2026-10-03T11:00:00.000Z',
      },
      {
        id: 'task_apoorv_demo',
        ownerId: apoorvId,
        title: 'Distributed Systems Project Proposal',
        description: 'Draft the Raft consensus algorithm simulation benchmark report.',
        deadline: '2026-10-25T23:59:00.000Z',
        status: 'in_progress',
        sharedWith: [muskanId],
        lastUpdatedBy: apoorvId,
        lastUpdatedByName: 'Apoorv',
        lastUpdatedRole: 'OWNER',
        createdAt: '2026-10-03T14:00:00.000Z',
        updatedAt: '2026-10-03T14:00:00.000Z',
      },
    ],
    trustedRelationships: [
      {
        id: 'rel_muskan_apoorv',
        ownerId: muskanId,
        trustedUserId: apoorvId,
        trustedUserName: 'Apoorv',
        trustedUserEmail: 'apoorv@demo.nudge.app',
        role: 'PRIMARY_HELPER', // Primary helper with delegated trust!
        notes: 'Co-lead in database lab. Can update deadlines & reminders without approval.',
        createdAt: '2026-10-02T10:15:00.000Z',
        updatedAt: '2026-10-02T10:15:00.000Z',
      },
      {
        id: 'rel_muskan_rohan',
        ownerId: muskanId,
        trustedUserId: rohanId,
        trustedUserName: 'Rohan',
        trustedUserEmail: 'rohan@demo.nudge.app',
        role: 'HELPER', // Helper role requiring approval
        notes: 'Study group peer. Can view shared assignments and suggest adjustments.',
        createdAt: '2026-10-02T10:30:00.000Z',
        updatedAt: '2026-10-02T10:30:00.000Z',
      },
    ],
    reminders: [
      {
        id: 'rem_dbms_1',
        taskId: taskId,
        taskTitle: 'DBMS Assignment',
        userId: muskanId,
        remindAt: reminderOct19,
        offsetHoursBefore: 24,
        status: 'scheduled',
        label: '1 day before deadline',
        createdAt: '2026-10-02T10:05:00.000Z',
        updatedAt: '2026-10-02T10:05:00.000Z',
      },
    ],
    notifications: [
      {
        id: 'notif_welcome_muskan',
        userId: muskanId,
        title: 'Primary Helper Configured',
        message: 'Apoorv was designated as your Primary Helper. They can help keep your deadlines and reminders updated.',
        actorId: muskanId,
        actorName: 'Muskan',
        actorRole: 'OWNER',
        taskId: taskId,
        taskTitle: 'DBMS Assignment',
        type: 'ROLE_CHANGED',
        details: {
          field: 'Primary Helper',
          oldValue: 'None',
          newValue: 'Apoorv',
        },
        read: false,
        createdAt: '2026-10-02T10:15:00.000Z',
      },
    ],
    activityLogs: [
      {
        id: 'act_1',
        taskId: taskId,
        taskTitle: 'DBMS Assignment',
        ownerId: muskanId,
        actorId: muskanId,
        actorName: 'Muskan',
        actorRole: 'OWNER',
        action: 'TASK_CREATED',
        description: 'Created task "DBMS Assignment" with deadline October 20.',
        changes: [
          { field: 'deadline', oldValue: null, newValue: '2026-10-20' },
          { field: 'status', oldValue: null, newValue: 'in_progress' },
        ],
        createdAt: '2026-10-02T10:00:00.000Z',
      },
      {
        id: 'act_2',
        taskId: taskId,
        taskTitle: 'DBMS Assignment',
        ownerId: muskanId,
        actorId: muskanId,
        actorName: 'Muskan',
        actorRole: 'OWNER',
        action: 'ROLE_UPDATED',
        description: 'Added Apoorv as Primary Helper.',
        changes: [
          { field: 'trustedPerson', oldValue: null, newValue: 'Apoorv (PRIMARY_HELPER)' },
        ],
        createdAt: '2026-10-02T10:15:00.000Z',
      },
    ],
    changeRequests: [],
    pushSubscriptions: [],
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.tasks && parsed.trustedRelationships) {
          parsed.pushSubscriptions = parsed.pushSubscriptions || [];
          return parsed;
        }
      }
    } catch (err) {
      console.error('[DB] Failed reading db file, restoring seed:', err);
    }

    const seed = getInitialSeed();
    this.saveDirect(seed);
    return seed;
  }

  private saveDirect(data: DatabaseSchema) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  public save() {
    this.saveDirect(this.data);
  }

  public resetToDemo(): DatabaseSchema {
    this.data = getInitialSeed();
    this.save();
    return this.data;
  }

  public getState(): DatabaseSchema {
    return this.data;
  }

  // Users
  public getUsers() {
    return this.data.users;
  }

  public getUserById(id: string) {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserByNameOrEmail(query: string) {
    const q = query.toLowerCase().trim();
    return this.data.users.find(u => 
      u.name.toLowerCase() === q || 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase() === q
    );
  }

  public addUser(user: User) {
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>) {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.save();
      return this.data.users[idx];
    }
    return null;
  }

  // Tasks
  public getTasks() {
    return this.data.tasks;
  }

  public getTaskById(id: string) {
    return this.data.tasks.find(t => t.id === id);
  }

  public findTaskByTitle(ownerId: string, titleQuery: string) {
    const cleanQuery = titleQuery.toLowerCase().replace(/['"“”]/g, '').trim();
    // 1. Exact match on owner tasks
    const ownerTasks = this.data.tasks.filter(t => t.ownerId === ownerId);
    let match = ownerTasks.find(t => t.title.toLowerCase().trim() === cleanQuery);
    if (match) return match;

    // 2. Keyword/substring match (e.g. "DBMS" in "DBMS Assignment")
    match = ownerTasks.find(t => {
      const taskTitleClean = t.title.toLowerCase();
      return taskTitleClean.includes(cleanQuery) || cleanQuery.includes(taskTitleClean);
    });
    if (match) return match;

    // 3. Match across any word
    const words = cleanQuery.split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
      const found = ownerTasks.find(t => t.title.toLowerCase().includes(word));
      if (found) return found;
    }

    return null;
  }

  public addTask(task: Task) {
    this.data.tasks.push(task);
    this.save();
    return task;
  }

  public updateTask(id: string, updates: Partial<Task>) {
    const idx = this.data.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.data.tasks[idx] = { 
        ...this.data.tasks[idx], 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      this.save();
      return this.data.tasks[idx];
    }
    return null;
  }

  public deleteTask(id: string) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.data.reminders = this.data.reminders.filter(r => r.taskId !== id);
    this.save();
  }

  // Trusted Relationships
  public getTrustedRelationships() {
    return this.data.trustedRelationships;
  }

  public getTrustedForOwner(ownerId: string) {
    return this.data.trustedRelationships.filter(r => r.ownerId === ownerId);
  }

  public getOwnersWhoTrust(userId: string) {
    return this.data.trustedRelationships.filter(r => r.trustedUserId === userId);
  }

  public getRelationship(ownerId: string, trustedUserId: string) {
    return this.data.trustedRelationships.find(
      r => r.ownerId === ownerId && r.trustedUserId === trustedUserId
    );
  }

  public addTrustedRelationship(rel: TrustedRelationship) {
    // If setting to PRIMARY_HELPER, demote any other existing primary helper for this owner
    if (rel.role === 'PRIMARY_HELPER') {
      this.data.trustedRelationships.forEach(r => {
        if (r.ownerId === rel.ownerId && r.role === 'PRIMARY_HELPER' && r.id !== rel.id) {
          r.role = 'HELPER';
          r.updatedAt = new Date().toISOString();
        }
      });
    }

    this.data.trustedRelationships.push(rel);
    this.save();
    return rel;
  }

  public updateTrustedRole(id: string, newRole: 'PRIMARY_HELPER' | 'HELPER') {
    const rel = this.data.trustedRelationships.find(r => r.id === id);
    if (!rel) return null;

    if (newRole === 'PRIMARY_HELPER') {
      // Demote other primary helpers for this owner
      this.data.trustedRelationships.forEach(r => {
        if (r.ownerId === rel.ownerId && r.role === 'PRIMARY_HELPER' && r.id !== id) {
          r.role = 'HELPER';
          r.updatedAt = new Date().toISOString();
        }
      });
    }

    rel.role = newRole;
    rel.updatedAt = new Date().toISOString();
    this.save();
    return rel;
  }

  public removeTrustedRelationship(id: string) {
    this.data.trustedRelationships = this.data.trustedRelationships.filter(r => r.id !== id);
    this.save();
  }

  // Reminders
  public getRemindersForTask(taskId: string) {
    return this.data.reminders.filter(r => r.taskId === taskId);
  }

  public getRemindersForUser(userId: string) {
    return this.data.reminders.filter(r => r.userId === userId);
  }

  public addReminder(reminder: Reminder) {
    this.data.reminders.push(reminder);
    this.save();
    return reminder;
  }

  public recalculateRemindersForTask(task: Task) {
    if (!task.deadline || isNaN(new Date(task.deadline).getTime())) {
      return;
    }
    const taskReminders = this.data.reminders.filter(r => r.taskId === task.id);
    const deadlineTime = new Date(task.deadline).getTime();

    for (const rem of taskReminders) {
      const offsetMs = (rem.offsetHoursBefore || 24) * 60 * 60 * 1000;
      const newRemindTime = new Date(deadlineTime - offsetMs);
      rem.remindAt = newRemindTime.toISOString();
      rem.taskTitle = task.title;
      rem.updatedAt = new Date().toISOString();
    }

    // If task has no reminders yet, create default 24h reminder
    if (taskReminders.length === 0) {
      const offsetMs = 24 * 60 * 60 * 1000;
      const newRemindTime = new Date(deadlineTime - offsetMs);
      const newReminder: Reminder = {
        id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        taskId: task.id,
        taskTitle: task.title,
        userId: task.ownerId,
        remindAt: newRemindTime.toISOString(),
        offsetHoursBefore: 24,
        status: 'scheduled',
        label: '1 day before deadline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.reminders.push(newReminder);
    }

    this.save();
  }

  public deleteReminder(id: string) {
    this.data.reminders = this.data.reminders.filter(r => r.id !== id);
    this.save();
  }

  // Notifications
  public getNotificationsForUser(userId: string) {
    return this.data.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(notification: Notification) {
    this.data.notifications.unshift(notification);
    this.save();
    return notification;
  }

  public markNotificationAsRead(id: string, userId: string) {
    const notif = this.data.notifications.find(n => n.id === id && n.userId === userId);
    if (notif) {
      notif.read = true;
      this.save();
      return notif;
    }
    return null;
  }

  public markAllNotificationsAsRead(userId: string) {
    this.data.notifications.forEach(n => {
      if (n.userId === userId) n.read = true;
    });
    this.save();
  }

  // Activity Logs
  public getActivityLogs(ownerId?: string) {
    let logs = this.data.activityLogs;
    if (ownerId) {
      logs = logs.filter(l => l.ownerId === ownerId);
    }
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addActivityLog(log: ActivityLog) {
    this.data.activityLogs.unshift(log);
    this.save();
    return log;
  }

  // Change Requests (for HELPER role)
  public getChangeRequests(ownerId: string) {
    return this.data.changeRequests.filter(cr => cr.ownerId === ownerId);
  }

  public addChangeRequest(cr: ChangeRequest) {
    this.data.changeRequests.unshift(cr);
    this.save();
    return cr;
  }

  public reviewChangeRequest(id: string, ownerId: string, approve: boolean) {
    const cr = this.data.changeRequests.find(r => r.id === id && r.ownerId === ownerId);
    if (!cr) return null;

    cr.status = approve ? 'approved' : 'rejected';
    cr.reviewedAt = new Date().toISOString();
    this.save();
    return cr;
  }

  // Push Subscriptions
  public getPushSubscriptionsForUser(userId: string): UserPushSubscription[] {
    this.data.pushSubscriptions = this.data.pushSubscriptions || [];
    return this.data.pushSubscriptions.filter(s => s.userId === userId);
  }

  public savePushSubscription(sub: UserPushSubscription): UserPushSubscription {
    this.data.pushSubscriptions = this.data.pushSubscriptions || [];
    const idx = this.data.pushSubscriptions.findIndex(s => s.endpoint === sub.endpoint);
    if (idx !== -1) {
      this.data.pushSubscriptions[idx] = sub;
    } else {
      this.data.pushSubscriptions.push(sub);
    }
    this.save();
    return sub;
  }

  public removePushSubscription(endpoint: string): boolean {
    this.data.pushSubscriptions = this.data.pushSubscriptions || [];
    const initialLen = this.data.pushSubscriptions.length;
    this.data.pushSubscriptions = this.data.pushSubscriptions.filter(s => s.endpoint !== endpoint);
    if (this.data.pushSubscriptions.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public removePushSubscriptionsForUser(userId: string): void {
    this.data.pushSubscriptions = this.data.pushSubscriptions || [];
    this.data.pushSubscriptions = this.data.pushSubscriptions.filter(s => s.userId !== userId);
    this.save();
  }

  // Pending Reminders (server-side scheduled triggers)
  public getPendingReminders(nowMs: number = Date.now()): Reminder[] {
    return this.data.reminders.filter(r => {
      if (r.status !== 'scheduled') return false;
      const remindTime = new Date(r.remindAt).getTime();
      return !isNaN(remindTime) && remindTime <= nowMs;
    });
  }

  public markReminderTriggered(id: string): Reminder | null {
    const rem = this.data.reminders.find(r => r.id === id);
    if (rem) {
      rem.status = 'triggered';
      rem.updatedAt = new Date().toISOString();
      this.save();
      return rem;
    }
    return null;
  }

  public hasNotificationForTaskAndType(taskId: string, type: NotificationType, withinMs?: number): boolean {
    const now = Date.now();
    return this.data.notifications.some(n => {
      if (n.taskId !== taskId || n.type !== type) return false;
      if (withinMs) {
        const createdMs = new Date(n.createdAt).getTime();
        return (now - createdMs) < withinMs;
      }
      return true;
    });
  }
}

export const db = new Database();
