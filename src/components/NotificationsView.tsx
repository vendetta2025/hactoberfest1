import React, { useState } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  UserCheck, 
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';
import { Notification, User } from '../types';
import { api } from '../api';

interface NotificationsViewProps {
  currentUser: User;
  notifications: Notification[];
  onRefresh: () => void;
  onSelectTask?: (taskId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  currentUser,
  notifications,
  onRefresh,
  onSelectTask,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const handleMarkAsRead = async (id: string) => {
    await api.markNotificationRead(id);
    onRefresh();
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    onRefresh();
  };

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio not allowed yet by user interaction.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-display">In-App Notifications</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time notifications whenever a Primary Helper or Helper adjusts your schedule.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 text-stone-700 hover:text-stone-900 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Notification Sound Chime"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-600" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
            <span>Chime {soundEnabled ? 'On' : 'Off'}</span>
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={notifications.filter(n => !n.read).length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-stone-900 text-white font-semibold' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            filter === 'unread' ? 'bg-stone-900 text-white font-semibold' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Unread ({notifications.filter(n => !n.read).length})
        </button>
      </div>

      {/* Notifications List */}
      {filteredNotifs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Bell className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-stone-900">No notifications</h3>
          <p className="text-xs text-stone-500 mt-1">
            {filter === 'unread' ? 'You have reviewed all updates.' : 'No activity has been recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map(n => {
            const isUnread = !n.read;
            const timeFormatted = new Date(n.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isUnread
                    ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                    : 'bg-white border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isUnread ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {n.type === 'DEADLINE_CHANGED' ? (
                        <Calendar className="w-4 h-4" />
                      ) : n.type === 'APPROVAL_REQUEST' ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-stone-900">{n.title}</h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                        )}
                        <span className="text-[11px] text-stone-400">· {timeFormatted}</span>
                      </div>

                      <p className="text-xs text-stone-700 mt-1 whitespace-pre-line leading-relaxed font-normal">
                        {n.message}
                      </p>

                      {/* Precise Before & After Delta Box */}
                      {n.details && (n.details.oldValue || n.details.newValue) && (
                        <div className="mt-2.5 inline-flex items-center gap-2 bg-white/90 border border-stone-200/90 rounded-lg px-2.5 py-1 text-xs">
                          <span className="text-stone-500 font-medium">{n.details.field}:</span>
                          <span className="text-stone-400 line-through">{n.details.oldValue}</span>
                          <span className="font-bold text-stone-900">→ {n.details.newValue}</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-500">
                        <span>Actor: <strong>{n.actorName}</strong> ({n.actorRole})</span>
                        {n.taskId && onSelectTask && (
                          <button
                            onClick={() => onSelectTask(n.taskId)}
                            className="font-semibold text-amber-800 hover:text-amber-950 underline"
                          >
                            Open Task
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
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
