import React, { useState } from 'react';
import { 
  CheckSquare, 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  UserCheck, 
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Task, User } from '../types';

interface TasksViewProps {
  currentUser: User;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  currentUser,
  tasks,
  onSelectTask,
  onOpenNewTaskModal,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'shared' | 'completed'>('all');

  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchOwner = (task.ownerName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchOwner) return false;
    }

    // Tab filter
    if (filter === 'mine') return task.ownerId === currentUser.id;
    if (filter === 'shared') return task.ownerId !== currentUser.id;
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-display">Tasks & Deadlines</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage your personal schedule and tasks shared with your trusted circle.
          </p>
        </div>

        <button
          onClick={onOpenNewTaskModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Task
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-stone-200">
        {/* Interactive Filter Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-stone-900 text-white font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            All ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'mine' ? 'bg-stone-900 text-white font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            My Tasks ({tasks.filter(t => t.ownerId === currentUser.id).length})
          </button>
          <button
            onClick={() => setFilter('shared')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'shared' ? 'bg-stone-900 text-white font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            Shared With Me ({tasks.filter(t => t.ownerId !== currentUser.id).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filter === 'completed' ? 'bg-stone-900 text-white font-semibold shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            Completed ({tasks.filter(t => t.status === 'completed').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, descriptions..."
            className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-lg text-xs outline-none"
          />
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <CheckSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-stone-900">No tasks match your criteria</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or create a new assignment or milestone.
          </p>
          <button
            onClick={onOpenNewTaskModal}
            className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg"
          >
            Create Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map(task => {
            const isOwner = task.ownerId === currentUser.id;
            const deadlineObj = new Date(task.deadline);
            const isPast = deadlineObj.getTime() < Date.now();
            const formattedDate = deadlineObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-400 transition-all hover:shadow-xs group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top line metadata */}
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                      <span>{isOwner ? 'You (Owner)' : `Owner: ${task.ownerName}`}</span>
                    </div>

                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      task.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : task.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                    {task.title}
                  </h3>

                  {/* Description */}
                  {task.description && (
                    <p className="text-xs text-stone-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Footer metadata */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className={`w-3.5 h-3.5 ${isPast && task.status !== 'completed' ? 'text-rose-500' : 'text-stone-400'}`} />
                    <span className={`font-semibold ${isPast && task.status !== 'completed' ? 'text-rose-700 font-bold' : 'text-stone-700'}`}>
                      {formattedDate}
                    </span>
                    {isPast && task.status !== 'completed' && (
                      <span className="text-[10px] text-rose-600 font-medium">(Overdue)</span>
                    )}
                  </div>

                  {task.lastUpdatedByName && (
                    <span className="text-[11px] text-stone-600">
                      by <strong>{task.lastUpdatedByName}</strong>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
