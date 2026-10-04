import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ShieldCheck, 
  Clock, 
  UserCheck,
  RefreshCw,
  MessageSquare,
  FileCheck,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { NudgeCommandResult, User } from '../types';
import { api } from '../api';

interface CommandBarProps {
  currentUser: User;
  onActionComplete: () => void;
  onSelectTask?: (taskId: string) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  currentUser,
  onActionComplete,
  onSelectTask,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NudgeCommandResult | null>(null);

  const samplePrompts = [
    {
      label: 'Due This Week',
      text: "What do I have due this week?",
    },
    {
      label: 'Create Task',
      text: "Create an assignment for NeoCollab info due Friday.",
    },
    {
      label: 'Complete Task',
      text: "I finished my DBMS assignment.",
    },
    {
      label: 'Move Deadline',
      text: "Move Muskan’s DBMS deadline from October 20 to October 24.",
    },
    {
      label: 'Recent Activity',
      text: "What has Apoorv changed recently?",
    },
    {
      label: 'Weekly Summary',
      text: "Give me a summary of my tasks this week.",
    },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api.sendNudgeCommand(prompt);
      setResult(res);
      if (res.success) {
        onActionComplete();
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || 'Failed to process command. Please verify permissions.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsePrompt = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 font-display">Ask Nudge anything…</h2>
            <p className="text-xs text-stone-600">
              General-purpose productivity assistant. Ask about deadlines, create tasks, update schedules, or delegate with trusted roles.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-stone-600 bg-stone-50 px-2.5 py-1 rounded-md border border-stone-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Role enforcement: Server-side deterministic</span>
        </div>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="relative mb-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. What do I have due this week? Or 'Create an assignment for NeoCollab info due Friday'…"
            className="w-full pl-4 pr-32 py-3.5 bg-stone-50 hover:bg-stone-50/80 focus:bg-white border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 rounded-xl text-sm text-stone-900 placeholder-stone-600 outline-none transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="absolute right-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <span>Ask Nudge</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sample Quick Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] text-stone-600 font-medium">Try asking:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleUsePrompt(p.text)}
            className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-md transition-colors text-left flex items-center gap-1.5 cursor-pointer"
          >
            <span>{p.text}</span>
          </button>
        ))}
      </div>

      {/* Interactive Result Card */}
      {result && (
        <div className="mt-5 pt-5 border-t border-stone-100 space-y-3">
          {/* Conversational Natural Language Response */}
          {result.conversationalResponse && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs text-stone-600 font-semibold mb-1">
                  <span>Nudge Assistant</span>
                  {result.toolUsed && (
                    <span className="text-[10px] text-stone-600 font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                      tool: {result.toolUsed}
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-800 whitespace-pre-line leading-relaxed font-medium">
                  {result.conversationalResponse}
                </div>
              </div>
            </div>
          )}

          {/* Action Success / Mutation Details */}
          {result.success && (result.field || result.task || result.requiresApproval) && (
            <div className={`border rounded-xl p-4 transition-all ${
              result.requiresApproval ? 'bg-amber-50/90 border-amber-200' : 'bg-emerald-50/80 border-emerald-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {result.requiresApproval ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={`text-sm font-bold flex items-center gap-2 ${
                      result.requiresApproval ? 'text-amber-950' : 'text-emerald-950'
                    }`}>
                      <span>{result.message}</span>
                      {result.task && (
                        <button 
                          onClick={() => onSelectTask && onSelectTask(result.task!.id)}
                          className="text-xs font-semibold underline hover:opacity-80"
                        >
                          View Task Details
                        </button>
                      )}
                    </div>

                    {/* Change breakdown if values shifted */}
                    {result.field && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/80 p-2 rounded-lg border border-stone-200/60">
                          <span className="text-stone-500 font-medium">{result.field}: </span>
                          {result.oldValue && <span className="text-stone-400 line-through mr-1.5">{result.oldValue}</span>}
                          <span className="font-semibold text-stone-900">{result.oldValue ? `→ ${result.newValue}` : result.newValue}</span>
                        </div>

                        {result.changedBy && (
                          <div className="bg-white/80 p-2 rounded-lg border border-stone-200/60 flex items-center gap-1.5 text-stone-700">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Actor: <strong>{result.changedBy}</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notice regarding reminders / delegated trust */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-600">
                      {result.remindersAdjusted && (
                        <div className="flex items-center gap-1 text-emerald-800">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Reminders recalculated & re-anchored.</span>
                        </div>
                      )}
                      {result.requiresApproval && (
                        <div className="text-amber-800 font-medium">
                          Note: Helper role requires Owner approval before changes take effect.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setResult(null)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Blocked or Error Result */}
          {!result.success && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-900">Request could not be applied</h3>
                  <p className="text-xs text-rose-800 mt-1">{result.error || result.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
