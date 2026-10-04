import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  Clock, 
  CheckCircle2, 
  PlayCircle,
  Lock,
  Mail,
  UserCheck
} from 'lucide-react';
import { api } from '../api';
import { User } from '../types';

interface LandingViewProps {
  onLoginSuccess: (user: User) => void;
  onRunDemoScenario: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onLoginSuccess,
  onRunDemoScenario,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res;
      if (isRegister) {
        res = await api.register(name, email, password);
      } else {
        res = await api.login(email, password);
      }
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.switchDemoUser(userId);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="px-6 py-4 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-stone-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
          <span className="text-xl font-bold font-display tracking-tight text-stone-900">Nudge</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunDemoScenario}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Run Core Story Demo
          </button>
        </div>
      </header>

      {/* Main Hero & Auth Container */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left: Value Proposition */}
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>Trusted Delegation Productivity</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-stone-950 font-display tracking-tight leading-[1.1]">
            Nudge remembers for you — and lets the people you trust help.
          </h1>

          <p className="text-base text-stone-600 leading-relaxed">
            Traditional productivity apps force you to constantly check and update your own reminders. When life changes or assignments get pushed, Nudge empowers your trusted circle to keep your deadlines synchronized without friction.
          </p>

          {/* Core Story Callout */}
          <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-xs space-y-2 text-xs">
            <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px] text-amber-800">
              The Hackathon Showcase Story
            </div>
            <p className="text-stone-700 leading-relaxed">
              Muskan creates <strong>“DBMS Assignment”</strong> with deadline <strong>October 20</strong>, and designates <strong>Apoorv</strong> as her Primary Helper. Apoorv speaks to Nudge:
            </p>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 font-mono text-[11px] text-stone-800">
              “Move Muskan’s DBMS deadline from October 20 to October 24.”
            </div>
            <p className="text-stone-600">
              Nudge parses intent with open-weight AI, enforces delegated trust without requiring Muskan’s approval, re-anchors reminders, and alerts Muskan immediately.
            </p>
          </div>

          {/* Quick Demo Switcher Buttons */}
          <div>
            <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
              1-Click Instant Demo Login:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => handleDemoLogin('user_muskan_demo')}
                className="p-3 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-left shadow-xs transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800">Muskan</div>
                <div className="text-[10px] text-stone-500 font-medium">Owner of DBMS Assignment</div>
              </button>

              <button
                onClick={() => handleDemoLogin('user_apoorv_demo')}
                className="p-3 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-left shadow-xs transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800">Apoorv</div>
                <div className="text-[10px] text-stone-500 font-medium">Primary Helper (Direct Access)</div>
              </button>

              <button
                onClick={() => handleDemoLogin('user_rohan_demo')}
                className="p-3 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-left shadow-xs transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-stone-900 group-hover:text-amber-800">Rohan</div>
                <div className="text-[10px] text-stone-500 font-medium">Helper (Needs Approval)</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl p-8">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-stone-900 font-display">
                {isRegister ? 'Create an Account' : 'Welcome to Nudge'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {isRegister ? 'Start delegating task reminders' : 'Sign in to access your trusted circle'}
              </p>
            </div>

            <div className="flex bg-stone-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${!isRegister ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-500'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${isRegister ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-500'}`}
              >
                Register
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {isRegister && (
              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Muskan Sharma"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl outline-none font-medium text-stone-900"
                  required
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@nudge.app"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl outline-none font-medium text-stone-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white focus:border-stone-900 rounded-xl outline-none font-medium text-stone-900"
                  required
                />
              </div>
              {!isRegister && (
                <p className="text-[11px] text-stone-400 mt-1">
                  Demo hint: password is <span className="font-mono text-stone-600">password123</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-100 text-center">
            <span className="text-stone-400 text-xs">Or quickly explore using one of the demo buttons above.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 max-w-7xl mx-auto w-full border-t border-stone-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-2">
        <div>Nudge · Personal Productivity & Delegated Trust Engine</div>
        <div className="flex items-center gap-4">
          <span>Open-Weight AI Model Intent Parser</span>
          <span>Deterministic Audit Log</span>
        </div>
      </footer>
    </div>
  );
};
