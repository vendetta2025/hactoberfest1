import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Shield, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';
import { TrustedRelationship, OwnerWhoTrustsMe, User } from '../types';
import { api } from '../api';

interface TrustedPeopleViewProps {
  currentUser: User;
  myTrusted: TrustedRelationship[];
  whoTrustsMe: OwnerWhoTrustsMe[];
  onRefresh: () => void;
}

export const TrustedPeopleView: React.FC<TrustedPeopleViewProps> = ({
  currentUser,
  myTrusted,
  whoTrustsMe,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'PRIMARY_HELPER' | 'HELPER'>('PRIMARY_HELPER');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddTrusted = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.addTrusted(email.trim(), role, notes);
      setSuccessMsg(`Successfully added ${email} as ${role === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Helper'}.`);
      setEmail('');
      setNotes('');
      setShowAddModal(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to add trusted person');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (relId: string, newRole: 'PRIMARY_HELPER' | 'HELPER') => {
    try {
      await api.updateTrustedRole(relId, newRole);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleRemove = async (relId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your trusted circle?`)) return;
    try {
      await api.removeTrusted(relId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove trusted person');
    }
  };

  const primaryHelper = myTrusted.find(t => t.role === 'PRIMARY_HELPER');
  const helpers = myTrusted.filter(t => t.role === 'HELPER');

  return (
    <div className="space-y-8">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 font-display">Trusted People & Delegated Access</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Grant permission to trusted friends or colleagues to manage your schedule on your behalf.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add Trusted Person
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Trust & Role Model Constitution Explanation */}
      <div className="bg-stone-100/80 border border-stone-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-stone-700" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
            Nudge 3-Role Model Architecture
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-stone-200/80">
            <div className="font-bold text-stone-900 flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-stone-900" />
              1. OWNER
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              Full control over account and tasks. Can delete tasks, manage reminders, and designate or revoke helpers.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs">
            <div className="font-bold text-amber-900 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              2. PRIMARY HELPER
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              <strong>Delegated Trust:</strong> Can update deadlines and reminders <em>without owner approval</em>. Every change is logged and generates immediate owner notification. Task deletion is blocked.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200/80">
            <div className="font-bold text-stone-900 flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-stone-500" />
              3. HELPER
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              Can propose or request changes to shared tasks. Proposed changes <em>require Owner review & approval</em> before applying.
            </p>
          </div>
        </div>
      </div>

      {/* Primary Helper Spotlight Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-stone-900 font-display">Your Primary Helper</h3>
          </div>
          <span className="text-[11px] text-stone-500">Max 1 active at a time</span>
        </div>

        {primaryHelper ? (
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-stone-900">{primaryHelper.trustedUserName}</h4>
                <span className="text-xs text-stone-500">({primaryHelper.trustedUserEmail})</span>
                <span className="text-[10px] uppercase font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                  Active Primary Helper
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                {primaryHelper.notes || 'Has full delegated authority to keep your deadlines adjusted.'}
              </p>
              <div className="text-[11px] text-stone-400 mt-1">
                Designated on {new Date(primaryHelper.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleUpdateRole(primaryHelper.id, 'HELPER')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                title="Demote to Helper (requires approval)"
              >
                <ArrowDownCircle className="w-3.5 h-3.5 text-stone-500" />
                Demote to Helper
              </button>
              <button
                onClick={() => handleRemove(primaryHelper.id, primaryHelper.trustedUserName)}
                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                title="Remove Access"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 border border-dashed border-stone-200 rounded-xl text-center">
            <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-xs text-stone-600 font-medium">No Primary Helper currently assigned.</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Assign a Primary Helper so they can update deadlines via Nudge natural language commands for you.
            </p>
          </div>
        )}
      </div>

      {/* Helpers List */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-stone-700" />
            <h3 className="text-base font-bold text-stone-900 font-display">Helpers (Approval Required)</h3>
          </div>
          <span className="text-xs text-stone-500">({helpers.length})</span>
        </div>

        {helpers.length === 0 ? (
          <p className="text-xs text-stone-500 py-3">No other helpers configured.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {helpers.map(h => (
              <div key={h.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{h.trustedUserName}</span>
                    <span className="text-xs text-stone-500">({h.trustedUserEmail})</span>
                  </div>
                  {h.notes && <p className="text-xs text-stone-500 mt-0.5">{h.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleUpdateRole(h.id, 'PRIMARY_HELPER')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg border border-amber-200 transition-colors cursor-pointer"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5 text-amber-600" />
                    Promote to Primary Helper
                  </button>
                  <button
                    onClick={() => handleRemove(h.id, h.trustedUserName)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* People Who Trust You */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-stone-700" />
          <h3 className="text-base font-bold text-stone-900 font-display">People Who Trust You</h3>
        </div>

        {whoTrustsMe.length === 0 ? (
          <p className="text-xs text-stone-500 py-3">No one has granted you helper access yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {whoTrustsMe.map(item => (
              <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-stone-900">{item.ownerName} ({item.ownerEmail})</div>
                  <div className="text-stone-500 text-[11px] mt-0.5">
                    Your role: <strong className="text-stone-800">{item.role === 'PRIMARY_HELPER' ? 'Primary Helper (Can update without approval)' : 'Helper (Changes need approval)'}</strong>
                  </div>
                </div>

                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                  item.role === 'PRIMARY_HELPER' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'
                }`}>
                  {item.role === 'PRIMARY_HELPER' ? 'Primary Helper' : 'Helper'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Trusted Person Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl p-6">
            <h3 className="text-base font-bold text-stone-900 font-display mb-1">Add Trusted Person</h3>
            <p className="text-xs text-stone-500 mb-4">
              Enter their registered Nudge email and select an access role.
            </p>

            {error && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                {error}
              </div>
            )}

            <form onSubmit={handleAddTrusted} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. apoorv@demo.nudge.app"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Role
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="PRIMARY_HELPER"
                      checked={role === 'PRIMARY_HELPER'}
                      onChange={() => setRole('PRIMARY_HELPER')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-stone-900">Primary Helper (Recommended)</div>
                      <p className="text-[11px] text-stone-500">
                        Can update deadlines and reminders directly without requiring owner sign-off.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="HELPER"
                      checked={role === 'HELPER'}
                      onChange={() => setRole('HELPER')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-stone-900">Helper (Approval Required)</div>
                      <p className="text-[11px] text-stone-500">
                        Can only submit change suggestions which you must review and approve.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Relationship Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Study partner, DBMS lab teammate"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-stone-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-stone-600 hover:text-stone-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-semibold rounded-lg shadow-xs"
                >
                  {loading ? 'Adding…' : 'Add to Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
