import { supabase } from './supabase';
import { User, Friend, Bill, CreateBillData, Split } from '../types';
import { generatePaymentGraph } from '../utils/calculations';

export const supabaseApi = {
  // ===== USER SEARCH =====

  /**
   * Search users by username or email
   */
  async searchUsers(query: string): Promise<User[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = `%${query.toLowerCase()}%`;

    const { data, error } = await supabase
      .schema('amot')
      .from('user_profiles')
      .select(`
        id,
        email,
        display_name,
        avatar_url,
        phone,
        payment_method,
        users(profile_created_at)
      `)
      .or(`email.ilike.${searchTerm},display_name.ilike.${searchTerm}`)
      .limit(20);

    if (error) {
      console.error('Error searching users:', error);
      throw new Error('Failed to search users');
    }

    return (data || []).map((profile: any) => ({
      id: profile.id,
      email: profile.email,
      name: profile.display_name || profile.email?.split('@')[0] || 'User',
      phone: profile.phone,
      paymentMethod: profile.payment_method,
      createdAt: new Date(profile.users?.created_at).getTime(),
    }));
  },

  /**
   * Get users by their IDs
   */
  async getUsersByIds(userIds: string[]): Promise<User[]> {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .schema('amot')
      .from('user_profiles')
      .select(`
        id,
        email,
        display_name,
        avatar_url,
        phone,
        payment_method,
        created_at
      `)
      .in('id', userIds);

    if (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }

    return (data || []).map((profile: any) => ({
      id: profile.id,
      email: profile.email,
      name: profile.display_name || profile.email?.split('@')[0] || 'User',
      phone: profile.phone,
      paymentMethod: profile.payment_method,
      createdAt: new Date(profile.created_at).getTime(),
    }));
  },

  // ===== FRIEND MANAGEMENT =====

  /**
   * Get all friends for a user
   */
  async getFriends(userId: string): Promise<Friend[]> {
    const { data, error } = await supabase
      .schema('amot')
      .from('friends')
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        updated_at,
        friend:users!friend_id(
          id,
          email,
          user_profiles(display_name, avatar_url, phone, payment_method)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching friends:', error);
      throw new Error('Failed to fetch friends');
    }

    return (data || []).map((friendship: any) => ({
      id: friendship.id,
      userId: friendship.user_id,
      friendId: friendship.friend_id,
      friendName: friendship.friend?.user_profiles?.display_name || friendship.friend.email?.split('@')[0] || 'User',
      friendEmail: friendship.friend.email,
      status: friendship.status,
      createdAt: new Date(friendship.created_at).getTime(),
      updatedAt: new Date(friendship.updated_at).getTime(),
    }));
  },

  /**
   * Add a friend (instant add - status: accepted)
   */
  async addFriend(userId: string, friendId: string): Promise<Friend> {
    // Check if already friends
    const { data: existing } = await supabase
      .schema('amot')
      .from('friends')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .eq('status', 'accepted')
      .single();

    if (existing) {
      throw new Error('Already friends with this user');
    }

    // Get friend details
    const { data: friendUser, error: userError } = await supabase
      .schema('amot')
      .from('users')
      .select(`
        id,
        email,
        user_profiles(display_name, avatar_url, phone)
      `)
      .eq('id', friendId)
      .single();

    if (userError || !friendUser) {
      throw new Error('User not found');
    }

    // Create friendship with instant accept
    const { data, error } = await supabase
      .schema('amot')
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: 'accepted',
      })
      .select('id, user_id, friend_id, status, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error adding friend:', error);
      throw new Error('Failed to add friend');
    }

    return {
      id: data.id,
      userId: data.user_id,
      friendId: data.friend_id,
      friendName: (friendUser as any).user_profiles?.display_name || friendUser.email?.split('@')[0] || 'User',
      friendEmail: friendUser.email,
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  },

  /**
   * Remove a friend
   */
  async removeFriend(userId: string, friendshipId: string): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('friends')
      .delete()
      .eq('id', friendshipId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing friend:', error);
      throw new Error('Failed to remove friend');
    }
  },

  /**
   * Check if two users are friends
   */
  async areFriends(userId: string, friendId: string): Promise<boolean> {
    const { data } = await supabase
      .schema('amot')
      .from('friends')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .eq('status', 'accepted')
      .single();

    return !!data;
  },

  // ===== BILL MANAGEMENT =====

  /**
   * Create a new bill with splits
   */
  async createBill(billData: CreateBillData, userId: string, groupId?: string): Promise<Bill> {
    // Validate splits total matches bill total
    const splitsTotal = billData.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(splitsTotal - billData.totalAmount) > 0.01) {
      throw new Error('Split amounts must equal the total bill amount');
    }

    // Create the bill
    const { data: billRecord, error: billError } = await supabase
      .schema('amot')
      .from('bills')
      .insert({
        title: billData.title,
        description: billData.description,
        total_amount: billData.totalAmount,
        paid_by: billData.paidBy,
        group_id: groupId || null,
        created_by: userId,
        currency: 'PHP',
        settled: false,
      })
      .select('*')
      .single();

    if (billError || !billRecord) {
      console.error('Error creating bill:', billError);
      throw new Error('Failed to create bill');
    }

    // Create bill splits
    const splitRecords = billData.splits.map((split) => ({
      bill_id: billRecord.id,
      user_id: split.userId,
      amount: split.amount,
      share_type: billData.splitMethod,
      percent: split.percentage || null,
      settled: false,
    }));

    const { error: splitsError } = await supabase
      .schema('amot')
      .from('bill_splits')
      .insert(splitRecords);

    if (splitsError) {
      // Rollback: delete the bill if splits creation failed
      await supabase.schema('amot').from('bills').delete().eq('id', billRecord.id);
      console.error('Error creating bill splits:', splitsError);
      throw new Error('Failed to create bill splits');
    }

    // Generate payments from splits
    const bill = {
      id: billRecord.id,
      title: billRecord.title,
      description: billRecord.description || '',
      totalAmount: Number(billRecord.total_amount),
      paidBy: billRecord.paid_by,
      participants: billData.participants,
      splitMethod: billData.splitMethod,
      splits: billData.splits,
      payments: generatePaymentGraph({ paidBy: billRecord.paid_by, splits: billData.splits }),
      createdAt: new Date(billRecord.created_at).getTime(),
      updatedAt: new Date(billRecord.created_at).getTime(),
    };

    // Return the created bill with splits
    return bill;
  },

  /**
   * Get all bills for a user (where they are payer or have a split)
   */
  async getBills(userId: string): Promise<Bill[]> {
    // Get bills where user is the payer
    const { data: paidBills, error: paidError } = await supabase
      .schema('amot')
      .from('bills')
      .select(`
        *,
        bill_splits(
          id,
          user_id,
          amount,
          share_type,
          percent,
          settled,
          settled_at
        )
      `)
      .eq('paid_by', userId)
      .order('created_at', { ascending: false });

    if (paidError) {
      console.error('Error fetching paid bills:', paidError);
      throw new Error('Failed to fetch bills');
    }

    // Get bills where user has a split
    const { data: splitBills, error: splitError } = await supabase
      .schema('amot')
      .from('bill_splits')
      .select(`
        bill:bills(
          *,
          bill_splits(
            id,
            user_id,
            amount,
            share_type,
            percent,
            settled,
            settled_at
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (splitError) {
      console.error('Error fetching split bills:', splitError);
      throw new Error('Failed to fetch bills');
    }

    // Combine and deduplicate bills
    const billsMap = new Map<string, any>();

    (paidBills || []).forEach((bill) => {
      billsMap.set(bill.id, bill);
    });

    (splitBills || []).forEach((item: any) => {
      if (item.bill && !billsMap.has(item.bill.id)) {
        billsMap.set(item.bill.id, item.bill);
      }
    });

    // Transform to Bill type
    return Array.from(billsMap.values()).map((billRecord) => {
      const splits = (billRecord.bill_splits || []).map((split: any) => ({
        userId: split.user_id,
        amount: Number(split.amount),
        percentage: split.percent ? Number(split.percent) : undefined,
      }));

      return {
        id: billRecord.id,
        title: billRecord.title,
        description: billRecord.description || '',
        totalAmount: Number(billRecord.total_amount),
        paidBy: billRecord.paid_by,
        participants: Array.from(new Set((billRecord.bill_splits || []).map((s: any) => s.user_id))),
        splitMethod: billRecord.bill_splits?.[0]?.share_type || 'equal',
        splits,
        payments: generatePaymentGraph({ paidBy: billRecord.paid_by, splits }),
        createdAt: new Date(billRecord.created_at).getTime(),
        updatedAt: new Date(billRecord.updated_at || billRecord.created_at).getTime(),
      };
    });
  },

  /**
   * Get a specific bill by ID
   */
  async getBillById(billId: string): Promise<Bill | null> {
    const { data: billRecord, error } = await supabase
      .schema('amot')
      .from('bills')
      .select(`
        *,
        bill_splits(
          id,
          user_id,
          amount,
          share_type,
          percent,
          settled,
          settled_at
        )
      `)
      .eq('id', billId)
      .single();

    if (error) {
      console.error('Error fetching bill:', error);
      return null;
    }

    if (!billRecord) {
      return null;
    }

    const splits = (billRecord.bill_splits || []).map((split: any) => ({
      userId: split.user_id,
      amount: Number(split.amount),
      percentage: split.percent ? Number(split.percent) : undefined,
    }));

    return {
      id: billRecord.id,
      title: billRecord.title,
      description: billRecord.description || '',
      totalAmount: Number(billRecord.total_amount),
      paidBy: billRecord.paid_by,
      participants: Array.from(new Set((billRecord.bill_splits || []).map((s: any) => s.user_id))),
      splitMethod: billRecord.bill_splits?.[0]?.share_type || 'equal',
      splits,
      payments: generatePaymentGraph({ paidBy: billRecord.paid_by, splits }),
      createdAt: new Date(billRecord.created_at).getTime(),
      updatedAt: new Date(billRecord.updated_at || billRecord.created_at).getTime(),
    };
  },

  /**
   * Update a bill and its splits
   */
  async updateBill(billId: string, billData: CreateBillData, userId: string): Promise<Bill> {
    // Validate splits total matches bill total
    const splitsTotal = billData.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(splitsTotal - billData.totalAmount) > 0.01) {
      throw new Error('Split amounts must equal the total bill amount');
    }

    // Update the bill
    const { data: billRecord, error: billError } = await supabase
      .schema('amot')
      .from('bills')
      .update({
        title: billData.title,
        description: billData.description,
        total_amount: billData.totalAmount,
        paid_by: billData.paidBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', billId)
      .select('*')
      .single();

    if (billError || !billRecord) {
      console.error('Error updating bill:', billError);
      throw new Error('Failed to update bill');
    }

    // Delete existing splits
    const { error: deleteError } = await supabase
      .schema('amot')
      .from('bill_splits')
      .delete()
      .eq('bill_id', billId);

    if (deleteError) {
      console.error('Error deleting old splits:', deleteError);
      throw new Error('Failed to update bill splits');
    }

    // Create new splits
    const splitRecords = billData.splits.map((split) => ({
      bill_id: billRecord.id,
      user_id: split.userId,
      amount: split.amount,
      share_type: billData.splitMethod,
      percent: split.percentage || null,
      settled: false,
    }));

    const { error: splitsError } = await supabase
      .schema('amot')
      .from('bill_splits')
      .insert(splitRecords);

    if (splitsError) {
      console.error('Error creating new splits:', splitsError);
      throw new Error('Failed to update bill splits');
    }

    return {
      id: billRecord.id,
      title: billRecord.title,
      description: billRecord.description || '',
      totalAmount: Number(billRecord.total_amount),
      paidBy: billRecord.paid_by,
      participants: billData.participants,
      splitMethod: billData.splitMethod,
      splits: billData.splits,
      payments: generatePaymentGraph({ paidBy: billRecord.paid_by, splits: billData.splits }),
      createdAt: new Date(billRecord.created_at).getTime(),
      updatedAt: new Date(billRecord.updated_at || billRecord.created_at).getTime(),
    };
  },

  /**
   * Delete a bill and its splits
   */
  async deleteBill(billId: string, userId: string): Promise<void> {
    // First delete all splits (cascade should handle this, but doing it explicitly)
    const { error: splitsError } = await supabase
      .schema('amot')
      .from('bill_splits')
      .delete()
      .eq('bill_id', billId);

    if (splitsError) {
      console.error('Error deleting bill splits:', splitsError);
      throw new Error('Failed to delete bill splits');
    }

    // Then delete the bill
    const { error: billError } = await supabase
      .schema('amot')
      .from('bills')
      .delete()
      .eq('id', billId)
      .eq('created_by', userId);

    if (billError) {
      console.error('Error deleting bill:', billError);
      throw new Error('Failed to delete bill');
    }
  },

  /**
   * Get bills for a specific group
   */
  async getBillsByGroup(groupId: string): Promise<Bill[]> {
    const { data: bills, error } = await supabase
      .schema('amot')
      .from('bills')
      .select(`
        *,
        bill_splits(
          id,
          user_id,
          amount,
          share_type,
          percent,
          settled,
          settled_at
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching group bills:', error);
      throw new Error('Failed to fetch group bills');
    }

    return (bills || []).map((billRecord) => {
      const splits = (billRecord.bill_splits || []).map((split: any) => ({
        userId: split.user_id,
        amount: Number(split.amount),
        percentage: split.percent ? Number(split.percent) : undefined,
      }));

      return {
        id: billRecord.id,
        title: billRecord.title,
        description: billRecord.description || '',
        totalAmount: Number(billRecord.total_amount),
        paidBy: billRecord.paid_by,
        participants: Array.from(new Set((billRecord.bill_splits || []).map((s: any) => s.user_id))),
        splitMethod: billRecord.bill_splits?.[0]?.share_type || 'equal',
        splits,
        payments: generatePaymentGraph({ paidBy: billRecord.paid_by, splits }),
        createdAt: new Date(billRecord.created_at).getTime(),
        updatedAt: new Date(billRecord.updated_at || billRecord.created_at).getTime(),
      };
    });
  },
};
