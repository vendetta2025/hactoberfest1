import { db } from './db.ts';
import { dispatchNotificationEvent } from './push.ts';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Checks and triggers server-side scheduled reminders and deadline alerts.
 * This runs continuously on the backend server regardless of whether browser tabs are open.
 */
export async function runReminderCheck() {
  const now = new Date();
  const nowMs = now.getTime();

  // 1. Process custom and scheduled task reminders
  const pendingReminders = db.getPendingReminders(nowMs);
  for (const reminder of pendingReminders) {
    db.markReminderTriggered(reminder.id);
    const task = db.getTaskById(reminder.taskId);

    await dispatchNotificationEvent({
      userId: reminder.userId,
      type: 'CUSTOM_REMINDER',
      actorId: reminder.userId,
      actorName: 'Nudgify',
      actorRole: 'OWNER',
      taskId: reminder.taskId,
      taskTitle: reminder.taskTitle,
      customTitle: 'Scheduled Reminder',
      customMessage: `Reminder for "${reminder.taskTitle}": ${reminder.label || 'Your reminder is due.'}`,
    });
  }

  // 2. Process 24-hour deadline reminders
  const tasks = db.getTasks().filter(t => t.status !== 'completed' && Boolean(t.deadline));
  for (const task of tasks) {
    const deadlineMs = new Date(task.deadline).getTime();
    if (isNaN(deadlineMs)) continue;

    const diffMs = deadlineMs - nowMs;

    // Is the task due within 24 hours (and still in the future)?
    if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
      // Check if 24h notification already sent
      const alreadySent = db.hasNotificationForTaskAndType(task.id, 'DEADLINE_24_HOURS');
      if (!alreadySent) {
        await dispatchNotificationEvent({
          userId: task.ownerId,
          type: 'DEADLINE_24_HOURS',
          actorId: task.ownerId,
          actorName: 'Nudgify',
          actorRole: 'OWNER',
          taskId: task.id,
          taskTitle: task.title,
          deadline: task.deadline,
          customTitle: 'Deadline Tomorrow',
          customMessage: `"${task.title}" is due in 24 hours.`,
        });
      }
    }

    // 3. Process Overdue notifications (if overdue and not notified in the last 24h)
    if (diffMs < 0) {
      const alreadyNotified = db.hasNotificationForTaskAndType(task.id, 'TASK_OVERDUE', 24 * 60 * 60 * 1000);
      if (!alreadyNotified) {
        await dispatchNotificationEvent({
          userId: task.ownerId,
          type: 'TASK_OVERDUE',
          actorId: task.ownerId,
          actorName: 'Nudgify',
          actorRole: 'OWNER',
          taskId: task.id,
          taskTitle: task.title,
          deadline: task.deadline,
          customTitle: 'Task Overdue',
          customMessage: `"${task.title}" has passed its deadline and is overdue.`,
        });
      }
    }
  }
}

/**
 * Starts the server-side reminder scheduler loop.
 */
export function startReminderScheduler(intervalMs: number = 15000) {
  if (schedulerInterval) return;
  console.log(`[Scheduler] Server-side reminder scheduler started (checking every ${intervalMs / 1000}s)`);
  // Run once immediately on start
  runReminderCheck().catch(err => console.error('[Scheduler] Error on initial check:', err));
  schedulerInterval = setInterval(() => {
    runReminderCheck().catch(err => console.error('[Scheduler] Error during scheduled check:', err));
  }, intervalMs);
}

export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
