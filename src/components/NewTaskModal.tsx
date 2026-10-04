import React, { useState } from 'react';
import { X, Calendar, Plus } from 'lucide-react';
import { User, OwnerWhoTrustsMe } from '../types';
import { api } from '../api';

interface NewTaskModalProps {
  currentUser: User;
  whoTrustsMe: OwnerWhoTrustsMe[];
  onClose: () => void;
  onCreated: () => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  currentUser,
  whoTrustsMe,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('2026-10-25');
  const [targetOwnerId, setTargetOwnerId] = useState(currentUser.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter owners where currentUser is PRIMARY_HELPER
  const primaryHelperOwners = whoTrustsMe.filter(o => o.role === 'PRIMARY_HELPER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deadlineDate) return;

    setLoading(true);
    setError(null);

    try {
      const deadlineIso = new Date(`${deadlineDate}T23:59:00.000Z`).toISOString();
      await api.createTask({
        title: title.trim(),
        description: description.trim(),
        deadline: deadlineIso,
        targetOwnerId: targetOwnerId !== currentUser.id ? targetOwnerId : undefined,
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
          <h3 className="text-base font-bold text-stone-900 font-display">Create New Task</h3>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Create for whom? */}
          {primaryHelperOwners.length > 0 && (
            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Creating Task For:
              </label>
              <select
                value={targetOwnerId}
                onChange={(e) => setTargetOwnerId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900"
              >
                <option value={currentUser.id}>Myself ({currentUser.name})</option>
                {primaryHelperOwners.map(o => (
                  <option key={o.ownerId} value={o.ownerId}>
                    {o.ownerName} (as Primary Helper)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Systems Lab"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900 text-sm font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Deadline
            </label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900 text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Description & Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key deliverables, lecture slides, submission links..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900 resize-none text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-stone-600 hover:text-stone-900 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              {loading ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
