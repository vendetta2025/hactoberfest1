import { GoogleGenAI } from '@google/genai';
import { TOOL_DECLARATIONS, executeTool } from './tools.ts';
import type { ToolExecutionResult, ToolContextUser } from './tools.ts';
import { db } from './db.ts';

export interface NudgeAssistantResult extends ToolExecutionResult {
  conversationalResponse: string;
  toolUsed?: string;
  toolArgs?: Record<string, any>;
  clarificationRequired?: boolean;
}

// Initialize Gemini client with proper header
let aiClient: GoogleGenAI | null = null;
const rawKey = process.env.GEMINI_API_KEY;
if (rawKey && rawKey !== 'MY_GEMINI_API_KEY' && !rawKey.includes('MY_GEMINI') && rawKey.trim().length > 10) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: rawKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('[AI] Could not initialize GoogleGenAI client:', err);
  }
}

/**
 * Parses date references relative to the fixed anchor date: Sunday, Oct 4, 2026
 */
function parseNaturalDate(text: string): string | null {
  const lower = text.toLowerCase();
  
  const months: Record<string, string> = {
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12', jan: '01', january: '01'
  };

  // 1. Explicit target date with preposition (e.g. "to October 24", "by October 24", "until October 24")
  const targetMatch = lower.match(/(?:to|by|until|due)\s+(october|oct|november|nov|december|dec|january|jan)\s+(\d{1,2})(?:th|st|nd|rd)?/i);
  if (targetMatch) {
    const m = months[targetMatch[1].toLowerCase()] || '10';
    const d = parseInt(targetMatch[2], 10).toString().padStart(2, '0');
    return `2026-${m}-${d}T23:59:00.000Z`;
  }

  // 2. Fallback general month/day
  const monthMatch = lower.match(/(october|oct|november|nov|december|dec|january|jan)\s+(\d{1,2})(?:th|st|nd|rd)?/i);
  if (monthMatch) {
    const m = months[monthMatch[1].toLowerCase()] || '10';
    const d = parseInt(monthMatch[2], 10).toString().padStart(2, '0');
    return `2026-${m}-${d}T23:59:00.000Z`;
  }

  // Next Friday (Oct 16, 2026)
  if (lower.includes('next friday')) {
    return '2026-10-16T23:59:00.000Z';
  }
  // This Friday / Friday (Oct 9, 2026)
  if (lower.includes('friday')) {
    return '2026-10-09T23:59:00.000Z';
  }
  // Tomorrow evening / tomorrow at 6 PM (Oct 5, 2026 at 18:00)
  if (lower.includes('tomorrow evening') || lower.includes('tomorrow at 6') || lower.includes('tomorrow 6pm')) {
    return '2026-10-05T18:00:00.000Z';
  }
  // Tomorrow (Oct 5, 2026)
  if (lower.includes('tomorrow')) {
    return '2026-10-05T23:59:00.000Z';
  }
  // Today (Oct 4, 2026)
  if (lower.includes('today')) {
    return '2026-10-04T23:59:00.000Z';
  }
  // Next Monday (Oct 12, 2026)
  if (lower.includes('monday')) {
    return '2026-10-12T23:59:00.000Z';
  }

  return null;
}

/**
 * Intelligent deterministic tool router used as ultra-reliable fallback
 * or when Gemini function calling returns.
 */
export async function fallbackToolRouter(
  prompt: string,
  actor: ToolContextUser
): Promise<NudgeAssistantResult> {
  const normalized = prompt
    .replace(/[\u2018\u2019\u201A\u201B']/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '"')
    .trim();
  const lower = normalized.toLowerCase();

  // Find target user mentioned (e.g. "Muskan's DBMS", "for Muskan")
  let targetOwnerName: string | undefined;
  const allUsers = db.getUsers();
  for (const u of allUsers) {
    if (lower.includes(u.name.toLowerCase())) {
      targetOwnerName = u.name;
      break;
    }
  }

  // 1. Ask about recent changes / activity (e.g. "What has Apoorv changed recently?")
  if (lower.includes('what has') || lower.includes('changed recently') || lower.includes('recent activity') || lower.includes('audit log') || lower.includes('what changed')) {
    let actorFilter: string | undefined;
    for (const u of allUsers) {
      if (lower.includes(u.name.toLowerCase())) {
        actorFilter = u.name;
        break;
      }
    }
    const res = await executeTool('get_recent_activity', { actorName: actorFilter, limit: 5 }, actor);
    const count = res.activityLogs?.length || 0;
    let reply = '';
    if (count === 0) {
      reply = actorFilter ? `No recent changes found by ${actorFilter}.` : 'No recent activity recorded.';
    } else {
      const items = res.activityLogs!.map(l => `• ${l.actorName}: ${l.description}`).join('\n');
      reply = actorFilter 
        ? `Here are recent updates by ${actorFilter}:\n${items}`
        : `Here is the recent activity in your workspace:\n${items}`;
    }
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'get_recent_activity',
      toolArgs: { actorName: actorFilter },
    };
  }

  // 2. Schedule summary (e.g. "Give me a summary of my tasks this week", "Summarize my week")
  if (lower.includes('summary') || lower.includes('summarize') || lower.includes('everything i need to do') || lower.includes('workload')) {
    const res = await executeTool('get_schedule_summary', { timeframe: 'this_week' }, actor);
    const data = res.data;
    const reply = `Here is your schedule summary for this week:\n` +
      `• Active deadlines this week: ${data.dueThisWeekCount}\n` +
      `• Overdue tasks: ${data.overdueCount}\n` +
      `• Scheduled reminders: ${data.activeRemindersCount}\n` +
      `• Primary Helper: ${data.primaryHelper}` +
      (data.thisWeekTasks.length > 0 ? `\n\nUpcoming this week: ${data.thisWeekTasks.map((t: any) => `"${t.title}" (${new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`).join(', ')}` : '');
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'get_schedule_summary',
      toolArgs: { timeframe: 'this_week' },
    };
  }

  // 3. Upcoming tasks (e.g. "What do I have due this week?", "Upcoming deadlines")
  if (lower.includes('due this week') || lower.includes('what do i have due') || lower.includes('upcoming') || lower.includes('what is due')) {
    const res = await executeTool('get_upcoming_tasks', { daysAhead: 7, targetOwnerName }, actor);
    const tasks = res.tasks || [];
    let reply = '';
    if (tasks.length === 0) {
      reply = `You have no tasks due this week! You're completely up to date.`;
    } else {
      const list = tasks.map(t => {
        const dStr = new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `• "${t.title}" — due ${dStr} (${t.status})`;
      }).join('\n');
      reply = `You have ${tasks.length} task(s) due this week:\n${list}`;
    }
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'get_upcoming_tasks',
      toolArgs: { daysAhead: 7, targetOwnerName },
    };
  }

  // 4. Overdue tasks (e.g. "What is overdue?")
  if (lower.includes('overdue') || lower.includes('past due')) {
    const res = await executeTool('get_overdue_tasks', { targetOwnerName }, actor);
    const tasks = res.tasks || [];
    const reply = tasks.length === 0
      ? 'Great news! You have no overdue tasks.'
      : `You have ${tasks.length} overdue task(s):\n` + tasks.map(t => `• "${t.title}" (was due ${new Date(t.deadline).toLocaleDateString()})`).join('\n');
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'get_overdue_tasks',
      toolArgs: { targetOwnerName },
    };
  }

  // 5. Complete task (e.g. "I finished my DBMS assignment", "Mark DBMS as completed")
  if (lower.includes('finished') || lower.includes('completed') || lower.includes('done with') || lower.includes('mark') && lower.includes('complete')) {
    let taskTitle = 'DBMS Assignment';
    if (lower.includes('os lab') || lower.includes('operating systems')) taskTitle = 'Operating Systems Lab 3';
    else if (lower.includes('neocollab')) taskTitle = 'NeoCollab info';
    else if (lower.includes('distributed')) taskTitle = 'Distributed Systems Project Proposal';
    else {
      const match = normalized.match(/(?:finished|completed|mark)\s+(?:my\s+)?["']?([^"'.,]+)["']?/i);
      if (match) taskTitle = match[1].trim();
    }

    const res = await executeTool('complete_task', { taskTitle, targetOwnerName }, actor);
    let reply = '';
    if (!res.success) {
      reply = res.error || `Could not complete task "${taskTitle}".`;
    } else if (res.requiresApproval) {
      reply = `Your request to mark "${taskTitle}" as completed has been submitted for ${targetOwnerName || 'Owner'} approval.`;
    } else {
      reply = `Great job! I've marked "${taskTitle}" as completed.`;
    }
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'complete_task',
      toolArgs: { taskTitle, targetOwnerName },
    };
  }

  // 6. Create / Update reminder (e.g. "Remind me tomorrow evening to finish the NeoCollab assignment")
  if (lower.includes('remind me') || lower.includes('set reminder') || lower.includes('create reminder')) {
    let taskTitle = 'NeoCollab info';
    if (lower.includes('dbms')) taskTitle = 'DBMS Assignment';
    else if (lower.includes('os lab') || lower.includes('operating systems')) taskTitle = 'Operating Systems Lab 3';
    else {
      const taskMatch = normalized.match(/(?:finish|about|for|to)\s+(?:the\s+)?([^.,]+)/i);
      if (taskMatch) taskTitle = taskMatch[1].trim();
    }

    const remindAt = parseNaturalDate(lower) || '2026-10-05T18:00:00.000Z';
    const label = lower.includes('tomorrow evening') ? 'Tomorrow evening' : 'Custom reminder';

    const res = await executeTool('create_or_update_reminder', { taskTitle, remindAt, label, targetOwnerName }, actor);
    const reply = res.success
      ? `I've set a reminder for "${taskTitle}" scheduled for ${new Date(remindAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
      : (res.error || 'Could not schedule reminder.');
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'create_or_update_reminder',
      toolArgs: { taskTitle, remindAt, label, targetOwnerName },
    };
  }

  // 7. Create task (e.g. "Create a new assignment called NeoCollab info due Friday")
  if (lower.includes('create') || lower.includes('new assignment') || lower.includes('new task') || lower.includes('add assignment') || lower.includes('add task')) {
    let title = 'NeoCollab info';
    const titleMatch = normalized.match(/(?:called|named)\s+["']?([^"'.,]+?)["']?\s+(?:due|by|for|with|$)/i) ||
                       normalized.match(/(?:task|assignment)\s+["']?([^"'.,]+?)["']?\s+(?:due|by|for|with|$)/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/^(called|named|a|an|new)\s+/i, '').trim();
    }

    const deadline = parseNaturalDate(lower) || '2026-10-09T23:59:00.000Z'; // default this Friday

    const res = await executeTool('create_task', {
      title,
      deadline,
      description: 'Created via Nudge Assistant natural language command.',
      targetOwnerName,
    }, actor);

    const reply = res.success
      ? `I've created the assignment "${title}" due ${new Date(deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.`
      : (res.error || 'Could not create task.');

    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'create_task',
      toolArgs: { title, deadline, targetOwnerName },
    };
  }

  // 8. Move deadline (e.g. "Move Muskan's DBMS deadline from October 20 to October 24", "Move my DBMS deadline to next Friday")
  if (lower.includes('move') || lower.includes('change deadline') || lower.includes('postpone') || lower.includes('reschedule') || (lower.includes('deadline') && (lower.includes('to') || lower.includes('from')))) {
    let taskTitle = 'DBMS Assignment';
    if (lower.includes('operating systems') || lower.includes('os lab')) taskTitle = 'Operating Systems Lab 3';
    else if (lower.includes('neocollab')) taskTitle = 'NeoCollab info';
    else if (lower.includes('distributed')) taskTitle = 'Distributed Systems Project Proposal';
    else {
      const match = normalized.match(/(?:move|reschedule|postpone)\s+(?:(?:my|muskan's|apoorv's)\s+)?["']?([^"'.,]+?)["']?\s+(?:deadline|to|from|$)/i);
      if (match && match[1].trim()) taskTitle = match[1].trim();
    }

    const newDeadline = parseNaturalDate(lower) || '2026-10-24T23:59:00.000Z';
    const res = await executeTool('update_deadline', { taskTitle, newDeadline, targetOwnerName }, actor);

    let reply = '';
    if (!res.success) {
      reply = res.error || `Could not update deadline for "${taskTitle}".`;
    } else if (res.requiresApproval) {
      reply = `As a Helper, your proposed deadline change for "${taskTitle}" to ${new Date(newDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} has been submitted for Owner approval.`;
    } else {
      reply = `I've moved the deadline for "${taskTitle}" to ${new Date(newDeadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. Associated reminders have been recalculated automatically.`;
    }

    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'update_deadline',
      toolArgs: { taskTitle, newDeadline, targetOwnerName },
    };
  }

  // 9. Get all tasks (e.g. "Show my tasks", "List tasks")
  if (lower.includes('my tasks') || lower.includes('all tasks') || lower.includes('list tasks') || lower.includes('show tasks')) {
    const res = await executeTool('get_my_tasks', { targetOwnerName }, actor);
    const tasks = res.tasks || [];
    const reply = tasks.length === 0
      ? 'You currently have no tasks.'
      : `Here are your current tasks:\n` + tasks.map(t => `• "${t.title}" — due ${new Date(t.deadline).toLocaleDateString()} (${t.status})`).join('\n');
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'get_my_tasks',
      toolArgs: { targetOwnerName },
    };
  }

  // 10. General / Ambiguous fallback with helpful guidance
  return {
    success: true,
    conversationalResponse: `I can help manage your tasks, upcoming deadlines, reminders, and trusted delegation. Try asking:\n• "What do I have due this week?"\n• "Create an assignment for NeoCollab info due Friday"\n• "I finished my DBMS assignment"\n• "Move Muskan's DBMS deadline to October 24"\n• "What has Apoorv changed recently?"\n• "Summarize my week"`,
    message: 'Nudge Assistant ready.',
  };
}

/**
 * Main General-Purpose AI Assistant handler.
 * Uses Google GenAI tool/function calling with fallback to deterministic tool execution.
 */
export async function processNudgeQuery(
  prompt: string,
  actor: ToolContextUser
): Promise<NudgeAssistantResult> {
  const cleanPrompt = prompt
    .replace(/[\u2018\u2019\u201A\u201B']/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F"]/g, '"')
    .trim();

  // If no AI client available, run through the tool router directly
  if (!aiClient) {
    return fallbackToolRouter(cleanPrompt, actor);
  }

  try {
    const allUsers = db.getUsers().map(u => u.name).join(', ');
    const myTasks = db.getTasks().filter(t => t.ownerId === actor.id).map(t => `"${t.title}" (due ${t.deadline})`).join(', ');
    const trustedCircle = db.getTrustedForOwner(actor.id).map(r => `${r.trustedUserName} (${r.role})`).join(', ');

    const systemInstruction = `You are Nudge, an intelligent personal productivity assistant with controlled access to application tools.
Current Reference Time: Sunday, October 4, 2026.
Authenticated User: "${actor.name}" (${actor.email}).
Registered Users: ${allUsers}.
User's Current Tasks: ${myTasks || 'None'}.
User's Trusted Circle: ${trustedCircle || 'None'}.

Instructions:
1. Always understand natural conversational phrasing, synonyms, and relative dates (e.g. "Friday" = 2026-10-09, "next Friday" = 2026-10-16, "tomorrow" = 2026-10-05, "this week" = Oct 4 to Oct 11, 2026).
2. Choose from the available tools (get_my_tasks, get_upcoming_tasks, get_overdue_tasks, get_task_details, get_notifications, get_recent_activity, get_trusted_people, get_schedule_summary, create_task, update_task, complete_task, reopen_task, update_deadline, create_or_update_reminder).
3. If the user does not specify a person (e.g. "What do I have due?", "Create an assignment"), the target is the current authenticated user "${actor.name}".
4. If the user mentions someone else (e.g. "Move Muskan's DBMS deadline"), set targetOwnerName to that person.
5. If the request is a general question that does not require a tool, reply politely and concisely.`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI assistant timeout')), 3500)
    );

    const response = await Promise.race([
      aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: cleanPrompt,
        config: {
          systemInstruction,
          temperature: 0.1,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        },
      }),
      timeoutPromise,
    ]);

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (!call.name) return fallbackToolRouter(cleanPrompt, actor);
      const toolName = call.name;
      const toolArgs = (call.args || {}) as Record<string, any>;

      // Execute tool deterministically on backend
      const toolResult = await executeTool(toolName, toolArgs, actor);

      // Formulate natural conversational answer
      let conversationalResponse = toolResult.message;
      if (toolName === 'get_upcoming_tasks' && toolResult.tasks) {
        if (toolResult.tasks.length === 0) {
          conversationalResponse = `You don't have any tasks due this week! Everything is clear.`;
        } else {
          conversationalResponse = `You have ${toolResult.tasks.length} task(s) due this week:\n` +
            toolResult.tasks.map(t => `• "${t.title}" — due ${new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`).join('\n');
        }
      } else if (toolName === 'get_schedule_summary' && toolResult.data) {
        conversationalResponse = `Here is your schedule summary for this week:\n` +
          `• Tasks due this week: ${toolResult.data.dueThisWeekCount}\n` +
          `• Overdue: ${toolResult.data.overdueCount}\n` +
          `• Active reminders: ${toolResult.data.activeRemindersCount}` +
          (toolResult.data.thisWeekTasks?.length ? `\n• Upcoming: ${toolResult.data.thisWeekTasks.map((t: any) => t.title).join(', ')}` : '');
      } else if (toolName === 'get_recent_activity' && toolResult.activityLogs) {
        conversationalResponse = toolResult.activityLogs.length === 0
          ? 'No recent activity records found.'
          : `Recent activity:\n` + toolResult.activityLogs.map(a => `• ${a.actorName} (${a.actorRole}): ${a.description}`).join('\n');
      } else if (toolName === 'complete_task') {
        conversationalResponse = toolResult.requiresApproval
          ? `Your change suggestion to complete "${toolArgs.taskTitle}" has been submitted for Owner approval.`
          : `Marked "${toolArgs.taskTitle}" as completed. Great job!`;
      } else if (toolName === 'update_deadline') {
        conversationalResponse = toolResult.requiresApproval
          ? `Your proposed deadline update for "${toolArgs.taskTitle}" has been submitted for Owner approval.`
          : `I've updated the deadline for "${toolArgs.taskTitle}" to ${new Date(toolArgs.newDeadline || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Associated reminders have been shifted automatically.`;
      } else if (toolName === 'create_task') {
        conversationalResponse = `Created new assignment "${toolArgs.title}" due ${new Date(toolArgs.deadline || Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}. Reminders are scheduled.`;
      }

      return {
        ...toolResult,
        conversationalResponse,
        toolUsed: toolName,
        toolArgs,
      };
    }

    // Direct conversational response from AI
    const replyText = response.text?.trim();
    if (replyText) {
      return {
        success: true,
        message: replyText,
        conversationalResponse: replyText,
      };
    }

    return fallbackToolRouter(cleanPrompt, actor);
  } catch (err) {
    console.warn('[AI] Error in LLM assistant, falling back to deterministic tool router:', err);
    return fallbackToolRouter(cleanPrompt, actor);
  }
}
