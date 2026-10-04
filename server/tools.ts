import { Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import { db } from './db.ts';
import type { Task, Reminder, Notification, ActivityLog, ChangeRequest, UserRole } from './db.ts';

export interface ToolContextUser {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
}

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // ---------------- READ TOOLS ----------------
  {
    name: 'get_my_tasks',
    description: 'Retrieve tasks owned by or shared with the current user. Can filter by status (pending, in_progress, completed, or all) or target owner name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: 'Filter by task status: pending, in_progress, completed, or all (default all).',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional name of the user whose tasks to retrieve (e.g. "Muskan"). Defaults to current user.',
        },
      },
    },
  },
  {
    name: 'get_upcoming_tasks',
    description: 'Get tasks with deadlines coming up in the near future (e.g. this week, next 7 days, or within a specific number of days).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        daysAhead: {
          type: Type.NUMBER,
          description: 'Number of days ahead to look for deadlines (default 7 days).',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional name of target owner. Defaults to current user.',
        },
      },
    },
  },
  {
    name: 'get_overdue_tasks',
    description: 'Get tasks whose deadlines have already passed and are not yet marked completed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional name of target owner. Defaults to current user.',
        },
      },
    },
  },
  {
    name: 'get_task_details',
    description: 'Get full details, deadline, reminders, and history for a specific task by name or title query.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskTitle: {
          type: Type.STRING,
          description: 'The title or keyword of the task to find (e.g. "DBMS Assignment", "Operating Systems").',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional name of target owner. Defaults to current user.',
        },
      },
      required: ['taskTitle'],
    },
  },
  {
    name: 'get_notifications',
    description: 'Retrieve notifications for the current user, showing deadline alerts, changes made by helpers, or approval requests.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        unreadOnly: {
          type: Type.BOOLEAN,
          description: 'If true, only return unread notifications.',
        },
      },
    },
  },
  {
    name: 'get_recent_activity',
    description: 'Get recent activity and audit log entries. Can optionally filter by actor name (e.g. "Apoorv") or task title.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        actorName: {
          type: Type.STRING,
          description: 'Optional actor name to filter changes made by that person (e.g. "Apoorv").',
        },
        taskTitle: {
          type: Type.STRING,
          description: 'Optional task title to filter changes affecting that task.',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of activity records to return (default 10).',
        },
      },
    },
  },
  {
    name: 'get_trusted_people',
    description: "Get the current user's trusted circle: designated Primary Helper, regular Helpers, and people who have designated the current user as their helper.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_schedule_summary',
    description: 'Get a comprehensive executive summary of the workload for this week: upcoming deadlines, overdue tasks, active reminders, and recent helper modifications.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timeframe: {
          type: Type.STRING,
          description: 'One of: today, this_week, next_week, all (default this_week).',
        },
      },
    },
  },

  // ---------------- WRITE TOOLS ----------------
  {
    name: 'create_task',
    description: 'Create a new task or assignment with a title, deadline, optional description, and optional target owner if the user is Primary Helper.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'The title of the new task (e.g. "NeoCollab info", "DBMS Assignment").',
        },
        deadline: {
          type: Type.STRING,
          description: 'ISO 8601 date string or YYYY-MM-DD for when the task is due.',
        },
        description: {
          type: Type.STRING,
          description: 'Optional description or notes for the task.',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional name of the user who will own this task. Defaults to current user unless Primary Helper specifies owner.',
        },
      },
      required: ['title', 'deadline'],
    },
  },
  {
    name: 'update_task',
    description: 'Update task properties such as title, description, or notes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskTitle: {
          type: Type.STRING,
          description: 'Title of the task to update.',
        },
        newTitle: {
          type: Type.STRING,
          description: 'New title for the task.',
        },
        description: {
          type: Type.STRING,
          description: 'New description or notes for the task.',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional owner name if updating someone else’s task.',
        },
      },
      required: ['taskTitle'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskTitle: {
          type: Type.STRING,
          description: 'The title or keyword of the task to mark as completed (e.g. "DBMS Assignment").',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional owner name if completing someone else’s task.',
        },
      },
      required: ['taskTitle'],
    },
  },
  {
    name: 'reopen_task',
    description: 'Reopen a completed task, setting its status back to in_progress or pending.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskTitle: {
          type: Type.STRING,
          description: 'Title of the task to reopen.',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional owner name.',
        },
      },
      required: ['taskTitle'],
    },
  },
  {
    name: 'update_deadline',
    description: 'Move or reschedule a task deadline. Server automatically recalculates reminders and records activity.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskTitle: {
          type: Type.STRING,
          description: 'The title or keyword of the task to reschedule (e.g. "DBMS Assignment").',
        },
        newDeadline: {
          type: Type.STRING,
          description: 'The new deadline as an ISO 8601 string or YYYY-MM-DD.',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'The owner of the task if modifying on their behalf (e.g. "Muskan").',
        },
      },
      required: ['taskTitle', 'newDeadline'],
    },
  },
  {
    name: 'create_or_update_reminder',
    description: 'Create or update a reminder for a task at a specific time or offset.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskTitle: {
          type: Type.STRING,
          description: 'The task title to attach the reminder to.',
        },
        remindAt: {
          type: Type.STRING,
          description: 'ISO 8601 date-time string for when to remind (e.g. "2026-10-05T18:00:00.000Z").',
        },
        label: {
          type: Type.STRING,
          description: 'Human-readable label for the reminder (e.g. "Tomorrow evening", "1 day before deadline").',
        },
        targetOwnerName: {
          type: Type.STRING,
          description: 'Optional owner name.',
        },
      },
      required: ['taskTitle', 'remindAt'],
    },
  },
];

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  requiresApproval?: boolean;
  changeRequest?: ChangeRequest;
  task?: Task;
  tasks?: Task[];
  reminders?: Reminder[];
  activityLogs?: ActivityLog[];
  notifications?: Notification[];
  field?: string;
  oldValue?: string;
  newValue?: string;
  changedBy?: string;
  role?: string;
  remindersAdjusted?: boolean;
  targetUser?: string;
}

/**
 * Execute tool with strict deterministic server-side role and permission enforcement
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  actor: ToolContextUser
): Promise<ToolExecutionResult> {
  const now = new Date('2026-10-04T06:05:36-07:00'); // current anchor date

  // Helper to resolve target user
  const resolveTargetUser = (nameOrEmail?: string) => {
    if (!nameOrEmail) return actor;
    const clean = nameOrEmail.trim().toLowerCase();
    if (clean === 'me' || clean === 'my' || clean === 'myself' || clean === actor.name.toLowerCase()) {
      return actor;
    }
    const found = db.findUserByNameOrEmail(nameOrEmail);
    return found || null;
  };

  switch (toolName) {
    // ---------------- READ TOOLS ----------------
    case 'get_my_tasks': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) {
        return { success: false, error: `Could not find user "${args.targetOwnerName}".`, message: 'User not found.' };
      }

      // Check authorization
      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;
      if (!isOwner && !rel) {
        return { success: false, error: `Permission Denied: You are not authorized to view ${target.name}'s tasks.`, message: 'Unauthorized' };
      }

      let tasks = db.getTasks().filter(t => t.ownerId === target.id);
      if (args.status && args.status !== 'all') {
        tasks = tasks.filter(t => t.status === args.status);
      }

      return {
        success: true,
        message: `Found ${tasks.length} task(s) for ${target.name}.`,
        tasks,
        data: tasks.map(t => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          status: t.status,
          description: t.description,
        })),
      };
    }

    case 'get_upcoming_tasks': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'User not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;
      if (!isOwner && !rel) {
        return { success: false, error: `Unauthorized to view ${target.name}'s upcoming tasks.`, message: 'Unauthorized' };
      }

      const daysAhead = args.daysAhead || 7;
      const maxTime = now.getTime() + daysAhead * 24 * 60 * 60 * 1000;

      const tasks = db.getTasks()
        .filter(t => t.ownerId === target.id && t.status !== 'completed')
        .filter(t => {
          const dl = new Date(t.deadline).getTime();
          return dl >= now.getTime() && dl <= maxTime;
        })
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

      return {
        success: true,
        message: `Found ${tasks.length} task(s) due within the next ${daysAhead} days for ${target.name}.`,
        tasks,
        data: tasks.map(t => ({
          title: t.title,
          deadline: t.deadline,
          status: t.status,
          dueInDays: Math.ceil((new Date(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      };
    }

    case 'get_overdue_tasks': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'User not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;
      if (!isOwner && !rel) {
        return { success: false, error: `Unauthorized to view ${target.name}'s tasks.`, message: 'Unauthorized' };
      }

      const overdue = db.getTasks()
        .filter(t => t.ownerId === target.id && t.status !== 'completed')
        .filter(t => new Date(t.deadline).getTime() < now.getTime());

      return {
        success: true,
        message: `Found ${overdue.length} overdue task(s) for ${target.name}.`,
        tasks: overdue,
        data: overdue.map(t => ({
          title: t.title,
          deadline: t.deadline,
          status: t.status,
          overdueDays: Math.floor((now.getTime() - new Date(t.deadline).getTime()) / (1000 * 60 * 60 * 24)),
        })),
      };
    }

    case 'get_task_details': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'User not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;
      if (!isOwner && !rel) {
        return { success: false, error: `Unauthorized to access ${target.name}'s tasks.`, message: 'Unauthorized' };
      }

      const task = db.findTaskByTitle(target.id, args.taskTitle);
      if (!task) {
        return { success: false, error: `Task "${args.taskTitle}" not found for ${target.name}.`, message: 'Task not found' };
      }

      const reminders = db.getRemindersForTask(task.id);
      const activity = db.getActivityLogs(target.id).filter(a => a.taskId === task.id);

      return {
        success: true,
        message: `Details for "${task.title}".`,
        task,
        reminders,
        activityLogs: activity,
        data: {
          task,
          reminders,
          activity,
        },
      };
    }

    case 'get_notifications': {
      let notifs = db.getNotificationsForUser(actor.id);
      if (args.unreadOnly) {
        notifs = notifs.filter(n => !n.read);
      }
      return {
        success: true,
        message: `Retrieved ${notifs.length} notification(s).`,
        notifications: notifs,
        data: notifs.slice(0, 5),
      };
    }

    case 'get_recent_activity': {
      let logs = db.getActivityLogs().filter(l => l.ownerId === actor.id || l.actorId === actor.id);
      if (args.actorName) {
        const aName = args.actorName.toLowerCase();
        logs = logs.filter(l => l.actorName.toLowerCase().includes(aName));
      }
      if (args.taskTitle) {
        const tTitle = args.taskTitle.toLowerCase();
        logs = logs.filter(l => l.taskTitle.toLowerCase().includes(tTitle));
      }
      const limit = args.limit || 10;
      const slice = logs.slice(0, limit);

      return {
        success: true,
        message: `Retrieved ${slice.length} activity record(s).`,
        activityLogs: slice,
        data: slice.map(l => ({
          actorName: l.actorName,
          actorRole: l.actorRole,
          taskTitle: l.taskTitle,
          action: l.action,
          description: l.description,
          createdAt: l.createdAt,
        })),
      };
    }

    case 'get_trusted_people': {
      const myTrusted = db.getTrustedForOwner(actor.id);
      const whoTrustsMe = db.getOwnersWhoTrust(actor.id).map(r => {
        const owner = db.getUserById(r.ownerId);
        return {
          ownerName: owner?.name || 'Unknown',
          ownerEmail: owner?.email || '',
          role: r.role,
        };
      });

      return {
        success: true,
        message: 'Retrieved trusted circle.',
        data: {
          myTrusted: myTrusted.map(t => ({
            name: t.trustedUserName,
            email: t.trustedUserEmail,
            role: t.role,
            notes: t.notes,
          })),
          whoTrustsMe,
        },
      };
    }

    case 'get_schedule_summary': {
      const allTasks = db.getTasks().filter(t => t.ownerId === actor.id);
      const activeTasks = allTasks.filter(t => t.status !== 'completed');
      const overdueTasks = activeTasks.filter(t => new Date(t.deadline).getTime() < now.getTime());
      
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const thisWeekTasks = activeTasks.filter(t => {
        const time = new Date(t.deadline).getTime();
        return time >= now.getTime() && time <= now.getTime() + oneWeekMs;
      });

      const reminders = db.getRemindersForUser(actor.id).filter(r => r.status === 'scheduled');
      const recentActivity = db.getActivityLogs(actor.id).slice(0, 3);
      const primaryHelper = db.getTrustedForOwner(actor.id).find(r => r.role === 'PRIMARY_HELPER');

      return {
        success: true,
        message: `Schedule summary: ${thisWeekTasks.length} task(s) due this week, ${overdueTasks.length} overdue.`,
        data: {
          totalActiveTasks: activeTasks.length,
          dueThisWeekCount: thisWeekTasks.length,
          thisWeekTasks: thisWeekTasks.map(t => ({ title: t.title, deadline: t.deadline })),
          overdueCount: overdueTasks.length,
          overdueTasks: overdueTasks.map(t => ({ title: t.title, deadline: t.deadline })),
          activeRemindersCount: reminders.length,
          primaryHelper: primaryHelper?.trustedUserName || 'None assigned',
          recentActivity: recentActivity.map(a => a.description),
        },
      };
    }

    // ---------------- WRITE TOOLS ----------------
    case 'create_task': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'Target user not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;

      // Only Owner or Primary Helper can create tasks!
      if (!isOwner && (!rel || rel.role !== 'PRIMARY_HELPER')) {
        return {
          success: false,
          error: `Permission Denied: Only ${target.name} or their Primary Helper can create tasks on their behalf.`,
          message: 'Permission Denied',
        };
      }

      const actorRole: UserRole = isOwner ? 'OWNER' : 'PRIMARY_HELPER';
      const deadlineIso = new Date(args.deadline).toISOString();

      const newTask: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ownerId: target.id,
        title: args.title.trim(),
        description: args.description || '',
        deadline: deadlineIso,
        status: 'pending',
        sharedWith: [actor.id],
        lastUpdatedBy: actor.id,
        lastUpdatedByName: actor.name,
        lastUpdatedRole: actorRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.addTask(newTask);
      db.recalculateRemindersForTask(newTask);

      db.addActivityLog({
        id: `act_${Date.now()}`,
        taskId: newTask.id,
        taskTitle: newTask.title,
        ownerId: target.id,
        actorId: actor.id,
        actorName: actor.name,
        actorRole,
        action: 'TASK_CREATED',
        description: `${actor.name} (${actorRole}) created task "${newTask.title}" due ${new Date(newTask.deadline).toLocaleDateString()}.`,
        changes: [{ field: 'deadline', oldValue: null, newValue: newTask.deadline }],
        createdAt: new Date().toISOString(),
      });

      if (!isOwner) {
        db.addNotification({
          id: `notif_${Date.now()}`,
          userId: target.id,
          title: `New Task Created by ${actor.name}`,
          message: `${actor.name} created a new task "${newTask.title}" for you due ${new Date(newTask.deadline).toLocaleDateString()}. Reminders are scheduled.`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: 'PRIMARY_HELPER',
          taskId: newTask.id,
          taskTitle: newTask.title,
          type: 'TASK_CREATED',
          details: { field: 'Task Created', oldValue: '', newValue: newTask.title },
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: `✓ Created task "${newTask.title}" due ${new Date(newTask.deadline).toLocaleDateString()}.`,
        task: newTask,
        field: 'Task Created',
        oldValue: '',
        newValue: newTask.title,
        changedBy: `${actor.name} · ${actorRole === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Owner'}`,
        role: actorRole,
        targetUser: target.name,
        remindersAdjusted: true,
      };
    }

    case 'complete_task': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'Target user not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;

      if (!isOwner && !rel) {
        return {
          success: false,
          error: `Permission Denied: You do not have permission to modify ${target.name}'s tasks.`,
          message: 'Permission Denied',
        };
      }

      const task = db.findTaskByTitle(target.id, args.taskTitle);
      if (!task) {
        return { success: false, error: `Could not find task matching "${args.taskTitle}" for ${target.name}.`, message: 'Task not found' };
      }

      // If Helper, route to ChangeRequest
      if (rel && rel.role === 'HELPER') {
        const cr = db.addChangeRequest({
          id: `cr_${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          ownerId: target.id,
          requesterId: actor.id,
          requesterName: actor.name,
          proposedStatus: 'completed',
          notes: `Helper requested to mark "${task.title}" as completed.`,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        db.addNotification({
          id: `notif_${Date.now()}`,
          userId: target.id,
          title: 'Approval Required: Task Completion Requested',
          message: `${actor.name} (Helper) suggested marking "${task.title}" as completed. Approval required.`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: 'HELPER',
          taskId: task.id,
          taskTitle: task.title,
          type: 'APPROVAL_REQUEST',
          details: { field: 'Status', oldValue: task.status, newValue: 'completed' },
          read: false,
          createdAt: new Date().toISOString(),
        });

        return {
          success: true,
          requiresApproval: true,
          message: `Change requested for "${task.title}". As a Helper, this will be marked completed once ${target.name} approves.`,
          changeRequest: cr,
          task,
        };
      }

      // Owner or Primary Helper
      const actorRole = isOwner ? 'OWNER' : 'PRIMARY_HELPER';
      const updated = db.updateTask(task.id, {
        status: 'completed',
        lastUpdatedBy: actor.id,
        lastUpdatedByName: actor.name,
        lastUpdatedRole: actorRole,
      })!;

      db.addActivityLog({
        id: `act_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        ownerId: target.id,
        actorId: actor.id,
        actorName: actor.name,
        actorRole,
        action: 'TASK_COMPLETED',
        description: `${actor.name} (${actorRole}) marked "${task.title}" as completed.`,
        changes: [{ field: 'status', oldValue: task.status, newValue: 'completed' }],
        createdAt: new Date().toISOString(),
      });

      if (!isOwner) {
        db.addNotification({
          id: `notif_${Date.now()}`,
          userId: target.id,
          title: `${task.title} Marked as Completed`,
          message: `${actor.name} (Primary Helper) marked your task "${task.title}" as completed.`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: 'PRIMARY_HELPER',
          taskId: task.id,
          taskTitle: task.title,
          type: 'TASK_UPDATED',
          details: { field: 'Status', oldValue: task.status, newValue: 'completed' },
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: `✓ Marked "${task.title}" as completed.`,
        task: updated,
        field: 'Status',
        oldValue: task.status,
        newValue: 'completed',
        changedBy: `${actor.name} · ${actorRole === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Owner'}`,
        role: actorRole,
        targetUser: target.name,
      };
    }

    case 'reopen_task': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'Target user not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;
      if (!isOwner && (!rel || rel.role !== 'PRIMARY_HELPER')) {
        return { success: false, error: 'Permission Denied: Only Owner or Primary Helper can reopen tasks.', message: 'Unauthorized' };
      }

      const task = db.findTaskByTitle(target.id, args.taskTitle);
      if (!task) return { success: false, error: `Task "${args.taskTitle}" not found.`, message: 'Not found' };

      const updated = db.updateTask(task.id, {
        status: 'in_progress',
        lastUpdatedBy: actor.id,
        lastUpdatedByName: actor.name,
        lastUpdatedRole: isOwner ? 'OWNER' : 'PRIMARY_HELPER',
      })!;

      return {
        success: true,
        message: `✓ Reopened "${task.title}" (status: in_progress).`,
        task: updated,
      };
    }

    case 'update_deadline': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'Target user not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;

      if (!isOwner && !rel) {
        return {
          success: false,
          error: `Permission Denied: You do not have permission to modify ${target.name}'s tasks.`,
          message: 'Permission Denied',
        };
      }

      const task = db.findTaskByTitle(target.id, args.taskTitle);
      if (!task) {
        return { success: false, error: `Could not find task matching "${args.taskTitle}" for ${target.name}.`, message: 'Task not found' };
      }

      const newDeadlineIso = new Date(args.newDeadline).toISOString();
      const oldDateFormatted = new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const newDateFormatted = new Date(newDeadlineIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // If Helper, route to ChangeRequest
      if (rel && rel.role === 'HELPER') {
        const cr = db.addChangeRequest({
          id: `cr_${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          ownerId: target.id,
          requesterId: actor.id,
          requesterName: actor.name,
          proposedDeadline: newDeadlineIso,
          notes: `Suggested moving deadline from ${oldDateFormatted} to ${newDateFormatted}.`,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        db.addNotification({
          id: `notif_${Date.now()}`,
          userId: target.id,
          title: 'Approval Required: Deadline Change Requested',
          message: `${actor.name} (Helper) suggested moving "${task.title}" deadline to ${newDateFormatted}. Approval required.`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: 'HELPER',
          taskId: task.id,
          taskTitle: task.title,
          type: 'APPROVAL_REQUEST',
          details: { field: 'Deadline', oldValue: oldDateFormatted, newValue: newDateFormatted },
          read: false,
          createdAt: new Date().toISOString(),
        });

        return {
          success: true,
          requiresApproval: true,
          message: `Change requested for ${task.title}. As a Helper, this will be applied once ${target.name} approves.`,
          changeRequest: cr,
          task,
        };
      }

      // Owner or Primary Helper: Apply immediately!
      const actorRole = isOwner ? 'OWNER' : 'PRIMARY_HELPER';
      const updated = db.updateTask(task.id, {
        deadline: newDeadlineIso,
        lastUpdatedBy: actor.id,
        lastUpdatedByName: actor.name,
        lastUpdatedRole: actorRole,
      })!;

      db.recalculateRemindersForTask(updated);
      const updatedReminders = db.getRemindersForTask(updated.id);

      db.addActivityLog({
        id: `act_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        ownerId: target.id,
        actorId: actor.id,
        actorName: actor.name,
        actorRole,
        action: 'UPDATED_DEADLINE',
        description: `${actor.name} (${actorRole}) updated ${task.title} deadline from ${oldDateFormatted} to ${newDateFormatted}.`,
        changes: [{ field: 'deadline', oldValue: task.deadline, newValue: updated.deadline }],
        createdAt: new Date().toISOString(),
      });

      if (!isOwner) {
        db.addNotification({
          id: `notif_${Date.now()}`,
          userId: target.id,
          title: `${task.title} Deadline Updated`,
          message: `${actor.name} updated your ${task.title}.\nDeadline: ${oldDateFormatted} → ${newDateFormatted}.\nYour reminders have been adjusted.`,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: 'PRIMARY_HELPER',
          taskId: task.id,
          taskTitle: task.title,
          type: 'DEADLINE_CHANGED',
          details: { field: 'Deadline', oldValue: oldDateFormatted, newValue: newDateFormatted },
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        message: `✓ ${task.title} updated`,
        field: 'Deadline',
        oldValue: oldDateFormatted,
        newValue: newDateFormatted,
        changedBy: `${actor.name} · ${actorRole === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Owner'}`,
        role: actorRole,
        task: updated,
        reminders: updatedReminders,
        remindersAdjusted: true,
        targetUser: target.name,
      };
    }

    case 'create_or_update_reminder': {
      const target = resolveTargetUser(args.targetOwnerName);
      if (!target) return { success: false, error: 'Target user not found', message: 'User not found' };

      const isOwner = actor.id === target.id;
      const rel = !isOwner ? db.getRelationship(target.id, actor.id) : null;
      if (!isOwner && (!rel || rel.role !== 'PRIMARY_HELPER')) {
        return { success: false, error: 'Permission Denied: Only Owner or Primary Helper can set reminders directly.', message: 'Unauthorized' };
      }

      const task = db.findTaskByTitle(target.id, args.taskTitle);
      if (!task) return { success: false, error: `Task "${args.taskTitle}" not found.`, message: 'Task not found' };

      const remindAtIso = new Date(args.remindAt).toISOString();
      const newReminder = db.addReminder({
        id: `rem_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        userId: target.id,
        remindAt: remindAtIso,
        offsetHoursBefore: 24,
        status: 'scheduled',
        label: args.label || 'Custom reminder',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: `✓ Scheduled reminder for "${task.title}" at ${new Date(remindAtIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
        task,
        reminders: db.getRemindersForTask(task.id),
      };
    }

    default:
      return { success: false, error: `Unknown tool "${toolName}".`, message: 'Unknown action' };
  }
}
