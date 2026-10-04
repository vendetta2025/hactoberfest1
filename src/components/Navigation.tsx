import React from 'react';
import { 
  Bell, 
  Calendar, 
  CheckSquare, 
  Users, 
  History, 
  Settings, 
  LogOut, 
  Sparkles, 
  ShieldCheck, 
  PlayCircle 
} from 'lucide-react';
import { User, Notification } from '../types';

interface NavigationProps {
  user: User;
  currentTab: string;
  onTabChange: (tab: string) => void;
  notifications: Notification[];
  onSwitchDemo: (userId: string) => void;
  onLogout: () => void;
  onRunDemoScenario: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  user,
  currentTab,
  onTabChange,
  notifications,
  onSwitchDemo,
  onLogout,
  onRunDemoScenario,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200">
      {/* Demo Persona Quick-Switch Ribbon */}
      <div className="bg-stone-900 text-stone-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-400 uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Hackathon Demo Personas:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSwitchDemo('user_muskan_demo')}
              className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
                user.id === 'user_muskan_demo' 
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-xs' 
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              Muskan (Owner)
            </button>
            <button
              onClick={() => onSwitchDemo('user_apoorv_demo')}
              className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
                user.id === 'user_apoorv_demo' 
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-xs' 
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              Apoorv (Primary Helper)
            </button>
            <button
              onClick={() => onSwitchDemo('user_rohan_demo')}
              className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
                user.id === 'user_rohan_demo' 
                  ? 'bg-amber-400 text-stone-950 font-bold shadow-xs' 
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              Rohan (Helper)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunDemoScenario}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium px-3 py-1 rounded shadow-xs transition-all cursor-pointer"
            title="Automatically run the canonical Muskan & Apoorv deadline update workflow"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Run Core Story Demo (Oct 20 → Oct 24)
          </button>
          <span className="text-stone-400 hidden sm:inline">Active: <span className="text-white font-medium">{user.name}</span></span>
        </div>
      </div>

      {/* Main App Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-display tracking-tight text-stone-900">Nudge</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                  Trusted Delegation
                </span>
              </div>
              <p className="text-[11px] text-stone-600 hidden md:block">
                Remembers for you — and lets people you trust help.
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'dashboard'
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Calendar className="w-4 h-4 text-stone-500" />
              Dashboard
            </button>

            <button
              onClick={() => onTabChange('tasks')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'tasks'
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-stone-500" />
              Tasks
            </button>

            <button
              onClick={() => onTabChange('trusted')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'trusted'
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Users className="w-4 h-4 text-stone-500" />
              Trusted People
            </button>

            <button
              onClick={() => onTabChange('notifications')}
              className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'notifications'
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Bell className="w-4 h-4 text-stone-500" />
              Notifications
              {unreadCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-amber-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('activity')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'activity'
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <History className="w-4 h-4 text-stone-500" />
              Activity Log
            </button>

            <button
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'settings'
                  ? 'bg-stone-100 text-stone-900 font-semibold'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Settings className="w-4 h-4 text-stone-500" />
              Settings
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pl-2 border-l border-stone-200">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs"
                style={{ backgroundColor: user.avatarColor || '#6366f1' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-stone-900 leading-tight">{user.name}</div>
                <div className="text-[10px] text-stone-600 leading-tight">{user.email}</div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Nav row */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1 border-t border-stone-100 text-xs">
          <button 
            onClick={() => onTabChange('dashboard')} 
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${currentTab === 'dashboard' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => onTabChange('tasks')} 
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${currentTab === 'tasks' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
          >
            Tasks
          </button>
          <button 
            onClick={() => onTabChange('trusted')} 
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${currentTab === 'trusted' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
          >
            Trusted
          </button>
          <button 
            onClick={() => onTabChange('notifications')} 
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap relative ${currentTab === 'notifications' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
          >
            Notifs {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button 
            onClick={() => onTabChange('activity')} 
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${currentTab === 'activity' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
          >
            History
          </button>
          <button 
            onClick={() => onTabChange('settings')} 
            className={`px-3 py-1.5 rounded font-medium whitespace-nowrap ${currentTab === 'settings' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}
          >
            Settings
          </button>
        </div>
      </div>
    </header>
  );
};
