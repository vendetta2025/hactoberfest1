import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  Bell, 
  RotateCcw, 
  Cpu, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../api';

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
  const [browserNotifs, setBrowserNotifs] = useState(currentUser.browserNotificationsEnabled);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        name,
        reminderAdvanceHours: advanceHours,
        browserNotificationsEnabled: browserNotifs,
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

  const handleResetDemo = async () => {
    if (!confirm('Reset the database to initial demo state (Muskan as Owner, Apoorv as Primary Helper, DBMS deadline Oct 20)?')) return;
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

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setBrowserNotifs(true);
        new Notification('Nudge Reminders Enabled', {
          body: 'You will receive desktop alerts when deadlines change or reminders trigger.',
        });
      }
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 font-display">Account & Preferences</h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Configure notification offsets, AI architecture specifications, and reset demo data.
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

      {/* Profile & Reminder Form */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">
          Profile & Reminders
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={browserNotifs}
                onChange={(e) => {
                  setBrowserNotifs(e.target.checked);
                  if (e.target.checked) requestBrowserPermission();
                }}
                className="rounded"
              />
              <span className="font-medium text-stone-800">
                Enable browser desktop notifications for reminders and helper updates
              </span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-semibold rounded-lg shadow-xs transition-colors"
            >
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* AI Architecture Spec Box */}
      <div className="bg-stone-100/90 rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-5 h-5 text-amber-700" />
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            AI & Deterministic Security Architecture
          </h3>
        </div>

        <div className="space-y-2 text-xs text-stone-700 leading-relaxed">
          <p>
            <strong>Open-Weight Model Intent Extraction:</strong> Nudge utilizes Google's open-weight Gemma-2 / Gemini architecture to parse conversational requests into strict structured action schemas.
          </p>
          <p>
            <strong>Deterministic Authorization Barrier:</strong> The AI model is strictly prohibited from touching the database directly. All mutations pass through server-side authorization:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-stone-600">
            <li>Session Token Authentication</li>
            <li>Role Verification: Only Owner or verified Primary Helper can mutate deadlines directly.</li>
            <li>Helpers require explicit Owner approval before any change applies.</li>
            <li>Automated reminder re-anchoring on every deadline adjustment.</li>
            <li>Immutable audit logging to ensure transparency.</li>
          </ul>
        </div>
      </div>

      {/* Demo Controls */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider">
              Reset Demo Database
            </h3>
            <p className="text-xs text-stone-600 mt-1">
              Restores Muskan as Owner, Apoorv as Primary Helper, Rohan as Helper, and resets the DBMS Assignment deadline back to October 20.
            </p>
          </div>

          <button
            onClick={handleResetDemo}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {resetting ? 'Resetting…' : 'Reset to Demo State'}
          </button>
        </div>
      </div>
    </div>
  );
};
