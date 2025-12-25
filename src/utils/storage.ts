import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Bill, Group, Activity, Friend } from '../types';

const STORAGE_KEYS = {
  USERS: '@amot_users',
  BILLS: '@amot_bills',
  AUTH_TOKEN: '@amot_auth_token',
  CURRENT_USER: '@amot_current_user',
  GROUPS: '@amot_groups',
  ACTIVITIES: '@amot_activities',
  FRIENDS: '@amot_friends',
};

// Users Storage
export const saveUsers = async (users: User[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (error) {
    console.error('Error saving users:', error);
    throw error;
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const users = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
    return users ? JSON.parse(users) : [];
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
};

// Bills Storage
export const saveBills = async (bills: Bill[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
  } catch (error) {
    console.error('Error saving bills:', error);
    throw error;
  }
};

export const getBills = async (): Promise<Bill[]> => {
  try {
    const bills = await AsyncStorage.getItem(STORAGE_KEYS.BILLS);
    return bills ? JSON.parse(bills) : [];
  } catch (error) {
    console.error('Error getting bills:', error);
    return [];
  }
};

// Auth Token Storage
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.error('Error saving auth token:', error);
    throw error;
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const removeAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
};

// Current User Storage
export const saveCurrentUser = async (user: User): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving current user:', error);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const user = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const removeCurrentUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } catch (error) {
    console.error('Error removing current user:', error);
  }
};

// Groups Storage
export const saveGroups = async (groups: Group[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  } catch (error) {
    console.error('Error saving groups:', error);
    throw error;
  }
};

export const getGroups = async (): Promise<Group[]> => {
  try {
    const groups = await AsyncStorage.getItem(STORAGE_KEYS.GROUPS);
    return groups ? JSON.parse(groups) : [];
  } catch (error) {
    console.error('Error getting groups:', error);
    return [];
  }
};

// Activities Storage
export const saveActivities = async (activities: Activity[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
  } catch (error) {
    console.error('Error saving activities:', error);
    throw error;
  }
};

export const getActivities = async (): Promise<Activity[]> => {
  try {
    const activities = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    return activities ? JSON.parse(activities) : [];
  } catch (error) {
    console.error('Error getting activities:', error);
    return [];
  }
};

// Friends Storage
export const saveFriends = async (friends: Friend[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends));
  } catch (error) {
    console.error('Error saving friends:', error);
    throw error;
  }
};

export const getFriends = async (): Promise<Friend[]> => {
  try {
    const friends = await AsyncStorage.getItem(STORAGE_KEYS.FRIENDS);
    return friends ? JSON.parse(friends) : [];
  } catch (error) {
    console.error('Error getting friends:', error);
    return [];
  }
};

// Clear all data
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw error;
  }
};
