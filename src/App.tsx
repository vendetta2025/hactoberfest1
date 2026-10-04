/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api, getStoredToken } from './api';
import { 
  User, 
  Task, 
  Reminder, 
  Notification, 
  ActivityLog, 
  TrustedRelationship, 
  OwnerWhoTrustsMe 
} from './types';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TasksView } from './components/TasksView';
import { TrustedPeopleView } from './components/TrustedPeopleView';
import { NotificationsView } from './components/NotificationsView';
import { ActivityHistoryView } from './components/ActivityHistoryView';
import { SettingsView } from './components/SettingsView';
import { LandingView } from './components/LandingView';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { NewTaskModal } from './components/NewTaskModal';
import { DemoScenarioModal } from './components/DemoScenarioModal';
import { getServiceWorkerRegistration } from './pushManager';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Application Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [trustedPeople, setTrustedPeople] = useState<TrustedRelationship[]>([]);
  const [whoTrustsMe, setWhoTrustsMe] = useState<OwnerWhoTrustsMe[]>([]);

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showDemoScenarioModal, setShowDemoScenarioModal] = useState(false);

  // Initialize or fetch current user
  const initAuth = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        // Automatically default to Muskan for smooth evaluation experience!
        const res = await api.switchDemoUser('user_muskan_demo');
        setCurrentUser(res.user);
      } else {
        const meRes = await api.getMe();
        setCurrentUser(meRes.user);
      }
    } catch (err) {
      console.warn('[App] Could not load user session, defaulting to demo user:', err);
      try {
        const res = await api.switchDemoUser('user_muskan_demo');
        setCurrentUser(res.user);
      } catch (e) {
        setCurrentUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Refresh data for current user
  const refreshData = async () => {
    if (!currentUser) return;
    try {
      const [
        tasksRes,
        remindersRes,
        notificationsRes,
        activityRes,
        trustedRes,
      ] = await Promise.all([
        api.getTasks(),
        api.getReminders(),
        api.getNotifications(),
        api.getActivityLogs(),
        api.getTrusted(),
      ]);

      setTasks(tasksRes);
      setReminders(remindersRes);
      setNotifications(notificationsRes);
      setActivityLogs(activityRes);
      setTrustedPeople(trustedRes.myTrusted);
      setWhoTrustsMe(trustedRes.whoTrustsMe);
    } catch (err) {
      console.error('[App] Error refreshing data:', err);
    }
  };

  useEffect(() => {
    initAuth();
    getServiceWorkerRegistration();

    // Check URL parameters when opened via a Web Push notification click
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const taskIdParam = urlParams.get('taskId');

      if (tabParam) {
        setCurrentTab(tabParam);
      }
      if (taskIdParam) {
        setSelectedTaskId(taskIdParam);
      }
    } catch (e) {
      console.warn('[App] Could not parse notification deep-link:', e);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser]);

  // Demo user quick switcher
  const handleSwitchDemo = async (userId: string) => {
    setLoading(true);
    try {
      const res = await api.switchDemoUser(userId);
      setCurrentUser(res.user);
      await refreshData();
    } catch (err) {
      alert('Could not switch demo user');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-stone-800">Initializing Nudge…</h2>
        </div>
      </div>
    );
  }

  // If no user, show Landing / Login
  if (!currentUser) {
    return (
      <LandingView 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          refreshData();
        }}
        onRunDemoScenario={() => setShowDemoScenarioModal(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-900 flex flex-col font-sans">
      {/* Top Header & Navigation */}
      <Navigation
        user={currentUser}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        notifications={notifications}
        onSwitchDemo={handleSwitchDemo}
        onLogout={handleLogout}
        onRunDemoScenario={() => setShowDemoScenarioModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            tasks={tasks}
            reminders={reminders}
            notifications={notifications}
            activityLogs={activityLogs}
            trustedPeople={trustedPeople}
            onSelectTask={(id) => setSelectedTaskId(id)}
            onOpenNewTaskModal={() => setShowNewTaskModal(true)}
            onRefresh={refreshData}
            onNavigateTab={setCurrentTab}
            onRunDemoScenario={() => setShowDemoScenarioModal(true)}
          />
        )}

        {currentTab === 'tasks' && (
          <TasksView
            currentUser={currentUser}
            tasks={tasks}
            onSelectTask={(id) => setSelectedTaskId(id)}
            onOpenNewTaskModal={() => setShowNewTaskModal(true)}
          />
        )}

        {currentTab === 'trusted' && (
          <TrustedPeopleView
            currentUser={currentUser}
            myTrusted={trustedPeople}
            whoTrustsMe={whoTrustsMe}
            onRefresh={refreshData}
          />
        )}

        {currentTab === 'notifications' && (
          <NotificationsView
            currentUser={currentUser}
            notifications={notifications}
            onRefresh={refreshData}
            onSelectTask={(id) => setSelectedTaskId(id)}
          />
        )}

        {currentTab === 'activity' && (
          <ActivityHistoryView
            currentUser={currentUser}
            activityLogs={activityLogs}
            onSelectTask={(id) => setSelectedTaskId(id)}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            currentUser={currentUser}
            onRefresh={refreshData}
          />
        )}
      </main>

      {/* Modals */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          currentUser={currentUser}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={refreshData}
        />
      )}

      {showNewTaskModal && (
        <NewTaskModal
          currentUser={currentUser}
          whoTrustsMe={whoTrustsMe}
          onClose={() => setShowNewTaskModal(false)}
          onCreated={refreshData}
        />
      )}

      {showDemoScenarioModal && (
        <DemoScenarioModal
          onClose={() => setShowDemoScenarioModal(false)}
          onCompleted={refreshData}
        />
      )}
    </div>
  );
}
