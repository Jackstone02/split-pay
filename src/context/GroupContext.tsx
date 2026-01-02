import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { supabaseApi } from '../services/supabaseApi';
import { Group, CreateGroupData, Bill } from '../types';

interface GroupContextType {
  groups: Group[];
  selectedGroup: Group | null;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadGroups: () => Promise<void>;
  loadUserGroups: (userId: string) => Promise<void>;
  createGroup: (groupData: CreateGroupData, userId: string) => Promise<Group>;
  updateGroup: (groupId: string, updates: Partial<Group>, userId?: string) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<{ success: boolean }>;
  getGroupById: (groupId: string) => Promise<Group | null>;
  addMember: (groupId: string, userId: string) => Promise<Group>;
  removeMember: (groupId: string, userId: string) => Promise<Group>;
  getGroupBills: (groupId: string) => Promise<Bill[]>;
}

export const GroupContext = createContext<GroupContextType | undefined>(undefined);

interface GroupProviderProps {
  children: ReactNode;
}

export const GroupProvider: React.FC<GroupProviderProps> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const loadGroups = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedGroups = await supabaseApi.getUserGroups(userId);
      setGroups(loadedGroups);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUserGroups = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const userGroups = await supabaseApi.getUserGroups(userId);
      setGroups(userGroups);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading user groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (groupData: CreateGroupData, userId: string) => {
    try {
      setError(null);
      const newGroup = await supabaseApi.createGroup(groupData, userId);
      setGroups(prev => [...prev, newGroup]);
      return newGroup;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateGroup = useCallback(
    async (groupId: string, updates: Partial<Group>, userId?: string) => {
      try {
        setError(null);
        const updatedGroup = await supabaseApi.updateGroup(groupId, updates, userId);
        setGroups(prev =>
          prev.map(group => (group.id === groupId ? updatedGroup : group))
        );
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(updatedGroup);
        }
        return updatedGroup;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update group';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedGroup]
  );

  const deleteGroup = useCallback(
    async (groupId: string) => {
      try {
        setError(null);
        await supabaseApi.deleteGroup(groupId);
        setGroups(prev => prev.filter(group => group.id !== groupId));
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(null);
        }
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete group';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedGroup]
  );

  const getGroupById = useCallback(async (groupId: string) => {
    try {
      setError(null);
      const group = await supabaseApi.getGroupById(groupId);
      setSelectedGroup(group);
      return group;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error getting group:', err);
      return null;
    }
  }, []);

  const addMember = useCallback(
    async (groupId: string, userId: string) => {
      try {
        setError(null);
        const updatedGroup = await supabaseApi.addMember(groupId, userId);
        setGroups(prev =>
          prev.map(group => (group.id === groupId ? updatedGroup : group))
        );
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(updatedGroup);
        }
        return updatedGroup;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add member';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedGroup]
  );

  const removeMember = useCallback(
    async (groupId: string, userId: string) => {
      try {
        setError(null);
        const updatedGroup = await supabaseApi.removeMember(groupId, userId);
        setGroups(prev =>
          prev.map(group => (group.id === groupId ? updatedGroup : group))
        );
        if (selectedGroup?.id === groupId) {
          setSelectedGroup(updatedGroup);
        }
        return updatedGroup;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedGroup]
  );

  const getGroupBills = useCallback(async (groupId: string): Promise<Bill[]> => {
    try {
      setError(null);
      const bills = await supabaseApi.getBillsByGroup(groupId);
      return bills;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error getting group bills:', err);
      return [];
    }
  }, []);

  const value: GroupContextType = {
    groups,
    selectedGroup,
    isLoading,
    error,
    setError,
    loadGroups,
    loadUserGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupById,
    addMember,
    removeMember,
    getGroupBills,
  };

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  );
};
