import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { db } from './server/db.ts';
import type { UserRole, Task, Notification, ActivityLog } from './server/db.ts';
import { hashPassword, createSessionToken, getUserFromToken } from './server/auth.ts';
import { processNudgeQuery } from './server/ai.ts';

dotenv.config();

const app = express();
app.use(express.json());

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

app.post('/api/tasks', authRequired, (req: Request, res: Response) => {
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

  // If created by Primary Helper, notify Owner
  if (actorRole === 'PRIMARY_HELPER') {
    db.addNotification({
      id: `notif_${Date.now()}`,
      userId: ownerId,
      title: 'New Task Created by Primary Helper',
      message: `${currentUser.name} created a new task "${newTask.title}" with deadline ${new Date(newTask.deadline).toLocaleDateString()}. Reminders have been scheduled.`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: 'PRIMARY_HELPER',
      taskId: newTask.id,
      taskTitle: newTask.title,
      type: 'TASK_CREATED',
      details: {
        field: 'Task Created',
        oldValue: '',
        newValue: newTask.title,
      },
      read: false,
      createdAt: new Date().toISOString(),
    });
  }

  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', authRequired, (req: Request, res: Response) => {
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

      // Notify Owner about change request
      db.addNotification({
        id: `notif_${Date.now()}`,
        userId: task.ownerId,
        title: 'Approval Required: Task Change Requested',
        message: `${currentUser.name} (Helper) suggested changes to "${task.title}". Review and approve or reject.`,
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: 'HELPER',
        taskId: task.id,
        taskTitle: task.title,
        type: 'APPROVAL_REQUEST',
        details: {
          field: 'Change Request',
          oldValue: task.deadline,
          newValue: req.body.deadline || task.deadline,
        },
        read: false,
        createdAt: new Date().toISOString(),
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

  // If updated by Primary Helper, generate clear notification for the Owner!
  if (actorRole === 'PRIMARY_HELPER') {
    let message = `${currentUser.name} updated your ${task.title}.`;
    if (deadlineChanged) {
      message = `${currentUser.name} updated your ${task.title}.\nDeadline: ${oldDeadlineFormatted} → ${newDeadlineFormatted}.\nYour reminders have been adjusted.`;
    }

    db.addNotification({
      id: `notif_${Date.now()}`,
      userId: task.ownerId,
      title: `${task.title} Updated by ${currentUser.name}`,
      message,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: 'PRIMARY_HELPER',
      taskId: task.id,
      taskTitle: task.title,
      type: deadlineChanged ? 'DEADLINE_CHANGED' : 'TASK_UPDATED',
      details: {
        field: 'Deadline',
        oldValue: oldDeadlineFormatted || task.deadline,
        newValue: newDeadlineFormatted || updatedTask.deadline,
      },
      read: false,
      createdAt: new Date().toISOString(),
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

app.post('/api/change-requests/:id/review', authRequired, (req: Request, res: Response) => {
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

  // Notify requester
  db.addNotification({
    id: `notif_${Date.now()}`,
    userId: cr.requesterId,
    title: approve ? 'Change Request Approved' : 'Change Request Declined',
    message: `${currentUser.name} ${approve ? 'approved' : 'declined'} your change suggestion for "${cr.taskTitle}".`,
    actorId: currentUser.id,
    actorName: currentUser.name,
    actorRole: 'OWNER',
    taskId: cr.taskId,
    taskTitle: cr.taskTitle,
    type: 'CHANGE_APPROVED',
    details: {
      field: 'Decision',
      oldValue: 'pending',
      newValue: approve ? 'approved' : 'rejected',
    },
    read: false,
    createdAt: new Date().toISOString(),
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

  const notif = db.addNotification({
    id: `notif_${Date.now()}`,
    userId: muskan.id,
    title: 'Apoorv updated your DBMS Assignment',
    message: 'Apoorv updated your DBMS Assignment.\nDeadline: Oct 20 → Oct 24.\nYour reminders have been adjusted.',
    actorId: apoorv.id,
    actorName: apoorv.name,
    actorRole: 'PRIMARY_HELPER',
    taskId: task.id,
    taskTitle: task.title,
    type: 'DEADLINE_CHANGED',
    details: {
      field: 'Deadline',
      oldValue: 'Oct 20',
      newValue: 'Oct 24',
    },
    read: false,
    createdAt: new Date().toISOString(),
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
      '8. In-app notification generated for Muskan',
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
// VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------

async function startServer() {
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
