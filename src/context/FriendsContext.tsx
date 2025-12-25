import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { supabaseApi } from '../services/supabaseApi';
import { getFriends, saveFriends } from '../utils/storage';
import { mockApi } from '../services/mockApi';
import { Friend, FriendWithBalance, User } from '../types';
import { AuthContext } from './AuthContext';

interface FriendsContextType {
  friends: Friend[];
  friendsWithBalances: FriendWithBalance[];
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadFriends: () => Promise<void>;
  addFriend: (friendId: string) => Promise<Friend>;
  removeFriend: (friendshipId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<User[]>;
  areFriends: (friendId: string) => boolean;
  syncFriends: () => Promise<void>;
}

export const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

interface FriendsProviderProps {
  children: ReactNode;
}

export const FriendsProvider: React.FC<FriendsProviderProps> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsWithBalances, setFriendsWithBalances] = useState<FriendWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = authContext?.user;

  /**
   * Load friends from Supabase, fallback to AsyncStorage
   */
  const loadFriends = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Try Supabase first
      try {
        const supabaseFriends = await supabaseApi.getFriends(user.id);
        setFriends(supabaseFriends);
        await saveFriends(supabaseFriends);

        // Calculate balances
        await calculateBalances(supabaseFriends);
      } catch (supabaseError) {
        console.warn('Supabase fetch failed, using local data:', supabaseError);

        // Fallback to AsyncStorage
        const localFriends = await getFriends();
        setFriends(localFriends);
        await calculateBalances(localFriends);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load friends';
      setError(errorMessage);
      console.error('Error loading friends:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Calculate balances for friends using bills
   */
  const calculateBalances = async (friendsList: Friend[]) => {
    if (!user) return;

    try {
      // Get all friend balances from bills
      const allBalances = await mockApi.getFriendBalances(user.id);

      // Merge with explicit friends list
      const friendsWithBal: FriendWithBalance[] = friendsList.map(friend => {
        const balance = allBalances.find(b => b.friendId === friend.friendId);

        return {
          ...friend,
          balance: balance?.balance || 0,
          billCount: balance?.billCount || 0,
          lastActivityAt: balance?.lastActivityAt || friend.createdAt,
        };
      });

      // Sort by absolute balance (highest first)
      friendsWithBal.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

      setFriendsWithBalances(friendsWithBal);
    } catch (err) {
      console.error('Error calculating balances:', err);
    }
  };

  /**
   * Add a new friend
   */
  const addFriend = useCallback(async (friendId: string): Promise<Friend> => {
    if (!user) throw new Error('Not authenticated');

    // Prevent adding self as friend
    if (friendId === user.id) {
      throw new Error('You cannot add yourself as a friend');
    }

    try {
      setError(null);

      // Try Supabase
      try {
        const newFriend = await supabaseApi.addFriend(user.id, friendId);

        // Update local state
        const updatedFriends = [...friends, newFriend];
        setFriends(updatedFriends);
        await saveFriends(updatedFriends);
        await calculateBalances(updatedFriends);

        return newFriend;
      } catch (supabaseError) {
        // Fallback: create local friend entry
        console.warn('Supabase add failed, adding locally:', supabaseError);

        const friendUser = await mockApi.getUserById(friendId);
        if (!friendUser) throw new Error('User not found');

        const newFriend: Friend = {
          id: `friend_${Date.now()}`,
          userId: user.id,
          friendId: friendId,
          friendName: friendUser.name,
          friendEmail: friendUser.email,
          status: 'accepted',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const updatedFriends = [...friends, newFriend];
        setFriends(updatedFriends);
        await saveFriends(updatedFriends);
        await calculateBalances(updatedFriends);

        return newFriend;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add friend';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [user, friends]);

  /**
   * Remove a friend
   */
  const removeFriend = useCallback(async (friendshipId: string) => {
    if (!user) throw new Error('Not authenticated');

    try {
      setError(null);

      // Try Supabase
      try {
        await supabaseApi.removeFriend(user.id, friendshipId);
      } catch (supabaseError) {
        console.warn('Supabase remove failed, removing locally:', supabaseError);
      }

      // Update local state
      const updatedFriends = friends.filter(f => f.id !== friendshipId);
      setFriends(updatedFriends);
      await saveFriends(updatedFriends);
      await calculateBalances(updatedFriends);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove friend';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [user, friends]);

  /**
   * Search users by username or email
   */
  const searchUsers = useCallback(async (query: string): Promise<User[]> => {
    try {
      // Try Supabase first
      try {
        return await supabaseApi.searchUsers(query);
      } catch (supabaseError) {
        console.warn('Supabase search failed, using mock API:', supabaseError);
        return await mockApi.searchUsers(query);
      }
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  }, []);

  /**
   * Check if user is already a friend
   */
  const areFriends = useCallback((friendId: string): boolean => {
    return friends.some(f => f.friendId === friendId);
  }, [friends]);

  /**
   * Sync local friends with Supabase
   */
  const syncFriends = useCallback(async () => {
    if (!user) return;

    try {
      const supabaseFriends = await supabaseApi.getFriends(user.id);

      // Supabase is source of truth
      setFriends(supabaseFriends);
      await saveFriends(supabaseFriends);
      await calculateBalances(supabaseFriends);
    } catch (err) {
      console.error('Error syncing friends:', err);
    }
  }, [user]);

  const value: FriendsContextType = {
    friends,
    friendsWithBalances,
    isLoading,
    error,
    setError,
    loadFriends,
    addFriend,
    removeFriend,
    searchUsers,
    areFriends,
    syncFriends,
  };

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};
