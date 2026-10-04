import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  Bell, 
  History, 
  Plus, 
  ArrowUpRight, 
  AlertCircle, 
  CheckCircle, 
  Sparkles,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  Play
} from 'lucide-react';
import { Task, Reminder, Notification, ActivityLog, TrustedRelationship, User } from '../types';
import { CommandBar } from './CommandBar';

interface DashboardViewProps {
  currentUser: User;
  tasks: Task[];
  reminders: Reminder[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  trustedPeople: TrustedRelationship[];
  onSelectTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  onRunDemoScenario: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  tasks,
  reminders,
  notifications,
  activityLogs,
  trustedPeople,
  onSelectTask,
  onOpenNewTaskModal,
  onRefresh,
  onNavigateTab,
  onRunDemoScenario,
}) => {
  const primaryHelper = trustedPeople.find(p => p.role === 'PRIMARY_HELPER');
  const otherHelpers = trustedPeople.filter(p => p.role === 'HELPER');

  // Filter tasks
  const now = new Date();
  const upcomingTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const overdueTasks = upcomingTasks.filter(t => new Date(t.deadline).getTime() < now.getTime());
  const activeUpcoming = upcomingTasks.filter(t => new Date(t.deadline).getTime() >= now.getTime());

  // Today / upcoming reminders
  const activeReminders = reminders
    .filter(r => r.status === 'scheduled')
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

  const unreadNotifs = notifications.filter(n => !n.read);

  // Time remaining helper
  const getDaysRemaining = (isoDate: string) => {
    const diff = new Date(isoDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Tomorrow';
    return `${days} days left`;
  };

  return (
    <div className="space-y-8">
      {/* 1. Natural Language Command Bar */}
      <CommandBar 
        currentUser={currentUser} 
        onActionComplete={onRefresh} 
        onSelectTask={onSelectTask}
      />

      {/* 2. Canonical Story Spotlight Banner */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-2xl p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">
                  Core Demo Walkthrough
                </span>
                <span className="text-xs text-stone-600 font-medium">Muskan & Apoorv Story</span>
              </div>
              <p className="text-sm font-semibold text-stone-900 mt-1">
                “Move Muskan’s DBMS deadline from October 20 to October 24.”
              </p>
              <p className="text-xs text-stone-600 mt-0.5">
                Apoorv acts as Primary Helper. Nudge parses intent via open-weight AI, enforces delegated trust without requiring Muskan's manual sign-off, shifts reminders, and logs an audit trail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRunDemoScenario}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Canonical 8-Step Story
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Tasks & Deadlines */}
        <div className="lg:col-span-2 space-y-8">
          {/* Upcoming Deadlines Widget */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-stone-700" />
                <h3 className="text-base font-bold text-stone-900 font-display">Upcoming Deadlines</h3>
                <span className="text-xs text-stone-600 font-medium ml-1">
                  ({upcomingTasks.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenNewTaskModal}
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Task
                </button>
                <button
                  onClick={() => onNavigateTab('tasks')}
                  className="text-xs font-semibold text-stone-600 hover:text-stone-900 px-2 py-1 rounded"
                >
                  View All
                </button>
              </div>
            </div>

            {/* Overdue alert if any */}
            {overdueTasks.length > 0 && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span className="font-semibold">{overdueTasks.length} task(s) past deadline.</span>
                </div>
                <button
                  onClick={() => onNavigateTab('tasks')}
                  className="underline font-semibold hover:text-rose-950"
                >
                  Review
                </button>
              </div>
            )}

            {upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-stone-600 text-xs">
                No pending deadlines! All caught up.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {upcomingTasks.slice(0, 4).map(task => {
                  const deadlineStr = new Date(task.deadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  });
                  const isDbms = task.title.includes('DBMS');

                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task.id)}
                      className="py-3.5 flex items-center justify-between gap-4 group cursor-pointer hover:bg-stone-50/80 -mx-2 px-2 rounded-xl transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-stone-900 group-hover:text-amber-800 transition-colors truncate">
                            {task.title}
                          </h4>
                          {isDbms && (
                            <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              Demo Target
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-stone-600">
                          <span>Owner: {task.ownerName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-stone-700 font-medium">Due {deadlineStr}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[11px] font-medium text-stone-700">{getDaysRemaining(task.deadline)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {task.lastUpdatedRole && (
                          <span className="text-[11px] text-stone-600 hidden sm:inline">
                            Modified by: <strong>{task.lastUpdatedByName}</strong> ({task.lastUpdatedRole === 'PRIMARY_HELPER' ? 'Primary Helper' : task.lastUpdatedRole})
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-600 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's & Upcoming Reminders */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-stone-700" />
                <h3 className="text-base font-bold text-stone-900 font-display">Active Scheduled Reminders</h3>
              </div>
              <span className="text-xs text-stone-600 font-medium">
                Auto-recalculated on deadline shifts
              </span>
            </div>

            {activeReminders.length === 0 ? (
              <p className="text-xs text-stone-600 py-3">No reminders scheduled.</p>
            ) : (
              <div className="space-y-2.5">
                {activeReminders.slice(0, 3).map(rem => (
                  <div
                    key={rem.id}
                    onClick={() => onSelectTask(rem.taskId)}
                    className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200/80 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-semibold text-stone-900">{rem.taskTitle}</span>
                        <div className="text-[11px] text-stone-600 mt-0.5">
                          {rem.label} · Scheduled for {new Date(rem.remindAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Trusted People & Notifications & Activity */}
        <div className="space-y-8">
          {/* Trusted Circle Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-stone-700" />
                <h3 className="text-base font-bold text-stone-900 font-display">Trusted People</h3>
              </div>
              <button
                onClick={() => onNavigateTab('trusted')}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                Manage
              </button>
            </div>

            {/* Primary Helper Showcase */}
            {primaryHelper ? (
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                    Primary Helper · Delegated Trust
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="text-sm font-bold text-stone-900">{primaryHelper.trustedUserName}</div>
                <p className="text-[11px] text-emerald-900 mt-1 leading-snug">
                  Can reschedule deadlines and update reminders without waiting for owner approval.
                </p>
              </div>
            ) : (
              <div className="bg-stone-50 border border-dashed border-stone-300 rounded-xl p-3.5 text-center text-xs text-stone-600 mb-3">
                No Primary Helper designated.
                <button
                  onClick={() => onNavigateTab('trusted')}
                  className="block mt-1 font-semibold text-amber-700 underline mx-auto"
                >
                  Assign Primary Helper
                </button>
              </div>
            )}

            {/* Other Helpers */}
            {otherHelpers.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">
                  Helpers (Approval Required):
                </span>
                {otherHelpers.map(h => (
                  <div key={h.id} className="text-xs flex items-center justify-between bg-stone-50 p-2 rounded-lg">
                    <span className="font-medium text-stone-800">{h.trustedUserName}</span>
                    <span className="text-[10px] text-stone-600">Requires Approval</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent In-App Notifications */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-stone-700" />
                <h3 className="text-base font-bold text-stone-900 font-display">Notifications</h3>
                {unreadNotifs.length > 0 && (
                  <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-amber-600 rounded-full">
                    {unreadNotifs.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => onNavigateTab('notifications')}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                View All
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-stone-600 py-3">No notifications yet.</p>
            ) : (
              <div className="space-y-2.5">
                {notifications.slice(0, 3).map(n => (
                  <div
                    key={n.id}
                    onClick={() => onNavigateTab('notifications')}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      !n.read 
                        ? 'bg-amber-50/60 border-amber-200' 
                        : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-stone-900">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-stone-600 font-normal">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-stone-600 mt-1 whitespace-pre-line leading-relaxed text-[11px]">
                      {n.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Audit Trail */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-stone-700" />
                <h3 className="text-base font-bold text-stone-900 font-display">Audit History</h3>
              </div>
              <button
                onClick={() => onNavigateTab('activity')}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                Full Trail
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-xs text-stone-600 py-3">No actions logged yet.</p>
            ) : (
              <div className="space-y-2">
                {activityLogs.slice(0, 4).map(log => (
                  <div key={log.id} className="text-xs border-l-2 border-amber-400 pl-3 py-1">
                    <div className="font-semibold text-stone-900">
                      {log.actorName} <span className="text-[10px] font-normal text-stone-600">({log.actorRole})</span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">{log.description}</p>
                    <span className="text-[10px] text-stone-600">
                      {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
