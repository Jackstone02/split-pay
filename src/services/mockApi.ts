import {
  getUsers,
  saveUsers,
  getBills,
  saveBills,
  getGroups,
  saveGroups,
  getActivities,
  saveActivities,
} from '../utils/storage';
import { generatePaymentGraph } from '../utils/calculations';
import {
  User,
  Bill,
  CreateBillData,
  AuthResponse,
  UserBillsSummary,
  Group,
  CreateGroupData,
  Activity,
  ActivityType,
  FriendBalance,
} from '../types';

// Simulate network delay
const delay = (ms = 300): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Mock seed data
const MOCK_USERS: User[] = [
  {
    id: 'user_1',
    email: 'john@example.com',
    name: 'John Doe',
    phone: '09171234567', // Sample GCash number
    createdAt: Date.now(),
  },
  {
    id: 'user_2',
    email: 'jane@example.com',
    name: 'Jane Smith',
    phone: '09281234567', // Sample Maya number
    createdAt: Date.now(),
  },
  {
    id: 'user_3',
    email: 'mike@example.com',
    name: 'Mike Johnson',
    phone: '09351234567', // Sample GCash number
    createdAt: Date.now(),
  },
  {
    id: 'user_4',
    email: 'sarah@example.com',
    name: 'Sarah Williams',
    phone: '09451234567', // Sample Maya number
    createdAt: Date.now(),
  },
];

export const mockApi = {
  // ===== USER ENDPOINTS =====

  /**
   * Get all available users for adding to bills
   */
  async getAllUsers(): Promise<User[]> {
    await delay();
    try {
      const users = await getUsers();
      return users.length > 0 ? users : MOCK_USERS;
    } catch (error) {
      return MOCK_USERS;
    }
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    await delay();
    const users = await this.getAllUsers();
    return users.find(u => u.id === userId) || null;
  },

  /**
   * Get multiple users by IDs
   */
  async getUsersByIds(userIds: string[]): Promise<User[]> {
    await delay();
    const users = await this.getAllUsers();
    return users.filter(u => userIds.includes(u.id));
  },

  /**
   * Search users by name or email
   */
  async searchUsers(query: string): Promise<User[]> {
    await delay();
    const users = await this.getAllUsers();
    const lowercaseQuery = query.toLowerCase();
    return users.filter(
      u =>
        u.name.toLowerCase().includes(lowercaseQuery) ||
        u.email.toLowerCase().includes(lowercaseQuery)
    );
  },

  // ===== AUTHENTICATION ENDPOINTS =====

  /**
   * Signup new user
   */
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    await delay(500);

    // Validation
    if (!email || !password || !name) {
      throw new Error('All fields are required');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const users = await getUsers();
    if (users.some(u => u.email === email)) {
      throw new Error('Email already registered');
    }

    // Create new user
    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      name,
      createdAt: Date.now(),
    };

    users.push(newUser);
    await saveUsers(users);

    return {
      user: newUser,
      token: `token_${newUser.id}_${Date.now()}`,
    };
  },

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    await delay(500);

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const users = await getUsers();
    let user = users.find(u => u.email === email);

    // If user doesn't exist, use mock users
    if (!user) {
      user = MOCK_USERS.find(u => u.email === email);
    }

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // For demo, accept any password for mock users, check length for real users
    if (users.includes(user) && password.length < 6) {
      throw new Error('Invalid password');
    }

    return {
      user,
      token: `token_${user.id}_${Date.now()}`,
    };
  },

  // ===== BILL ENDPOINTS =====

  /**
   * Create a new bill
   */
  async createBill(billData: CreateBillData): Promise<Bill> {
    await delay(400);

    if (!billData.title || billData.totalAmount <= 0) {
      throw new Error('Invalid bill data');
    }

    const newBill: Bill = {
      id: `bill_${Date.now()}`,
      title: billData.title,
      totalAmount: parseFloat(billData.totalAmount.toString()),
      paidBy: billData.paidBy,
      participants: billData.participants,
      splitMethod: billData.splitMethod,
      splits: billData.splits,
      payments: generatePaymentGraph({ paidBy: billData.paidBy, splits: billData.splits }),
      description: billData.description || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const bills = await getBills();
    bills.push(newBill);
    await saveBills(bills);

    return newBill;
  },

  /**
   * Get all bills
   */
  async getAllBills(): Promise<Bill[]> {
    await delay();
    return await getBills();
  },

  /**
   * Get bills for a specific user
   */
  async getUserBills(userId: string): Promise<Bill[]> {
    await delay();
    const bills = await getBills();
    return bills.filter(
      bill =>
        bill.paidBy === userId ||
        bill.participants.includes(userId)
    );
  },

  /**
   * Get bill by ID
   */
  async getBillById(billId: string): Promise<Bill | null> {
    await delay();
    const bills = await getBills();
    return bills.find(b => b.id === billId) || null;
  },

  /**
   * Update bill
   */
  async updateBill(billId: string, updates: Partial<Bill>): Promise<Bill> {
    await delay(400);

    const bills = await getBills();
    const index = bills.findIndex(b => b.id === billId);

    if (index === -1) {
      throw new Error('Bill not found');
    }

    const updatedBill: Bill = {
      ...bills[index],
      ...updates,
      updatedAt: Date.now(),
    };

    // Regenerate payments if splits changed
    if (updates.splits) {
      updatedBill.payments = generatePaymentGraph(updatedBill);
    }

    bills[index] = updatedBill;
    await saveBills(bills);

    return updatedBill;
  },

  /**
   * Delete bill
   */
  async deleteBill(billId: string): Promise<{ success: boolean }> {
    await delay(400);

    const bills = await getBills();
    const filteredBills = bills.filter(b => b.id !== billId);

    if (filteredBills.length === bills.length) {
      throw new Error('Bill not found');
    }

    await saveBills(filteredBills);
    return { success: true };
  },

  /**
   * Mark payment as paid/unpaid
   */
  async updatePaymentStatus(
    billId: string,
    paymentIndex: number,
    isPaid: boolean
  ): Promise<Bill> {
    await delay(300);

    const bill = await this.getBillById(billId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (paymentIndex < 0 || paymentIndex >= bill.payments.length) {
      throw new Error('Payment not found');
    }

    bill.payments[paymentIndex].isPaid = isPaid;
    if (isPaid) {
      bill.payments[paymentIndex].paidAt = Date.now();
    } else {
      delete bill.payments[paymentIndex].paidAt;
    }

    return await this.updateBill(billId, {
      payments: bill.payments,
    });
  },

  /**
   * Get bills summary for user
   */
  async getUserBillsSummary(userId: string): Promise<UserBillsSummary> {
    await delay();
    const bills = await this.getUserBills(userId);

    let totalOwed = 0;
    let totalOwing = 0;
    let totalSettled = 0;

    bills.forEach(bill => {
      // Calculate how much this user paid for others
      if (bill.paidBy === userId) {
        bill.splits.forEach(split => {
          if (split.userId !== userId) {
            totalOwed += split.amount;
          }
        });
      }

      // Calculate how much this user owes
      const userSplit = bill.splits.find(s => s.userId === userId);
      if (userSplit && bill.paidBy !== userId) {
        totalOwing += userSplit.amount;
      }

      // Count settled payments
      if (bill.payments) {
        bill.payments.forEach(payment => {
          if (payment.isPaid) {
            totalSettled += payment.amount;
          }
        });
      }
    });

    return {
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalOwing: parseFloat(totalOwing.toFixed(2)),
      totalSettled: parseFloat(totalSettled.toFixed(2)),
      balance: parseFloat((totalOwed - totalOwing).toFixed(2)),
      billCount: bills.length,
    };
  },

  /**
   * Initialize mock data (call this on first app launch)
   */
  async initializeMockData(): Promise<void> {
    await delay();
    const users = await getUsers();
    const bills = await getBills();

    // Only initialize if empty
    if (users.length === 0) {
      await saveUsers(MOCK_USERS);
    }

    // Create sample bills if none exist
    if (bills.length === 0) {
      const sampleBills: Bill[] = [
        {
          id: 'bill_1',
          title: 'Dinner at Restaurant',
          totalAmount: 120,
          paidBy: 'user_1',
          participants: ['user_1', 'user_2', 'user_3'],
          splitMethod: 'equal',
          splits: [
            { userId: 'user_1', amount: 40 },
            { userId: 'user_2', amount: 40 },
            { userId: 'user_3', amount: 40 },
          ],
          payments: [
            { fromUserId: 'user_2', toUserId: 'user_1', amount: 40, isPaid: false },
            { fromUserId: 'user_3', toUserId: 'user_1', amount: 40, isPaid: false },
          ],
          description: 'Dinner with friends',
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 86400000,
        },
        {
          id: 'bill_2',
          title: 'Movie and Snacks',
          totalAmount: 90,
          paidBy: 'user_2',
          participants: ['user_1', 'user_2', 'user_4'],
          splitMethod: 'equal',
          splits: [
            { userId: 'user_1', amount: 30 },
            { userId: 'user_2', amount: 30 },
            { userId: 'user_4', amount: 30 },
          ],
          payments: [
            {
              fromUserId: 'user_1',
              toUserId: 'user_2',
              amount: 30,
              isPaid: true,
              paidAt: Date.now() - 3600000,
            },
            {
              fromUserId: 'user_4',
              toUserId: 'user_2',
              amount: 30,
              isPaid: false,
            },
          ],
          description: 'Movie night',
          createdAt: Date.now() - 172800000,
          updatedAt: Date.now() - 172800000,
        },
      ];
      await saveBills(sampleBills);
    }
  },

  // ===== GROUP ENDPOINTS =====

  /**
   * Create a new group
   */
  async createGroup(groupData: CreateGroupData, userId?: string): Promise<Group> {
    await delay(400);

    if (!groupData.name || groupData.members.length === 0) {
      throw new Error('Group name and members are required');
    }

    const newGroup: Group = {
      id: `group_${Date.now()}`,
      name: groupData.name,
      description: groupData.description || '',
      members: groupData.members,
      createdBy: userId || groupData.members[0], // Use provided userId or first member
      category: groupData.category || 'other',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const groups = await getGroups();
    groups.push(newGroup);
    await saveGroups(groups);

    return newGroup;
  },

  /**
   * Get all groups
   */
  async getAllGroups(): Promise<Group[]> {
    await delay();
    return await getGroups();
  },

  /**
   * Get groups for a specific user
   */
  async getUserGroups(userId: string): Promise<Group[]> {
    await delay();
    const groups = await getGroups();
    return groups.filter(group => group.members.includes(userId));
  },

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string): Promise<Group | null> {
    await delay();
    const groups = await getGroups();
    return groups.find(g => g.id === groupId) || null;
  },

  /**
   * Update group
   */
  async updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
    await delay(400);

    const groups = await getGroups();
    const index = groups.findIndex(g => g.id === groupId);

    if (index === -1) {
      throw new Error('Group not found');
    }

    const updatedGroup = {
      ...groups[index],
      ...updates,
      updatedAt: Date.now(),
    };

    groups[index] = updatedGroup;
    await saveGroups(groups);

    return updatedGroup;
  },

  /**
   * Delete group
   */
  async deleteGroup(groupId: string): Promise<{ success: boolean }> {
    await delay(400);

    const groups = await getGroups();
    const filteredGroups = groups.filter(g => g.id !== groupId);

    if (filteredGroups.length === groups.length) {
      throw new Error('Group not found');
    }

    await saveGroups(filteredGroups);
    return { success: true };
  },

  /**
   * Add member to group
   */
  async addGroupMember(groupId: string, userId: string): Promise<Group> {
    await delay(300);

    const group = await this.getGroupById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (group.members.includes(userId)) {
      throw new Error('User already in group');
    }

    group.members.push(userId);
    return await this.updateGroup(groupId, { members: group.members });
  },

  /**
   * Remove member from group
   */
  async removeGroupMember(groupId: string, userId: string): Promise<Group> {
    await delay(300);

    const group = await this.getGroupById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    group.members = group.members.filter(id => id !== userId);
    return await this.updateGroup(groupId, { members: group.members });
  },

  // ===== ACTIVITY ENDPOINTS =====

  /**
   * Create an activity entry
   */
  async createActivity(
    activity: Omit<Activity, 'id' | 'createdAt'>
  ): Promise<Activity> {
    await delay(200);

    const newActivity: Activity = {
      ...activity,
      id: `activity_${Date.now()}`,
      createdAt: Date.now(),
    };

    const activities = await getActivities();
    activities.push(newActivity);
    await saveActivities(activities);

    return newActivity;
  },

  /**
   * Get activities for a user
   */
  async getUserActivities(userId: string, limit: number = 50): Promise<Activity[]> {
    await delay();
    const activities = await getActivities();
    // Filter activities related to user (created by user, or related to their bills/groups)
    return activities
      .filter(
        activity =>
          activity.userId === userId ||
          activity.targetUserId === userId
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /**
   * Get all activities
   */
  async getAllActivities(limit: number = 50): Promise<Activity[]> {
    await delay();
    const activities = await getActivities();
    return activities
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  // ===== FRIEND BALANCE ENDPOINTS =====

  /**
   * Calculate friend balances for a user
   */
  async getFriendBalances(userId: string): Promise<FriendBalance[]> {
    await delay();
    const bills = await this.getUserBills(userId);
    const users = await this.getAllUsers();
    const friendBalances: { [friendId: string]: FriendBalance } = {};

    // Calculate balance with each friend
    bills.forEach(bill => {
      bill.participants.forEach(participantId => {
        if (participantId !== userId) {
          if (!friendBalances[participantId]) {
            const friend = users.find(u => u.id === participantId);
            friendBalances[participantId] = {
              friendId: participantId,
              friendName: friend?.name || '',
              friendEmail: friend?.email || '',
              balance: 0,
              billCount: 0,
              lastActivityAt: 0,
            };
          }

          // Update bill count
          friendBalances[participantId].billCount += 1;
          friendBalances[participantId].lastActivityAt = bill.updatedAt;

          // Calculate balance
          if (bill.paidBy === userId) {
            // User paid, so friend owes them
            const split = bill.splits.find(s => s.userId === participantId);
            if (split) {
              friendBalances[participantId].balance += split.amount;
            }
          } else if (bill.paidBy === participantId) {
            // Friend paid, so user owes them
            const split = bill.splits.find(s => s.userId === userId);
            if (split) {
              friendBalances[participantId].balance -= split.amount;
            }
          }
        }
      });
    });

    // Round balances and convert to array
    if (!friendBalances || typeof friendBalances !== 'object') {
      return [];
    }
    return Object.values(friendBalances).map(fb => ({
      ...fb,
      balance: parseFloat(fb.balance.toFixed(2)),
    }));
  },

  /**
   * Get balance with a specific friend
   */
  async getBalanceWithFriend(userId: string, friendId: string): Promise<number> {
    await delay();
    const friendBalances = await this.getFriendBalances(userId);
    const balance = friendBalances.find(fb => fb.friendId === friendId);
    return balance?.balance || 0;
  },
};
