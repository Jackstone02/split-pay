// User Types
export type PaymentMethod = 'gcash' | 'maya' | null;

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string; // GCash/Maya phone number for payments
  paymentMethod?: PaymentMethod; // Payment method preference
  createdAt: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Bill Types
export type SplitMethod = 'equal' | 'custom' | 'percentage' | 'item-based';
export type BillCategory = 'food' | 'transport' | 'utilities' | 'entertainment' | 'shopping' | 'other';

export interface Split {
  userId: string;
  amount: number;
  percentage?: number;
  items?: string[];
  settled?: boolean;
  settledAt?: number;
}

export interface Payment {
  fromUserId: string;
  toUserId: string;
  amount: number;
  isPaid: boolean;
  paidAt?: number;
}

export interface Bill {
  id: string;
  title: string;
  totalAmount: number;
  paidBy: string;
  participants: string[];
  splitMethod: SplitMethod;
  splits: Split[];
  payments: Payment[];
  description?: string;
  groupId?: string;
  category?: BillCategory;
  createdAt: number;
  updatedAt: number;
}

export interface CreateBillData {
  title: string;
  totalAmount: number;
  paidBy: string;
  participants: string[];
  splitMethod: SplitMethod;
  splits: Split[];
  description?: string;
  category?: BillCategory;
}

// Item-based split
export interface BillItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
}

// Summary Types
export interface UserBillsSummary {
  totalOwed: number;
  totalOwing: number;
  totalSettled: number;
  balance: number;
  billCount: number;
}

export interface UserBalance {
  totalOwed: number;
  totalOwing: number;
  balance: number;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  total: number;
}

// Group Types
export interface Group {
  id: string;
  name: string;
  description?: string;
  members: string[]; // user IDs
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  color?: string;
  category?: 'trip' | 'roommates' | 'event' | 'other';
}

export interface CreateGroupData {
  name: string;
  description?: string;
  members: string[];
  category?: 'trip' | 'roommates' | 'event' | 'other';
  color?: string;
}

// Activity Types
export type ActivityType =
  | 'bill_created'
  | 'bill_updated'
  | 'bill_deleted'
  | 'payment_made'
  | 'payment_requested'
  | 'group_created'
  | 'group_updated'
  | 'member_added'
  | 'member_removed'
  | 'poke'
  | 'poke_sent'
  | 'poke_received';

export interface Activity {
  id: string;
  type: ActivityType;
  userId: string; // who performed the action
  billId?: string;
  groupId?: string;
  targetUserId?: string; // for member-related activities
  amount?: number;
  description: string;
  createdAt: number;
}

// Friend Types
export interface Friend {
  id: string;              // friendship record ID
  userId: string;          // current user's ID
  friendId: string;        // friend's user ID
  friendName: string;      // denormalized for display
  friendEmail: string;     // denormalized for display
  status: string;          // 'accepted', 'pending', 'declined'
  createdAt: number;
  updatedAt: number;
}

export interface FriendWithBalance extends Friend {
  balance: number;         // positive = they owe you, negative = you owe them
  billCount: number;
  lastActivityAt: number;
}

// Friend Balance Type (for auto-generated friends from bills)
export interface FriendBalance {
  friendId: string;
  friendName: string;
  friendEmail: string;
  balance: number; // positive = they owe you, negative = you owe them
  billCount: number;
  lastActivityAt: number;
}

// Update Bill interface to add optional groupId
export interface BillWithGroup extends Bill {
  groupId?: string; // NEW: optional group association
}

// Push Notification Types
export interface PushToken {
  userId: string;
  token: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  createdAt: number;
  updatedAt: number;
}

export interface PokeNotification {
  id: string;
  fromUserId: string;
  toUserId: string;
  billId?: string;
  amount?: number;
  createdAt: number;
  read: boolean;
}

export interface PokeParams {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toPushToken: string;
  billId?: string;
  billTitle?: string;
  amount?: number;
  message?: string;
}

// Navigation Types
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  CreateBill: undefined | { bill?: Bill; groupId?: string };
  BillDetail: { billId: string };
  CreateGroup: undefined | { group?: Group };
  GroupDetail: { groupId: string };
  AddFriend: undefined;
  Payment: { billId?: string; friendId: string; friendName: string; amount: number };
  EditProfile: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Friends: undefined;
  Groups: undefined;
  Activity: undefined;
  Profile: undefined;
};
