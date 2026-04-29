import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Activity } from '../types';
import { supabaseApi } from '../services/supabaseApi';
import {
  getActivityLastReadAt,
  saveActivityLastReadAt,
  getActivityReadIds,
  addActivityReadId,
  clearActivityReadIds,
} from '../utils/storage';

interface ActivityUnreadContextValue {
  unreadCount: number;
  lastReadAt: number;
  readIds: Set<string>;
  /** Call after loading activities to sync the unread count. */
  syncUnread: (activities: Activity[], userId: string) => Promise<void>;
  /** Mark a single activity as read. */
  markRead: (activityId: string, userId: string) => Promise<void>;
  /** Mark all activities as read right now. */
  markAllRead: (userId: string) => Promise<void>;
}

const ActivityUnreadContext = createContext<ActivityUnreadContextValue>({
  unreadCount: 0,
  lastReadAt: 0,
  readIds: new Set(),
  syncUnread: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export const ActivityUnreadProvider: React.FC<{
  children: React.ReactNode;
  userId: string;
  preferredCurrency?: string;
}> = ({ children, userId, preferredCurrency }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const syncUnread = useCallback(async (activities: Activity[], uid: string) => {
    const readAt = await getActivityLastReadAt(uid);
    const ids = await getActivityReadIds(uid);
    setLastReadAt(readAt);
    setReadIds(ids);
    const count = activities.filter(
      a => a.userId !== uid && a.createdAt > readAt && !ids.has(a.id)
    ).length;
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    supabaseApi.getUserActivities(userId, 100, preferredCurrency)
      .then(activities => syncUnread(activities, userId))
      .catch(() => {});
  }, [userId]);

  const markRead = useCallback(async (activityId: string, userId: string) => {
    await addActivityReadId(userId, activityId);
    setReadIds(prev => new Set([...prev, activityId]));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async (userId: string) => {
    const now = Date.now();
    await saveActivityLastReadAt(userId, now);
    await clearActivityReadIds(userId);
    setLastReadAt(now);
    setReadIds(new Set());
    setUnreadCount(0);
  }, []);

  return (
    <ActivityUnreadContext.Provider value={{ unreadCount, lastReadAt, readIds, syncUnread, markRead, markAllRead }}>
      {children}
    </ActivityUnreadContext.Provider>
  );
};

export const useActivityUnread = () => useContext(ActivityUnreadContext);
