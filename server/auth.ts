import crypto from 'crypto';
import type { User } from './db.ts';
import { db } from './db.ts';

// Simple token storage for session authentication
const activeSessions = new Map<string, { userId: string; expiresAt: number }>();

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_nudge_salt_2026').digest('hex');
}

export function createSessionToken(userId: string): string {
  const token = `nudge_tok_${crypto.randomBytes(24).toString('hex')}`;
  // 30 days expiry
  activeSessions.set(token, {
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function getUserFromToken(token?: string): User | null {
  if (!token) return null;
  const cleanToken = token.replace('Bearer ', '').trim();
  
  // Also support direct user id token for rapid demo switches
  if (cleanToken.startsWith('demo_user_')) {
    const userId = cleanToken.replace('demo_user_', '');
    const user = db.getUserById(userId);
    if (user) return user;
  }

  const session = activeSessions.get(cleanToken);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(cleanToken);
    return null;
  }

  return db.getUserById(session.userId) || null;
}

export function invalidateToken(token: string) {
  const cleanToken = token.replace('Bearer ', '').trim();
  activeSessions.delete(cleanToken);
}
