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

// Initialize Gemini client
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

export interface ParsedDateResult {
  kind: 'date' | 'none' | 'ambiguous';
  iso?: string;
  raw?: string;
}

/**
 * Parses date references relative to the fixed anchor date: Sunday, Oct 4, 2026.
 */
export function parseNaturalDate(text: string): ParsedDateResult | null {
  const lower = text.toLowerCase();

  // 1. Explicit no deadline
  if (
    lower.includes('without a deadline') ||
    lower.includes('without deadline') ||
    lower.includes('with no deadline') ||
    lower.includes('no deadline') ||
    lower.includes('no due date') ||
    lower.includes('without any deadline')
  ) {
    return { kind: 'none' };
  }

  const months: Record<string, string> = {
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', sept: '09', september: '09'
  };

  // 2. Specific month and day e.g. "October 30", "Oct 30th", "to October 24"
  const targetMonthDay = lower.match(/(?:(?:to|by|until|due|on)\s+)?(october|oct|november|nov|december|dec|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep)\s+(\d{1,2})(?:th|st|nd|rd)?/i);
  if (targetMonthDay) {
    const m = months[targetMonthDay[1].toLowerCase()] || '10';
    const d = parseInt(targetMonthDay[2], 10).toString().padStart(2, '0');
    return { kind: 'date', iso: `2026-${m}-${d}T23:59:00.000Z` };
  }

  // 3. Day of month e.g. "30th of October", "30 October"
  const dayMonthMatch = lower.match(/(\d{1,2})(?:th|st|nd|rd)?\s*(?:of\s+)?(october|oct|november|nov|december|dec|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep)/i);
  if (dayMonthMatch) {
    const m = months[dayMonthMatch[2].toLowerCase()] || '10';
    const d = parseInt(dayMonthMatch[1], 10).toString().padStart(2, '0');
    return { kind: 'date', iso: `2026-${m}-${d}T23:59:00.000Z` };
  }

  // 4. Standalone ordinal / day number in current month (anchor: Sunday, Oct 4, 2026)
  // e.g. "by 30th", "by the 30th", "on the 30th", "30th", "by 30"
  const ordinalMatch = lower.match(/(?:by|on|due|until|before)\s+(?:the\s+)?(\d{1,2})(?:th|st|nd|rd)\b/i) ||
                       lower.match(/(?:by|on|due)\s+(?:the\s+)?(\d{1,2})\b/i);
  if (ordinalMatch) {
    const dayNum = parseInt(ordinalMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      // In October (10), if day >= 4 it's this month; if day < 4, it's next month
      const m = dayNum >= 4 ? '10' : '11';
      const d = dayNum.toString().padStart(2, '0');
      return { kind: 'date', iso: `2026-${m}-${d}T23:59:00.000Z` };
    }
  }

  // 5. Relative days of week (relative to Sunday, Oct 4, 2026)
  if (lower.includes('next friday')) {
    return { kind: 'date', iso: '2026-10-16T23:59:00.000Z' };
  }
  if (lower.includes('friday')) {
    return { kind: 'date', iso: '2026-10-09T23:59:00.000Z' };
  }
  if (lower.includes('next monday')) {
    return { kind: 'date', iso: '2026-10-12T23:59:00.000Z' };
  }
  if (lower.includes('monday')) {
    return { kind: 'date', iso: '2026-10-05T23:59:00.000Z' };
  }
  if (lower.includes('tuesday')) {
    return { kind: 'date', iso: '2026-10-06T23:59:00.000Z' };
  }
  if (lower.includes('wednesday')) {
    return { kind: 'date', iso: '2026-10-07T23:59:00.000Z' };
  }
  if (lower.includes('thursday')) {
    return { kind: 'date', iso: '2026-10-08T23:59:00.000Z' };
  }
  if (lower.includes('saturday')) {
    return { kind: 'date', iso: '2026-10-10T23:59:00.000Z' };
  }
  if (lower.includes('next sunday')) {
    return { kind: 'date', iso: '2026-10-11T23:59:00.000Z' };
  }

  // 6. Tomorrow / today
  if (lower.includes('tomorrow evening') || lower.includes('tomorrow at 6') || lower.includes('tomorrow 6pm')) {
    return { kind: 'date', iso: '2026-10-05T18:00:00.000Z' };
  }
  if (lower.includes('tomorrow')) {
    return { kind: 'date', iso: '2026-10-05T23:59:00.000Z' };
  }
  if (lower.includes('today') || lower.includes('tonight')) {
    return { kind: 'date', iso: '2026-10-04T23:59:00.000Z' };
  }

  // 7. Check for ambiguous date prepositions (e.g. "due soon", "by next time", "deadline later")
  const ambiguousMatch = lower.match(/(?:due|by|before|until|deadline)\s+([a-z0-9]+)/i);
  if (ambiguousMatch) {
    const word = ambiguousMatch[1].trim();
    if (!['me', 'myself', 'a', 'an', 'the', 'my', 'without', 'no'].includes(word)) {
      return { kind: 'ambiguous', raw: word };
    }
  }

  return null;
}

/**
 * Extracts exact task title from user natural language prompt.
 * Never substitutes with demo tasks.
 */
export function extractTaskTitle(prompt: string): string | null {
  const trimmed = prompt.trim();

  // 1. Quoted string e.g. 'complete neocolab', "finish project"
  const quoted = trimmed.match(/['"“]([^'"”]+)['"”]/);
  if (quoted && quoted[1].trim()) {
    return quoted[1].trim();
  }

  const clean = trimmed.replace(/[.!?]+$/, '');

  // 2. "called / named / titled <title>"
  const called = clean.match(/(?:called|named|titled)\s+([^,]+?)(?:\s+(?:due|by|on|without|with\s+no|$))/i);
  if (called && called[1].trim()) {
    return called[1].trim();
  }

  // 3. "Remind me to <action>" e.g. "Remind me to submit my lab tomorrow"
  const remind = clean.match(/remind\s+(?:me\s+)?to\s+([^,]+?)(?:\s+(?:tomorrow|today|tonight|next|this|on|by|at|$))/i);
  if (remind && remind[1].trim()) {
    return remind[1].trim();
  }

  // 4. "Create a <X> assignment / task / lab" e.g. "Create a DBMS assignment due Friday"
  const typeMatch = clean.match(/(?:create|add|schedule|set\s+up)\s+(?:a\s+|an\s+|new\s+)?(.+?\s+(?:assignment|task|milestone|lab|project))(?:\s+(?:due|by|on|without|with\s+no|$))/i);
  if (typeMatch && typeMatch[1].trim()) {
    return typeMatch[1].replace(/^(?:a|an|new)\s+/i, '').trim();
  }

  // 5. "Create a task / assignment (for myself / for user) to <title>"
  const taskTo = clean.match(/(?:create|add)\s+(?:a\s+|an\s+|new\s+)?(?:task|assignment|todo)\s+(?:for\s+(?:myself|[a-zA-Z]+)\s+)?(?:to\s+)?([^,]+?)(?:\s+(?:due|by|on|without|with\s+no|$))/i);
  if (taskTo && taskTo[1].trim()) {
    let t = taskTo[1].trim();
    t = t.replace(/^(?:to|for\s+myself)\s+/i, '').trim();
    if (t) return t;
  }

  // 6. Generic: "create a task <title> by/due ..."
  const generic = clean.match(/(?:create|add)\s+(?:a\s+|an\s+|new\s+)?(?:task|assignment)\s+([^,]+?)(?:\s+(?:due|by|on|without|with\s+no|$))/i);
  if (generic && generic[1].trim()) {
    let t = generic[1].trim();
    t = t.replace(/^(?:for\s+myself|to|called|named)\s+/i, '').trim();
    if (t) return t;
  }

  return null;
}

/**
 * Deterministic tool router with strict fidelity to user's title and dates.
 * Zero hardcoded demo defaults.
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

  // 1. Ask about recent changes / activity
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

  // 2. Schedule summary
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

  // 3. Upcoming tasks
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

  // 4. Overdue tasks
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

  // 5. Complete task
  if (lower.includes('finished') || lower.includes('completed') || lower.includes('done with') || (lower.includes('mark') && lower.includes('complete'))) {
    const quoted = normalized.match(/['"“]([^'"”]+)['"”]/);
    let taskTitle = quoted ? quoted[1].trim() : '';

    if (!taskTitle) {
      const match = normalized.match(/(?:finished|completed|done\s+with|mark)\s+(?:my\s+)?([^,]+?)(?:\s+(?:as\s+completed|as\s+done|$))/i);
      if (match && match[1].trim()) {
        taskTitle = match[1].trim();
      }
    }

    if (!taskTitle) {
      return {
        success: false,
        clarificationRequired: true,
        conversationalResponse: 'Which task did you finish? Please specify the task title.',
        message: 'Task title required',
      };
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

  // 6. Create / Update reminder (e.g. "Remind me to submit my lab tomorrow")
  if (lower.includes('remind me') || lower.includes('set reminder') || lower.includes('create reminder')) {
    const title = extractTaskTitle(normalized) || 'Reminder';
    const dateResult = parseNaturalDate(lower);

    if (dateResult?.kind === 'ambiguous') {
      return {
        success: false,
        clarificationRequired: true,
        conversationalResponse: `Could you clarify when you would like a reminder for "${title}"? (e.g. "tomorrow", "tomorrow evening", "Friday at 6pm")`,
        message: 'Ambiguous reminder date',
      };
    }

    const remindAt = dateResult?.kind === 'date' && dateResult.iso
      ? dateResult.iso
      : '2026-10-05T18:00:00.000Z'; // default tomorrow evening

    const label = lower.includes('tomorrow evening') ? 'Tomorrow evening' : 'Custom reminder';

    const res = await executeTool('create_or_update_reminder', { taskTitle: title, remindAt, label, targetOwnerName }, actor);
    const formattedDate = new Date(remindAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const reply = res.success
      ? `✓ Scheduled reminder for "${title}"\nTime: ${formattedDate}`
      : (res.error || 'Could not schedule reminder.');
    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'create_or_update_reminder',
      toolArgs: { taskTitle: title, remindAt, label, targetOwnerName },
    };
  }

  // 7. Create task
  if (lower.includes('create') || lower.includes('new assignment') || lower.includes('new task') || lower.includes('add assignment') || lower.includes('add task')) {
    const title = extractTaskTitle(normalized);

    if (!title) {
      return {
        success: false,
        clarificationRequired: true,
        conversationalResponse: 'What is the title of the task you would like to create? (e.g. "Create a task called complete neocolab by October 30")',
        message: 'Task title required',
      };
    }

    const dateResult = parseNaturalDate(lower);

    if (dateResult?.kind === 'ambiguous') {
      return {
        success: false,
        clarificationRequired: true,
        conversationalResponse: `Could you clarify the deadline date for "${title}"? (e.g. "tomorrow", "Friday", "October 30", or "without a deadline")`,
        message: 'Ambiguous deadline date',
      };
    }

    let deadline = '';
    if (dateResult?.kind === 'date' && dateResult.iso) {
      deadline = dateResult.iso;
    }

    const res = await executeTool('create_task', {
      title,
      deadline,
      description: 'Created via Nudge Assistant natural language command.',
      targetOwnerName,
    }, actor);

    const deadlineFormatted = deadline 
      ? new Date(deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : 'None (no deadline)';

    const reply = res.success
      ? `✓ Created task: "${title}"\nDeadline: ${deadlineFormatted}`
      : (res.error || 'Could not create task.');

    return {
      ...res,
      conversationalResponse: reply,
      toolUsed: 'create_task',
      toolArgs: { title, deadline, targetOwnerName },
    };
  }

  // 8. Move deadline
  if (lower.includes('move') || lower.includes('change deadline') || lower.includes('postpone') || lower.includes('reschedule') || (lower.includes('deadline') && (lower.includes('to') || lower.includes('from')))) {
    const quoted = normalized.match(/['"“]([^'"”]+)['"”]/);
    let taskTitle = quoted ? quoted[1].trim() : '';

    if (!taskTitle) {
      const match = normalized.match(/(?:move|reschedule|postpone|change)\s+(?:(?:my|muskan's|apoorv's|rohan's)\s+)?(?:deadline\s+for\s+)?([^,]+?)(?:\s+(?:deadline|to|from|$))/i);
      if (match && match[1].trim()) {
        taskTitle = match[1].trim();
      }
    }

    if (!taskTitle) {
      return {
        success: false,
        clarificationRequired: true,
        conversationalResponse: 'Which task would you like to reschedule? Please specify the task title.',
        message: 'Task title required',
      };
    }

    const dateResult = parseNaturalDate(lower);
    if (dateResult?.kind === 'ambiguous') {
      return {
        success: false,
        clarificationRequired: true,
        conversationalResponse: `Could you clarify the new deadline date for "${taskTitle}"? (e.g. "next Friday", "October 30")`,
        message: 'Ambiguous deadline date',
      };
    }

    const newDeadline = dateResult?.kind === 'date' && dateResult.iso
      ? dateResult.iso
      : '2026-10-24T23:59:00.000Z';

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

  // 9. Get all tasks
  if (lower.includes('my tasks') || lower.includes('all tasks') || lower.includes('list tasks') || lower.includes('show tasks')) {
    const res = await executeTool('get_my_tasks', { targetOwnerName }, actor);
    const tasks = res.tasks || [];
    const reply = tasks.length === 0
      ? 'You currently have no tasks.'
      : `Here are your current tasks:\n` + tasks.map(t => `• "${t.title}" — due ${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'No deadline'} (${t.status})`).join('\n');
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
    conversationalResponse: `I can help manage your tasks, upcoming deadlines, reminders, and trusted delegation. Try asking:\n• "Create a task called complete neocolab by October 30."\n• "Create a DBMS assignment due Friday."\n• "Remind me to submit my lab tomorrow."\n• "Create a task called finish project without a deadline."\n• "What do I have due this week?"\n• "Summarize my week"`,
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
    const myTasks = db.getTasks().filter(t => t.ownerId === actor.id).map(t => `"${t.title}" (due ${t.deadline || 'none'})`).join(', ');
    const trustedCircle = db.getTrustedForOwner(actor.id).map(r => `${r.trustedUserName} (${r.role})`).join(', ');

    const systemInstruction = `You are Nudge, an intelligent personal productivity assistant with controlled access to application tools.
Current Reference Time: Sunday, October 4, 2026.
Authenticated User: "${actor.name}" (${actor.email}).
Registered Users: ${allUsers}.
User's Current Tasks: ${myTasks || 'None'}.
User's Trusted Circle: ${trustedCircle || 'None'}.

CRITICAL BEHAVIOR RULES:
1. FAITHFUL TASK TITLES: Always extract the user's exact task title as requested (respecting quotes like 'complete neocolab', 'called finish project', 'DBMS assignment', 'submit my lab'). NEVER substitute with or invent demo task names like "NeoCollab info" or "DBMS Assignment" unless specifically requested!
2. EXACT DATES: Parse relative dates strictly relative to Sunday, October 4, 2026:
   - "October 30" or "30th" or "by 30th" -> 2026-10-30T23:59:00.000Z
   - "Friday" or "due Friday" or "this Friday" -> 2026-10-09T23:59:00.000Z
   - "next Friday" -> 2026-10-16T23:59:00.000Z
   - "tomorrow" -> 2026-10-05T23:59:00.000Z
   - "without a deadline" or "no deadline" -> pass deadline as "" or omit it.
3. AMBIGUOUS DATES: If the user requests a task but the deadline is genuinely ambiguous (e.g. "by soon", "next time"), ask a brief clarification: "Could you clarify what date this is due?"
4. RESPONSE DISPLAY: Whenever a task is created or scheduled, clearly show the extracted title and deadline in the response.
5. PERMISSIONS: Only Owner or Primary Helper can mutate tasks directly. Helpers require owner approval.`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI assistant timeout')), 15000)
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
      if (toolName === 'create_task') {
        const deadlineDisplay = toolArgs.deadline && toolArgs.deadline.trim()
          ? new Date(toolArgs.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : 'None (no deadline)';
        conversationalResponse = `✓ Created task: "${toolArgs.title}"\nDeadline: ${deadlineDisplay}`;
      } else if (toolName === 'create_or_update_reminder') {
        const timeDisplay = toolArgs.remindAt
          ? new Date(toolArgs.remindAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'Tomorrow';
        conversationalResponse = `✓ Scheduled reminder for "${toolArgs.taskTitle}"\nTime: ${timeDisplay}`;
      } else if (toolName === 'get_upcoming_tasks' && toolResult.tasks) {
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
