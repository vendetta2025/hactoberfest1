import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Bell, 
  RotateCcw, 
  Cpu, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Loader2,
  Check,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../api';
import { 
  getPushState, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  type PushPermissionState 
} from '../pushManager';

interface SettingsViewProps {
  currentUser: UserType;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onRefresh,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [advanceHours, setAdvanceHours] = useState(currentUser.reminderAdvanceHours || 24);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Web Push state
  const [pushState, setPushState] = useState<PushPermissionState>('not_enabled');
  const [pushLoading, setPushLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load push subscription status on mount
  useEffect(() => {
    getPushState().then((state) => {
      setPushState(state);
    });
  }, [currentUser.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        name,
        reminderAdvanceHours: advanceHours,
        browserNotificationsEnabled: pushState === 'enabled',
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushFeedback(null);

    try {
      if (pushState === 'enabled') {
        const res = await unsubscribeFromPushNotifications();
        setPushState(res.state);
        setPushFeedback({
          type: 'success',
          message: 'Web Push notifications disabled for this device.',
        });
      } else {
        const res = await subscribeToPushNotifications();
        setPushState(res.state);
        if (res.success) {
          setPushFeedback({
            type: 'success',
            message: 'Real Web Push background notifications enabled! You will receive alerts even when this tab is closed.',
          });
        } else {
          setPushFeedback({
            type: 'error',
            message: res.error || 'Could not enable notifications.',
          });
        }
      }
      onRefresh();
    } catch (err: any) {
      setPushFeedback({
        type: 'error',
        message: err.message || 'An error occurred during notification setup.',
      });
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestSending(true);
    setPushFeedback(null);
    try {
      const res = await api.sendTestPushNotification();
      setPushFeedback({
        type: 'success',
        message: res.message || 'Test Web Push notification sent through server VAPID delivery!',
      });
    } catch (err: any) {
      setPushFeedback({
        type: 'error',
        message: err.message || 'Failed to send test push notification.',
      });
    } finally {
      setTestSending(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Reset workspace database to initial demo state? All custom tasks will revert to the initial seeds.')) {
      return;
    }

    setResetting(true);
    try {
      await api.resetDemo();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reset demo');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 font-display">Account & Preferences</h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Configure real background Web Push notifications, reminder offsets, and system preferences.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {resetSuccess && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600" />
          <span>Demo database restored to initial state.</span>
        </div>
      )}

      {/* 1. Real Web Push Notifications Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Background Web Push Notifications
              </h3>
              <p className="text-[11px] text-stone-500">
                Standard Web Push API with Service Worker and VAPID. Delivers notifications even when Nudgify is closed.
              </p>
            </div>
          </div>

          {/* State Badge */}
          <div>
            {pushState === 'enabled' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Enabled
              </span>
            )}
            {pushState === 'not_enabled' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700">
                <span className="w-2 h-2 rounded-full bg-stone-400" />
                Not enabled
              </span>
            )}
            {pushState === 'denied' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                <XCircle className="w-3.5 h-3.5" />
                Permission denied
              </span>
            )}
            {pushState === 'unsupported' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                Unsupported browser
              </span>
            )}
          </div>
        </div>

        {/* Feedback alert */}
        {pushFeedback && (
          <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
            pushFeedback.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}>
            {pushFeedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{pushFeedback.message}</span>
          </div>
        )}

        {/* Permission Denied Guide */}
        {pushState === 'denied' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              Notifications are blocked in your browser settings
            </p>
            <p className="text-[11px] text-amber-800">
              Click the padlock/settings icon in your browser address bar next to the URL, change "Notifications" to "Allow", and reload the page.
            </p>
          </div>
        )}

        {/* Push Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={handleTogglePush}
            disabled={pushLoading || pushState === 'denied'}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
              pushState === 'enabled'
                ? 'bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-200'
                : 'bg-stone-900 text-white hover:bg-stone-800 disabled:bg-stone-300'
            }`}
          >
            {pushLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Configuring…
              </>
            ) : pushState === 'enabled' ? (
              'Disable Notifications'
            ) : (
              'Enable Browser Notifications'
            )}
          </button>

          {pushState === 'enabled' && (
            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={testSending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {testSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sending Push…
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send Test Notification
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-[11px] text-stone-500 mt-3">
          <strong>Note:</strong> Test notifications are transmitted from the backend server via VAPID Web Push protocol and displayed by the registered Service Worker.
        </p>
      </div>

      {/* 2. Profile & Reminder Offsets Form */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">
          Profile & Reminder Offsets
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={currentUser.email}
              disabled
              className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-stone-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Default Reminder Offset
            </label>
            <select
              value={advanceHours}
              onChange={(e) => setAdvanceHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900"
            >
              <option value={2}>2 hours before deadline</option>
              <option value={6}>6 hours before deadline</option>
              <option value={12}>12 hours before deadline</option>
              <option value={24}>24 hours (1 day) before deadline</option>
              <option value={48}>48 hours (2 days) before deadline</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. AI Architecture Spec Box */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold tracking-wide uppercase">
            Delegated Trust & Notification Architecture
          </h3>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          Nudgify separates autonomous helper adjustments from owner authorization:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
          <div className="bg-stone-800/80 p-3.5 rounded-xl border border-stone-700">
            <span className="font-semibold text-emerald-400 block mb-1">Primary Helper (Autonomous)</span>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Updates deadlines and reminders directly without blocking the owner. Dispatches instant background Web Push notifications and immutable audit logs.
            </p>
          </div>

          <div className="bg-stone-800/80 p-3.5 rounded-xl border border-stone-700">
            <span className="font-semibold text-amber-400 block mb-1">Helper (Requires Approval)</span>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Proposals are held as Change Requests. The owner receives an approval notification before any deadline change or reminder shift is executed.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Demo Data Reset */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-stone-900">Reset Demo Workspace</h4>
          <p className="text-xs text-stone-500 mt-0.5">
            Restores initial sample data (Muskan as Owner, Apoorv as Primary Helper, DBMS assignment).
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {resetting ? 'Resetting…' : 'Reset Data'}
        </button>
      </div>
    </div>
  );
};
