import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Bell, 
  Database, 
  History, 
  ArrowRight,
  RefreshCw,
  Play
} from 'lucide-react';
import { api } from '../api';

interface DemoScenarioModalProps {
  onClose: () => void;
  onCompleted: () => void;
}

export const DemoScenarioModal: React.FC<DemoScenarioModalProps> = ({
  onClose,
  onCompleted,
}) => {
  const [running, setRunning] = useState(false);
  const [scenarioData, setScenarioData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const runScenario = async () => {
    setRunning(true);
    setScenarioData(null);
    setCurrentStep(1);

    try {
      // Step interval animation for realistic visual demonstration of the pipeline
      const stepTimer1 = setTimeout(() => setCurrentStep(2), 350);
      const stepTimer2 = setTimeout(() => setCurrentStep(3), 700);
      const stepTimer3 = setTimeout(() => setCurrentStep(4), 1050);
      const stepTimer4 = setTimeout(() => setCurrentStep(5), 1400);

      const res = await api.runCanonicalDemoScenario();

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      clearTimeout(stepTimer4);

      setCurrentStep(8);
      setScenarioData(res);
      onCompleted();
    } catch (err: any) {
      alert(err.message || 'Failed running scenario');
    } finally {
      setRunning(false);
    }
  };

  const steps = [
    { num: 1, title: 'Natural Language Processing', desc: 'Open-weight model parses "Move Muskan’s DBMS deadline from October 20 to October 24."' },
    { num: 2, title: 'Entity Extraction', desc: 'Identified: Task = "DBMS Assignment", New Deadline = "2026-10-24", Target = "Muskan".' },
    { num: 3, title: 'Delegated Trust Authorization', desc: 'Verified: Apoorv is registered as Primary Helper for Muskan.' },
    { num: 4, title: 'Direct Execution Policy', desc: 'Primary Helper changes applied immediately without blocking Muskan for approval.' },
    { num: 5, title: 'Persistent Database Mutation', desc: 'Updated task record in persistent nudge-db.json.' },
    { num: 6, title: 'Reminder Recalculation', desc: 'Offset re-anchored: Shifted 24-hr reminder from Oct 19 to Oct 23 at 10:00 AM.' },
    { num: 7, title: 'Immutable Audit Trail', desc: 'Logged event into Activity History with before/after timestamps.' },
    { num: 8, title: 'Clear Notification to Owner', desc: 'Dispatched notification to Muskan with exact changes.' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-black/20 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Canonical 8-Step Core Story</span>
            </div>
            <h2 className="text-xl font-bold font-display">Apoorv & Muskan: Trusted Delegation in Action</h2>
            <p className="text-xs text-amber-100 mt-1 max-w-lg">
              Demonstrating open-weight natural language intent extraction paired with deterministic server-side role validation and automatic reminder adjustment.
            </p>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-black/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Natural language trigger command */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs text-stone-500 font-semibold mb-1">
              <span>NATURAL LANGUAGE INPUT (By Apoorv · Primary Helper):</span>
              <span className="text-emerald-700 font-bold">Open-Weight AI Pipeline</span>
            </div>
            <div className="text-base font-semibold text-stone-900 font-mono">
              “Move Muskan’s DBMS deadline from October 20 to October 24.”
            </div>
          </div>

          {/* 8-Step Interactive Pipeline Progress */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Verification & Mutation Pipeline
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {steps.map(step => {
                const isComplete = scenarioData || currentStep >= step.num;
                const isCurrent = running && currentStep === step.num;

                return (
                  <div
                    key={step.num}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-3 transition-colors ${
                      isComplete
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : isCurrent
                        ? 'bg-amber-50 border-amber-300 text-amber-950 animate-pulse'
                        : 'bg-stone-50 border-stone-200 text-stone-500'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                      isComplete ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'
                    }`}>
                      {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.num}
                    </div>

                    <div className="flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{step.title}</span>
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Output Notification Result if completed */}
          {scenarioData && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <Bell className="w-4 h-4 text-amber-700" />
                Notification Dispatched to Muskan (Owner):
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100 text-xs text-stone-900 font-mono whitespace-pre-line leading-relaxed shadow-xs">
                {scenarioData.notificationMessage}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-100">
            <button
              onClick={runScenario}
              disabled={running}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing Pipeline…</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Full 8-Step Story Now</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
