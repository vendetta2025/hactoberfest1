import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { db } from './db.ts';
import type { NotificationType } from './db.ts';

// -------------------------------------------------------------
// VAPID Key Management
// -------------------------------------------------------------
const DATA_DIR = path.resolve(process.cwd(), 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@nudgify.app';

if (!vapidPublicKey || !vapidPrivateKey) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(VAPID_FILE)) {
      const raw = fs.readFileSync(VAPID_FILE, 'utf-8');
      const saved = JSON.parse(raw);
      vapidPublicKey = saved.publicKey;
      vapidPrivateKey = saved.privateKey;
    } else {
      // Auto-generate persistent VAPID keys for development/preview
      const generated = webpush.generateVAPIDKeys();
      vapidPublicKey = generated.publicKey;
      vapidPrivateKey = generated.privateKey;
      fs.writeFileSync(VAPID_FILE, JSON.stringify(generated, null, 2), 'utf-8');
      console.log('[Push] Generated and stored persistent VAPID keys in data/vapid.json');
    }
  } catch (err) {
    console.error('[Push] Error configuring VAPID keys from file:', err);
    const generated = webpush.generateVAPIDKeys();
    vapidPublicKey = generated.publicKey;
    vapidPrivateKey = generated.privateKey;
  }
}

try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('[Push] Web Push configured with VAPID subject:', vapidSubject);
} catch (err) {
  console.error('[Push] Failed to initialize webpush VAPID details:', err);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

// -------------------------------------------------------------
// Push Delivery Protocol
// -------------------------------------------------------------
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    taskId?: string;
    type?: string;
    [key: string]: any;
  };
}

/**
 * Sends a real Web Push notification to all active browser subscriptions for a user.
 * Cleans up expired (404/410 Gone) subscriptions automatically.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sentCount: number; failedCount: number }> {
  const subscriptions = db.getPushSubscriptionsForUser(userId);
  if (!subscriptions || subscriptions.length === 0) {
    return { sentCount: 0, failedCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  const payloadString = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        payloadString,
        {
          TTL: 60 * 60 * 24, // 24 hours
          urgency: 'high',
        }
      );
      sentCount++;
    } catch (err: any) {
      failedCount++;
      const statusCode = err?.statusCode;
      // 404 Not Found or 410 Gone means the subscription expired or user revoked browser permission
      if (statusCode === 404 || statusCode === 410) {
        console.log(`[Push] Removing expired push subscription for user ${userId} (${statusCode}):`, sub.endpoint);
        db.removePushSubscription(sub.endpoint);
      } else {
        console.warn(`[Push] Web Push failed for user ${userId}:`, err?.message || err);
      }
    }
  }

  return { sentCount, failedCount };
}

// -------------------------------------------------------------
// Event-Based Notification Dispatcher
// -------------------------------------------------------------
export interface NotificationEventParams {
  userId: string; // Target recipient (Owner or Assignee)
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorRole: 'PRIMARY_HELPER' | 'HELPER' | 'OWNER';
  taskId: string;
  taskTitle: string;
  deadline?: string;
  details?: {
    field: string;
    oldValue: string;
    newValue: string;
  };
  customMessage?: string;
  customTitle?: string;
}

/**
 * Central event-based notification dispatcher.
 * Records the in-app notification in DB AND immediately triggers real Web Push.
 */
export async function dispatchNotificationEvent(params: NotificationEventParams) {
  const {
    userId,
    type,
    actorId,
    actorName,
    actorRole,
    taskId,
    taskTitle,
    deadline,
    details = { field: '', oldValue: '', newValue: '' },
    customMessage,
    customTitle,
  } = params;

  let inAppTitle = customTitle || '';
  let inAppMessage = customMessage || '';
  let pushTitle = '🔔 Nudgify';
  let pushBody = '';

  const formattedDeadline = deadline && !isNaN(new Date(deadline).getTime())
    ? new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No deadline';

  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_CREATED':
      inAppTitle = inAppTitle || `New Task Created by ${actorName}`;
      inAppMessage = inAppMessage || `${actorName} created "${taskTitle}" for you due ${formattedDeadline}.`;
      pushTitle = '🔔 Nudgify';
      pushBody = `${actorName} added a new task for you\n${taskTitle}\nDue ${formattedDeadline}`;
      break;

    case 'DEADLINE_CHANGED':
      inAppTitle = inAppTitle || 'Deadline Updated';
      inAppMessage = inAppMessage || `${actorName} moved "${taskTitle}" deadline to ${details.newValue || formattedDeadline}.`;
      pushTitle = '🔔 Nudgify';
      pushBody = `Task updated\n${actorName} changed "${taskTitle}" deadline to ${details.newValue || formattedDeadline}.`;
      break;

    case 'TASK_UPDATED':
      inAppTitle = inAppTitle || 'Task Updated';
      inAppMessage = inAppMessage || `${actorName} updated "${taskTitle}".`;
      pushTitle = '🔔 Nudgify';
      pushBody = `Task updated\n${actorName} modified "${taskTitle}".`;
      break;

    case 'TASK_COMPLETED':
      inAppTitle = inAppTitle || 'Task Completed';
      inAppMessage = inAppMessage || `"${taskTitle}" was marked as completed.`;
      pushTitle = '🔔 Nudgify';
      pushBody = `Task completed\n"${taskTitle}" has been marked complete.`;
      break;

    case 'TASK_REOPENED':
      inAppTitle = inAppTitle || 'Task Reopened';
      inAppMessage = inAppMessage || `"${taskTitle}" was marked as incomplete.`;
      pushTitle = '🔔 Nudgify';
      pushBody = `Task reopened\n"${taskTitle}" is back in progress.`;
      break;

    case 'APPROVAL_REQUIRED':
    case 'APPROVAL_REQUEST':
      inAppTitle = inAppTitle || 'Approval Required';
      inAppMessage = inAppMessage || `${actorName} (Helper) requested to change "${taskTitle}".`;
      pushTitle = '🔔 Nudgify';
      pushBody = `Approval required\n${actorName} requested a schedule change on "${taskTitle}".`;
      break;

    case 'DEADLINE_24_HOURS':
      inAppTitle = inAppTitle || 'Deadline Tomorrow';
      inAppMessage = inAppMessage || `"${taskTitle}" is due in 24 hours.`;
      pushTitle = '🔔 Nudgify';
      pushBody = `Deadline tomorrow\n"${taskTitle}" is due in 24 hours.`;
      break;

    case 'TASK_OVERDUE':
      inAppTitle = inAppTitle || 'Task Overdue';
      inAppMessage = inAppMessage || `"${taskTitle}" was due and is now overdue.`;
      pushTitle = '🔔 Nudgify Overdue Alert';
      pushBody = `Task overdue\n"${taskTitle}" has passed its deadline.`;
      break;

    case 'CUSTOM_REMINDER':
      inAppTitle = inAppTitle || 'Reminder';
      inAppMessage = inAppMessage || `Reminder for "${taskTitle}".`;
      pushTitle = '🔔 Nudgify Reminder';
      pushBody = `Reminder\n"${taskTitle}"`;
      break;

    default:
      inAppTitle = inAppTitle || 'Notification';
      inAppMessage = inAppMessage || `Update regarding "${taskTitle}".`;
      pushTitle = '🔔 Nudgify';
      pushBody = inAppMessage;
      break;
  }

  // 1. Save in-app notification to DB
  const notif = db.addNotification({
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: inAppTitle,
    message: inAppMessage,
    actorId,
    actorName,
    actorRole,
    taskId,
    taskTitle,
    type,
    details,
    read: false,
    createdAt: new Date().toISOString(),
  });

  // 2. Dispatch real background Web Push notification
  const pushPayload: PushPayload = {
    title: pushTitle,
    body: pushBody,
    tag: `nudgify-${taskId || Date.now()}`,
    data: {
      url: taskId ? `/?taskId=${taskId}&tab=tasks` : '/?tab=notifications',
      taskId,
      notificationId: notif.id,
      type,
    },
  };

  const pushResult = await sendPushToUser(userId, pushPayload);
  return { notif, pushResult };
}
