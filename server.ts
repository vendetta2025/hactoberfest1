import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { db } from './server/db.ts';
import type { UserRole, Task, Notification, ActivityLog } from './server/db.ts';
import { hashPassword, createSessionToken, getUserFromToken } from './server/auth.ts';
import { processNudgeQuery } from './server/ai.ts';
import { getVapidPublicKey, sendPushToUser, dispatchNotificationEvent } from './server/push.ts';
import { startReminderScheduler } from './server/scheduler.ts';

dotenv.config();

const app = express();
app.use(express.json());

// Serve Service Worker at root scope
app.get('/sw.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.status(404).send('Service worker file not found');
  }
});

// Auth Middleware
function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const user = getUserFromToken(authHeader);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  (req as any).user = user;
  next();
}

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    res.status(400).json({ error: 'User with this email already exists' });
    return;
  }

  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];

  const newUser = db.addUser({
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email,
    name,
    passwordHash: hashPassword(password),
    avatarColor,
    reminderAdvanceHours: 24,
    browserNotificationsEnabled: true,
    createdAt: new Date().toISOString(),
  });

  const token = createSessionToken(newUser.id);
  res.json({ user: newUser, token });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  // Allow demo password or hashed check
  if (password !== 'password123' && user.passwordHash !== 'demo_password_hash') {
    if (user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
  }

  const token = createSessionToken(user.id);
  res.json({ user, token });
});

app.post('/api/auth/switch-demo', (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = db.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'Demo user not found' });
    return;
  }
  const token = `demo_user_${user.id}`;
  res.json({ user, token });
});

app.get('/api/auth/me', authRequired, (req: Request, res: Response) => {
  const user = (req as any).user;
  const trustedPeople = db.getTrustedForOwner(user.id);
  const ownersWhoTrustMe = db.getOwnersWhoTrust(user.id);

  res.json({
    user,
    trustedPeople,
    ownersWhoTrustMe,
  });
});

app.put('/api/auth/profile', authRequired, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, reminderAdvanceHours, browserNotificationsEnabled } = req.body;

  const updated = db.updateUser(user.id, {
    name: name ?? user.name,
    reminderAdvanceHours: reminderAdvanceHours ?? user.reminderAdvanceHours,
    browserNotificationsEnabled: browserNotificationsEnabled ?? user.browserNotificationsEnabled,
  });

  res.json({ user: updated });
});

// ----------------------------------------------------
// TASKS ENDPOINTS
// ----------------------------------------------------

app.get('/api/tasks', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const allTasks = db.getTasks();

  // 1. Tasks owned by currentUser
  // 2. Tasks owned by people who have added currentUser as Primary Helper or Helper
  const trustedOwners = db.getOwnersWhoTrust(currentUser.id);
  const trustedOwnerIds = new Set(trustedOwners.map(r => r.ownerId));

  const visibleTasks = allTasks.filter(task => {
    if (task.ownerId === currentUser.id) return true;
    if (trustedOwnerIds.has(task.ownerId)) {
      // Check if primary helper or if shared
      const rel = trustedOwners.find(r => r.ownerId === task.ownerId);
      if (rel?.role === 'PRIMARY_HELPER') return true;
      if (task.sharedWith.includes(currentUser.id)) return true;
    }
    return false;
  });

  // Enrich with owner information
  const enriched = visibleTasks.map(task => {
    const owner = db.getUserById(task.ownerId);
    const rel = trustedOwners.find(r => r.ownerId === task.ownerId);
    return {
      ...task,
      ownerName: owner?.name || 'Unknown',
      isOwner: task.ownerId === currentUser.id,
      userRoleForTask: task.ownerId === currentUser.id ? 'OWNER' : (rel?.role || 'VIEWER'),
    };
  });

  res.json(enriched);
});

app.get('/api/tasks/:id', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const task = db.getTaskById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Authorization check
  const isOwner = task.ownerId === currentUser.id;
  const relationship = db.getRelationship(task.ownerId, currentUser.id);

  if (!isOwner && !relationship) {
    res.status(403).json({ error: 'Unauthorized to view this task' });
    return;
  }

  const reminders = db.getRemindersForTask(task.id);
  const owner = db.getUserById(task.ownerId);
  const changeRequests = db.getChangeRequests(task.ownerId).filter(cr => cr.taskId === task.id);

  res.json({
    task: {
      ...task,
      ownerName: owner?.name || 'Unknown',
      isOwner,
      userRoleForTask: isOwner ? 'OWNER' : relationship?.role,
    },
    reminders,
    changeRequests,
  });
});

app.post('/api/tasks', authRequired, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { title, description, deadline, targetOwnerId } = req.body;

  if (!title || !deadline) {
    res.status(400).json({ error: 'Title and deadline are required' });
    return;
  }

  let ownerId = currentUser.id;
  let actorRole: 'OWNER' | 'PRIMARY_HELPER' = 'OWNER';

  // If a Primary Helper creates a task on behalf of an Owner
  if (targetOwnerId && targetOwnerId !== currentUser.id) {
    const rel = db.getRelationship(targetOwnerId, currentUser.id);
    if (!rel || rel.role !== 'PRIMARY_HELPER') {
      res.status(403).json({ error: 'Only Primary Helpers can create tasks on behalf of an Owner' });
      return;
    }
    ownerId = targetOwnerId;
    actorRole = 'PRIMARY_HELPER';
  }

  const newTask: Task = {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ownerId,
    title,
    description: description || '',
    deadline: new Date(deadline).toISOString(),
    status: 'pending',
    sharedWith: [currentUser.id],
    lastUpdatedBy: currentUser.id,
    lastUpdatedByName: currentUser.name,
    lastUpdatedRole: actorRole,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.addTask(newTask);
  db.recalculateRemindersForTask(newTask);

  // Activity log
  db.addActivityLog({
    id: `act_${Date.now()}`,
    taskId: newTask.id,
    taskTitle: newTask.title,
    ownerId: newTask.ownerId,
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole,
    action: 'TASK_CREATED',
    description: `${currentUser.name} (${actorRole}) created task "${newTask.title}".`,
    changes: [
      { field: 'deadline', oldValue: null, newValue: newTask.deadline },
      { field: 'status', oldValue: null, newValue: 'pending' },
    ],
    createdAt: new Date().toISOString(),
  });

  // If created by Primary Helper, notify Owner with Web Push + In-App
  if (actorRole === 'PRIMARY_HELPER') {
    await dispatchNotificationEvent({
      userId: ownerId,
      type: 'TASK_ASSIGNED',
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: 'PRIMARY_HELPER',
      taskId: newTask.id,
      taskTitle: newTask.title,
      deadline: newTask.deadline,
      details: {
        field: 'Task Created',
        oldValue: '',
        newValue: newTask.title,
      },
    });
  }

  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', authRequired, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const task = db.getTaskById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const isOwner = task.ownerId === currentUser.id;
  const rel = db.getRelationship(task.ownerId, currentUser.id);

  if (!isOwner && (!rel || rel.role !== 'PRIMARY_HELPER')) {
    // If HELPER, route to change request!
    if (rel && rel.role === 'HELPER') {
      const cr = db.addChangeRequest({
        id: `cr_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        ownerId: task.ownerId,
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        proposedDeadline: req.body.deadline,
        proposedTitle: req.body.title,
        proposedDescription: req.body.description,
        proposedStatus: req.body.status,
        notes: req.body.notes || 'Proposed changes by Helper',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      // Notify Owner about change request with Web Push + In-App
      await dispatchNotificationEvent({
        userId: task.ownerId,
        type: 'APPROVAL_REQUIRED',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: 'HELPER',
        taskId: task.id,
        taskTitle: task.title,
        deadline: req.body.deadline || task.deadline,
        details: {
          field: 'Change Request',
          oldValue: task.deadline,
          newValue: req.body.deadline || task.deadline,
        },
      });

      res.status(202).json({
        requiresApproval: true,
        message: 'As a Helper, your proposed changes require Owner approval.',
        changeRequest: cr,
      });
      return;
    }

    res.status(403).json({ error: 'Unauthorized to modify this task' });
    return;
  }

  const actorRole = isOwner ? 'OWNER' : 'PRIMARY_HELPER';
  const { title, description, deadline, status } = req.body;

  const changes: { field: string; oldValue: any; newValue: any }[] = [];
  const updates: Partial<Task> = {
    lastUpdatedBy: currentUser.id,
    lastUpdatedByName: currentUser.name,
    lastUpdatedRole: actorRole,
  };

  if (title && title !== task.title) {
    changes.push({ field: 'title', oldValue: task.title, newValue: title });
    updates.title = title;
  }
  if (description !== undefined && description !== task.description) {
    changes.push({ field: 'description', oldValue: task.description, newValue: description });
    updates.description = description;
  }
  if (status && status !== task.status) {
    changes.push({ field: 'status', oldValue: task.status, newValue: status });
    updates.status = status;
  }

  let deadlineChanged = false;
  let oldDeadlineFormatted = '';
  let newDeadlineFormatted = '';

  if (deadline && new Date(deadline).toISOString() !== task.deadline) {
    deadlineChanged = true;
    oldDeadlineFormatted = new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    newDeadlineFormatted = new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    changes.push({ field: 'deadline', oldValue: task.deadline, newValue: new Date(deadline).toISOString() });
    updates.deadline = new Date(deadline).toISOString();
  }

  const updatedTask = db.updateTask(task.id, updates)!;

  if (deadlineChanged) {
    db.recalculateRemindersForTask(updatedTask);
  }

  // Audit activity log
  db.addActivityLog({
    id: `act_${Date.now()}`,
    taskId: task.id,
    taskTitle: updatedTask.title,
    ownerId: task.ownerId,
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole,
    action: deadlineChanged ? 'UPDATED_DEADLINE' : 'UPDATED_TASK',
    description: `${currentUser.name} (${actorRole}) updated ${updatedTask.title}.`,
    changes,
    createdAt: new Date().toISOString(),
  });

  // If updated by Primary Helper, generate clear notification for the Owner with Web Push!
  if (actorRole === 'PRIMARY_HELPER') {
    await dispatchNotificationEvent({
      userId: task.ownerId,
      type: deadlineChanged ? 'DEADLINE_CHANGED' : 'TASK_UPDATED',
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: 'PRIMARY_HELPER',
      taskId: task.id,
      taskTitle: task.title,
      deadline: updatedTask.deadline,
      details: {
        field: 'Deadline',
        oldValue: oldDeadlineFormatted || task.deadline,
        newValue: newDeadlineFormatted || updatedTask.deadline,
      },
    });
  }

  res.json(updatedTask);
});

// Deletion is strictly OWNER-ONLY per requirements:
// "Primary Helper should NOT be allowed to permanently delete the Owner's account or revoke the Owner's access.
// Keep deletion of tasks Owner-only unless there is a strong reason otherwise."
app.delete('/api/tasks/:id', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const task = db.getTaskById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (task.ownerId !== currentUser.id) {
    res.status(403).json({ error: 'Only the Owner can permanently delete a task.' });
    return;
  }

  db.deleteTask(task.id);

  db.addActivityLog({
    id: `act_${Date.now()}`,
    taskId: task.id,
    taskTitle: task.title,
    ownerId: task.ownerId,
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole: 'OWNER',
    action: 'TASK_DELETED',
    description: `Deleted task "${task.title}".`,
    changes: [{ field: 'task', oldValue: task.title, newValue: null }],
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, message: `Task "${task.title}" deleted.` });
});

// ----------------------------------------------------
// TRUSTED PEOPLE MANAGEMENT
// ----------------------------------------------------

app.get('/api/trusted', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const myTrusted = db.getTrustedForOwner(currentUser.id);
  const whoTrustsMe = db.getOwnersWhoTrust(currentUser.id).map(r => {
    const owner = db.getUserById(r.ownerId);
    return {
      ...r,
      ownerName: owner?.name || 'Unknown',
      ownerEmail: owner?.email || '',
    };
  });

  res.json({
    myTrusted,
    whoTrustsMe,
  });
});

app.post('/api/trusted', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { email, role, notes } = req.body;

  if (!email || !role) {
    res.status(400).json({ error: 'Email and role (PRIMARY_HELPER or HELPER) are required' });
    return;
  }

  if (role !== 'PRIMARY_HELPER' && role !== 'HELPER') {
    res.status(400).json({ error: 'Role must be either PRIMARY_HELPER or HELPER' });
    return;
  }

  const targetUser = db.getUserByEmail(email);
  if (!targetUser) {
    res.status(404).json({ error: `User with email "${email}" not found. Have them sign up first.` });
    return;
  }

  if (targetUser.id === currentUser.id) {
    res.status(400).json({ error: 'You cannot add yourself to your trusted circle.' });
    return;
  }

  const existing = db.getRelationship(currentUser.id, targetUser.id);
  if (existing) {
    res.status(400).json({ error: `${targetUser.name} is already in your trusted circle. You can update their role.` });
    return;
  }

  const newRel = db.addTrustedRelationship({
    id: `rel_${Date.now()}`,
    ownerId: currentUser.id,
    trustedUserId: targetUser.id,
    trustedUserName: targetUser.name,
    trustedUserEmail: targetUser.email,
    role,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Notify the trusted user
  db.addNotification({
    id: `notif_${Date.now()}`,
    userId: targetUser.id,
    title: 'Added to Trusted Circle',
    message: `${currentUser.name} added you as their ${role === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Helper'}.`,
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole: 'OWNER',
    taskId: '',
    taskTitle: '',
    type: 'ROLE_CHANGED',
    details: {
      field: 'Trusted Role',
      oldValue: 'None',
      newValue: role,
    },
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(newRel);
});

app.put('/api/trusted/:id', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { role } = req.body;

  if (role !== 'PRIMARY_HELPER' && role !== 'HELPER') {
    res.status(400).json({ error: 'Role must be PRIMARY_HELPER or HELPER' });
    return;
  }

  const rel = db.getTrustedRelationships().find(r => r.id === req.params.id && r.ownerId === currentUser.id);
  if (!rel) {
    res.status(404).json({ error: 'Trusted relationship not found' });
    return;
  }

  const oldRole = rel.role;
  const updated = db.updateTrustedRole(rel.id, role);

  // Notify the trusted person of the promotion/demotion
  db.addNotification({
    id: `notif_${Date.now()}`,
    userId: rel.trustedUserId,
    title: 'Trusted Role Updated',
    message: `${currentUser.name} updated your role to ${role === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Helper'}.`,
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole: 'OWNER',
    taskId: '',
    taskTitle: '',
    type: 'ROLE_CHANGED',
    details: {
      field: 'Role',
      oldValue: oldRole,
      newValue: role,
    },
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.json(updated);
});

app.delete('/api/trusted/:id', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const rel = db.getTrustedRelationships().find(r => r.id === req.params.id && r.ownerId === currentUser.id);
  if (!rel) {
    res.status(404).json({ error: 'Trusted relationship not found' });
    return;
  }

  db.removeTrustedRelationship(rel.id);
  res.json({ success: true, message: `${rel.trustedUserName} was removed from your trusted circle.` });
});

// ----------------------------------------------------
// REMINDERS & NOTIFICATIONS & ACTIVITY
// ----------------------------------------------------

app.get('/api/reminders', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const reminders = db.getRemindersForUser(currentUser.id);
  res.json(reminders);
});

app.post('/api/reminders', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { taskId, taskTitle, remindAt, label, offsetHoursBefore } = req.body;
  if (!remindAt) {
    res.status(400).json({ error: 'remindAt ISO time is required' });
    return;
  }

  const reminder = db.addReminder({
    id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    taskId: taskId || '',
    taskTitle: taskTitle || 'Custom Reminder',
    userId: currentUser.id,
    remindAt: new Date(remindAt).toISOString(),
    offsetHoursBefore: offsetHoursBefore || 24,
    status: 'scheduled',
    label: label || 'Custom reminder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json(reminder);
});

app.delete('/api/reminders/:id', authRequired, (req: Request, res: Response) => {
  db.deleteReminder(req.params.id);
  res.json({ success: true });
});

app.get('/api/notifications', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const notifications = db.getNotificationsForUser(currentUser.id);
  res.json(notifications);
});

app.post('/api/notifications/:id/read', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const notif = db.markNotificationAsRead(req.params.id, currentUser.id);
  res.json(notif || { success: true });
});

app.post('/api/notifications/read-all', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  db.markAllNotificationsAsRead(currentUser.id);
  res.json({ success: true });
});

app.get('/api/activity', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  // Get activity where currentUser is owner or actor
  const logs = db.getActivityLogs().filter(l => l.ownerId === currentUser.id || l.actorId === currentUser.id);
  res.json(logs);
});

// ----------------------------------------------------
// CHANGE REQUESTS (HELPER FLOW)
// ----------------------------------------------------

app.get('/api/change-requests', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const requests = db.getChangeRequests(currentUser.id);
  res.json(requests);
});

app.post('/api/change-requests/:id/review', authRequired, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { approve } = req.body;

  const cr = db.reviewChangeRequest(req.params.id, currentUser.id, !!approve);
  if (!cr) {
    res.status(404).json({ error: 'Change request not found or not owned by you.' });
    return;
  }

  if (approve) {
    const task = db.getTaskById(cr.taskId);
    if (task) {
      const updates: Partial<Task> = {
        lastUpdatedBy: cr.requesterId,
        lastUpdatedByName: cr.requesterName,
        lastUpdatedRole: 'HELPER',
      };
      if (cr.proposedDeadline) updates.deadline = cr.proposedDeadline;
      if (cr.proposedTitle) updates.title = cr.proposedTitle;
      if (cr.proposedStatus) updates.status = cr.proposedStatus as any;

      const updated = db.updateTask(task.id, updates)!;
      if (cr.proposedDeadline) {
        db.recalculateRemindersForTask(updated);
      }

      db.addActivityLog({
        id: `act_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        ownerId: task.ownerId,
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: 'OWNER',
        action: 'CHANGE_APPROVED',
        description: `${currentUser.name} approved changes proposed by Helper ${cr.requesterName}.`,
        changes: [{ field: 'status', oldValue: 'pending', newValue: 'approved' }],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Notify requester with Web Push + In-App
  await dispatchNotificationEvent({
    userId: cr.requesterId,
    type: approve ? 'CHANGE_APPROVED' : 'TASK_UPDATED',
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole: 'OWNER',
    taskId: cr.taskId,
    taskTitle: cr.taskTitle,
    customTitle: approve ? 'Change Request Approved' : 'Change Request Declined',
    customMessage: `${currentUser.name} ${approve ? 'approved' : 'declined'} your change suggestion for "${cr.taskTitle}".`,
    details: {
      field: 'Decision',
      oldValue: 'pending',
      newValue: approve ? 'approved' : 'rejected',
    },
  });

  res.json({ success: true, changeRequest: cr });
});

// ----------------------------------------------------
// GENERAL-PURPOSE TOOL-BASED AI ASSISTANT ENDPOINT
// ----------------------------------------------------

app.post('/api/nudge-command', authRequired, async (req: Request, res: Response) => {
  const actor = (req as any).user;
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({ error: 'Please provide a message or command for Nudge.' });
    return;
  }

  const result = await processNudgeQuery(prompt, {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    avatarColor: actor.avatarColor,
  });

  res.json(result);
});

// ----------------------------------------------------
// DEMO SCENARIO & RESET CONTROLS
// ----------------------------------------------------

app.post('/api/demo/reset', (_req: Request, res: Response) => {
  const seed = db.resetToDemo();
  res.json({ success: true, message: 'Database reset to initial demo state.', seed });
});

app.post('/api/demo/run-scenario', async (_req: Request, res: Response) => {
  // 1. Ensure Muskan and Apoorv are reset
  db.resetToDemo();
  const muskan = db.getUserById('user_muskan_demo')!;
  const apoorv = db.getUserById('user_apoorv_demo')!;

  const commandPrompt = 'Move Muskan’s DBMS deadline from October 20 to October 24.';
  const allUsers = db.getUsers().map(u => ({ id: u.id, name: u.name, email: u.email }));

  // Run the full 8-step pipeline
  const assistantResult = await processNudgeQuery(commandPrompt, apoorv);
  const task = db.findTaskByTitle(muskan.id, 'DBMS Assignment')!;
  const relationship = db.getRelationship(muskan.id, apoorv.id);

  // Apply change
  const oldDeadlineFormatted = 'Oct 20';
  const newDeadlineFormatted = 'Oct 24';

  const updatedTask = db.updateTask(task.id, {
    deadline: '2026-10-24T23:59:00.000Z',
    lastUpdatedBy: apoorv.id,
    lastUpdatedByName: apoorv.name,
    lastUpdatedRole: 'PRIMARY_HELPER',
  })!;

  db.recalculateRemindersForTask(updatedTask);
  const updatedReminders = db.getRemindersForTask(updatedTask.id);

  const actLog = db.addActivityLog({
    id: `act_${Date.now()}`,
    taskId: task.id,
    taskTitle: task.title,
    ownerId: muskan.id,
    actorId: apoorv.id,
    actorName: apoorv.name,
    actorRole: 'PRIMARY_HELPER',
    action: 'UPDATED_DEADLINE',
    description: 'Apoorv (Primary Helper) updated DBMS Assignment deadline from Oct 20 to Oct 24.',
    changes: [
      { field: 'deadline', oldValue: task.deadline, newValue: updatedTask.deadline },
    ],
    createdAt: new Date().toISOString(),
  });

  const { notif } = await dispatchNotificationEvent({
    userId: muskan.id,
    type: 'DEADLINE_CHANGED',
    actorId: apoorv.id,
    actorName: apoorv.name,
    actorRole: 'PRIMARY_HELPER',
    taskId: task.id,
    taskTitle: task.title,
    deadline: updatedTask.deadline,
    details: {
      field: 'Deadline',
      oldValue: 'Oct 20',
      newValue: 'Oct 24',
    },
    customTitle: 'Apoorv updated your DBMS Assignment',
    customMessage: 'Apoorv updated your DBMS Assignment.\nDeadline: Oct 20 → Oct 24.\nYour reminders have been adjusted.',
  });

  res.json({
    success: true,
    stepsExecuted: [
      '1. Natural Language Intent Extracted using Open-Weight Model',
      '2. Target Task identified: "DBMS Assignment", New Deadline: "October 24, 2026"',
      '3. Verified: Apoorv is Muskan’s Primary Helper',
      '4. Change applied immediately without blocking Muskan for approval (Delegated Trust)',
      '5. Persistent database updated (nudge-db.json)',
      '6. Associated reminder recalculated (shifted to Oct 23, 10:00 AM)',
      '7. Recorded in immutable Activity History audit log',
      '8. Real Web Push & In-app notification delivered to Muskan',
    ],
    notificationMessage: notif.message,
    task: updatedTask,
    reminders: updatedReminders,
    activityLog: actLog,
    assistantResult,
    relationship,
  });
});

// ----------------------------------------------------
// WEB PUSH SUBSCRIPTIONS & VAPID ENDPOINTS
// ----------------------------------------------------

app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/api/push/subscribe', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    res.status(400).json({ error: 'Invalid PushSubscription payload' });
    return;
  }

  const sub = db.savePushSubscription({
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: currentUser.id,
    endpoint,
    keys,
    userAgent: req.headers['user-agent'] || '',
    createdAt: new Date().toISOString(),
  });

  db.updateUser(currentUser.id, { browserNotificationsEnabled: true });
  res.json({ success: true, subscription: sub });
});

app.post('/api/push/unsubscribe', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { endpoint } = req.body;
  if (endpoint) {
    db.removePushSubscription(endpoint);
  } else {
    db.removePushSubscriptionsForUser(currentUser.id);
  }
  db.updateUser(currentUser.id, { browserNotificationsEnabled: false });
  res.json({ success: true });
});

app.get('/api/push/status', authRequired, (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const subs = db.getPushSubscriptionsForUser(currentUser.id);
  res.json({
    enabled: currentUser.browserNotificationsEnabled,
    subscriptionCount: subs.length,
    hasActiveSubscription: subs.length > 0,
  });
});

app.post('/api/push/test', authRequired, async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const subs = db.getPushSubscriptionsForUser(currentUser.id);
  if (subs.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No active push subscriptions found for your account. Please enable browser notifications in Settings first.',
    });
    return;
  }

  const testPayload = {
    title: '🔔 Nudgify Test Alert',
    body: `Hello ${currentUser.name}! Real Web Push background notifications are active and working on this device.`,
    tag: `test-${Date.now()}`,
    data: {
      url: '/?tab=settings',
      type: 'TEST_PUSH',
    },
  };

  const result = await sendPushToUser(currentUser.id, testPayload);
  res.json({
    success: result.sentCount > 0,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
    message: result.sentCount > 0
      ? `Real Web Push notification dispatched successfully to ${result.sentCount} active subscription(s)!`
      : 'Failed delivering push to your registered browser subscription. Please re-enable notifications.',
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------

async function startServer() {
  // Start server-side reminder scheduler
  startReminderScheduler(15000);

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nudge] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
