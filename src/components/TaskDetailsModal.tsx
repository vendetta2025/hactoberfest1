import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Trash2, 
  ShieldCheck, 
  UserCheck, 
  Check, 
  AlertTriangle,
  History,
  CheckCircle,
  Clock3
} from 'lucide-react';
import { Task, User, Reminder, ChangeRequest, ActivityLog } from '../types';
import { api } from '../api';

interface TaskDetailsModalProps {
  taskId: string;
  currentUser: User;
  onClose: () => void;
  onUpdated: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  taskId,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const [task, setTask] = useState<Task | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');

  const loadDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getTask(taskId);
      setTask(res.task);
      setReminders(res.reminders);
      setChangeRequests(res.changeRequests);

      setTitle(res.task.title);
      setDescription(res.task.description || '');
      // Format to YYYY-MM-DD for date input
      const dateObj = new Date(res.task.deadline);
      setDeadlineDate(dateObj.toISOString().split('T')[0]);
      setStatus(res.task.status);

      // Load task activity
      const allLogs = await api.getActivityLogs();
      setActivityLogs(allLogs.filter(l => l.taskId === taskId));
    } catch (err: any) {
      setError(err.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [taskId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 text-center shadow-xl">
          <div className="animate-spin w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-stone-500 font-medium">Loading task details…</p>
        </div>
      </div>
    );
  }

  if (!task) return null;

  const isOwner = task.ownerId === currentUser.id;
  const isPrimaryHelper = task.userRoleForTask === 'PRIMARY_HELPER';
  const isHelper = task.userRoleForTask === 'HELPER';
  const canDirectlyModify = isOwner || isPrimaryHelper;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const fullDeadline = new Date(`${deadlineDate}T23:59:00.000Z`).toISOString();
      await api.updateTask(task.id, {
        title,
        description,
        deadline: fullDeadline,
        status,
      });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) {
      alert('Only the Owner can permanently delete this task.');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;

    try {
      await api.deleteTask(task.id);
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleReviewChangeRequest = async (crId: string, approve: boolean) => {
    try {
      await api.reviewChangeRequest(crId, approve);
      await loadDetails();
      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to review change request');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Task Details</span>
            <span className="text-stone-300">·</span>
            <div className="flex items-center gap-1.5 text-xs text-stone-700">
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Owner: <strong>{task.ownerName}</strong></span>
            </div>
            {isPrimaryHelper && (
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                You: Primary Helper (Direct Authority)
              </span>
            )}
            {isHelper && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                You: Helper (Changes Require Approval)
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-100 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canDirectlyModify && !isHelper}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl text-sm font-medium text-stone-900 outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Description & Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canDirectlyModify && !isHelper}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl text-sm text-stone-900 outline-none resize-none"
              placeholder="Add key milestones, links, or notes..."
            />
          </div>

          {/* Deadline & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Deadline
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  disabled={!canDirectlyModify && !isHelper}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl text-sm text-stone-900 outline-none"
                  required
                />
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Reminders recalculate automatically when deadline changes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                disabled={!canDirectlyModify && !isHelper}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl text-sm text-stone-900 outline-none"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Computed Reminders section */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                Active Reminders for Owner
              </span>
              <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                Synced with deadline
              </span>
            </div>

            {reminders.length === 0 ? (
              <p className="text-xs text-stone-600">No scheduled reminders currently.</p>
            ) : (
              <div className="space-y-1.5">
                {reminders.map(rem => (
                  <div key={rem.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-stone-100">
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-medium text-stone-900">{rem.label}</span>
                      <span className="text-stone-400">·</span>
                      <span className="text-stone-600">
                        {new Date(rem.remindAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-600 capitalize">
                      {rem.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Change Requests (Helper flow) */}
          {changeRequests.filter(cr => cr.status === 'pending').length > 0 && (
            <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
                Pending Change Requests (From Helpers)
              </h4>
              <div className="space-y-2">
                {changeRequests.filter(cr => cr.status === 'pending').map(cr => (
                  <div key={cr.id} className="bg-white p-3 rounded-lg border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-stone-900">
                        {cr.requesterName} proposed a new deadline:
                      </div>
                      <div className="text-amber-800 font-medium mt-0.5">
                        {cr.proposedDeadline ? new Date(cr.proposedDeadline).toLocaleDateString() : 'Update details'}
                      </div>
                      {cr.notes && <p className="text-stone-500 text-[11px] mt-1 italic">"{cr.notes}"</p>}
                    </div>

                    {isOwner ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReviewChangeRequest(cr.id, true)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewChangeRequest(cr.id, false)}
                          className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-stone-500 italic">Awaiting Owner decision</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task Activity Trail */}
          {activityLogs.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                <History className="w-3.5 h-3.5 text-stone-500" />
                <span>Task History</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {activityLogs.map(log => (
                  <div key={log.id} className="text-[11px] bg-stone-50 p-2 rounded-lg border border-stone-100 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-stone-900">{log.actorName}</span>
                      <span className="text-stone-400"> ({log.actorRole})</span>: {log.description}
                    </div>
                    <span className="text-stone-400 text-[10px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {isOwner ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Task
                </button>
              ) : (
                <div className="text-[11px] text-stone-600 italic">
                  Deletion is Owner-only. Primary Helpers cannot permanently delete tasks.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
              >
                {saving ? 'Saving…' : isHelper ? 'Submit Changes for Approval' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
