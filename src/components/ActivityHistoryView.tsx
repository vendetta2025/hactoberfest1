import React, { useState } from 'react';
import { History, Search, ShieldCheck, UserCheck, Calendar, Filter } from 'lucide-react';
import { ActivityLog, User } from '../types';

interface ActivityHistoryViewProps {
  currentUser: User;
  activityLogs: ActivityLog[];
  onSelectTask?: (taskId: string) => void;
}

export const ActivityHistoryView: React.FC<ActivityHistoryViewProps> = ({
  currentUser,
  activityLogs,
  onSelectTask,
}) => {
  const [search, setSearch] = useState('');

  const filteredLogs = activityLogs.filter(log => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.actorName.toLowerCase().includes(q) ||
      log.taskTitle.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-display">Activity & Audit History</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Immutable log of every schedule adjustment, delegated action, and role update.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor or task..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 focus:border-stone-900 rounded-lg text-xs outline-none shadow-xs"
          />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <History className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-stone-900">No activity logs found</h3>
          <p className="text-xs text-stone-500 mt-1">Actions performed by you or your trusted circle appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs divide-y divide-stone-100 overflow-hidden">
          {filteredLogs.map(log => {
            const dateStr = new Date(log.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={log.id} className="p-4 sm:p-5 hover:bg-stone-50/60 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-stone-900">{log.actorName}</span>
                      <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                        {log.actorRole === 'PRIMARY_HELPER' ? 'Primary Helper' : log.actorRole}
                      </span>
                      <span className="text-stone-300">·</span>
                      <span className="text-xs font-semibold text-stone-800">
                        {log.taskTitle || 'Workspace'}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                      {log.description}
                    </p>

                    {/* Changes delta block */}
                    {log.changes && log.changes.length > 0 && log.changes.some(c => c.oldValue || c.newValue) && (
                      <div className="mt-2.5 space-y-1">
                        {log.changes.map((c, idx) => (
                          <div key={idx} className="inline-flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-[11px] mr-2">
                            <span className="text-stone-500 font-medium capitalize">{c.field}:</span>
                            {c.oldValue && (
                              <span className="text-stone-400 line-through">
                                {typeof c.oldValue === 'string' && c.oldValue.includes('T') ? new Date(c.oldValue).toLocaleDateString() : String(c.oldValue)}
                              </span>
                            )}
                            <span className="font-bold text-stone-900">
                              → {typeof c.newValue === 'string' && c.newValue.includes('T') ? new Date(c.newValue).toLocaleDateString() : String(c.newValue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-stone-400 shrink-0 sm:text-right mt-1 sm:mt-0">
                    <div>{dateStr}</div>
                    {log.taskId && onSelectTask && (
                      <button
                        onClick={() => onSelectTask(log.taskId)}
                        className="text-amber-800 hover:text-amber-950 font-medium underline mt-1 block"
                      >
                        Inspect Task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
