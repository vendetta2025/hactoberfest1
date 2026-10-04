import { 
  User, 
  Task, 
  TrustedRelationship, 
  Reminder, 
  Notification, 
  ActivityLog, 
  ChangeRequest, 
  NudgeCommandResult 
} from './types';

const TOKEN_KEY = 'nudge_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: Failed request`);
  }

  return data as T;
}

export const api = {
  // Auth
  async register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async switchDemoUser(userId: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/switch-demo', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User; trustedPeople: TrustedRelationship[]; ownersWhoTrustMe: any[] }> {
    return request<{ user: User; trustedPeople: TrustedRelationship[]; ownersWhoTrustMe: any[] }>('/api/auth/me');
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  logout() {
    clearStoredToken();
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    return request<Task[]>('/api/tasks');
  },

  async getTask(id: string): Promise<{ task: Task; reminders: Reminder[]; changeRequests: ChangeRequest[] }> {
    return request<{ task: Task; reminders: Reminder[]; changeRequests: ChangeRequest[] }>(`/api/tasks/${id}`);
  },

  async createTask(data: { title: string; description?: string; deadline: string; targetOwnerId?: string }): Promise<Task> {
    return request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return request<Task>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteTask(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  // Trusted People
  async getTrusted(): Promise<{ myTrusted: TrustedRelationship[]; whoTrustsMe: any[] }> {
    return request<{ myTrusted: TrustedRelationship[]; whoTrustsMe: any[] }>('/api/trusted');
  },

  async addTrusted(email: string, role: 'PRIMARY_HELPER' | 'HELPER', notes?: string): Promise<TrustedRelationship> {
    return request<TrustedRelationship>('/api/trusted', {
      method: 'POST',
      body: JSON.stringify({ email, role, notes }),
    });
  },

  async updateTrustedRole(id: string, role: 'PRIMARY_HELPER' | 'HELPER'): Promise<TrustedRelationship> {
    return request<TrustedRelationship>(`/api/trusted/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async removeTrusted(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/trusted/${id}`, {
      method: 'DELETE',
    });
  },

  // Reminders
  async getReminders(): Promise<Reminder[]> {
    return request<Reminder[]>('/api/reminders');
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return request<Notification[]>('/api/notifications');
  },

  async markNotificationRead(id: string): Promise<any> {
    return request(`/api/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead(): Promise<any> {
    return request('/api/notifications/read-all', { method: 'POST' });
  },

  // Activity Log
  async getActivityLogs(): Promise<ActivityLog[]> {
    return request<ActivityLog[]>('/api/activity');
  },

  // Change Requests (Helper approval flow)
  async getChangeRequests(): Promise<ChangeRequest[]> {
    return request<ChangeRequest[]>('/api/change-requests');
  },

  async reviewChangeRequest(id: string, approve: boolean): Promise<any> {
    return request(`/api/change-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ approve }),
    });
  },

  // AI Command
  async sendNudgeCommand(prompt: string): Promise<NudgeCommandResult> {
    return request<NudgeCommandResult>('/api/nudge-command', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  // Demo reset & Scenario
  async resetDemo(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/api/demo/reset', { method: 'POST' });
  },

  async runCanonicalDemoScenario(): Promise<any> {
    return request('/api/demo/run-scenario', { method: 'POST' });
  },
};
