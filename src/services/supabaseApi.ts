import { supabase } from './supabase';
import { User, Friend, Bill, CreateBillData, Split, Group, CreateGroupData } from '../types';
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

  /**
   * Get current user profile from user_profiles table
   */
  async getUserProfile(userId: string): Promise<User | null> {
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
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.display_name || data.email?.split('@')[0] || 'User',
      phone: data.phone,
      paymentMethod: data.payment_method,
      createdAt: new Date(data.created_at).getTime(),
    };
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
        category: billData.category || 'other',
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
      groupId: billRecord.group_id || undefined,
      category: billRecord.category || undefined,
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
        settled: split.settled || false,
        settledAt: split.settled_at ? new Date(split.settled_at).getTime() : undefined,
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
        groupId: billRecord.group_id || undefined,
        category: billRecord.category || undefined,
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
      settled: split.settled || false,
      settledAt: split.settled_at ? new Date(split.settled_at).getTime() : undefined,
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
      category: billRecord.category || undefined,
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
        category: billData.category || 'other',
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
      category: billRecord.category || undefined,
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
        settled: split.settled || false,
        settledAt: split.settled_at ? new Date(split.settled_at).getTime() : undefined,
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
        groupId: billRecord.group_id || undefined,
        category: billRecord.category || undefined,
        createdAt: new Date(billRecord.created_at).getTime(),
        updatedAt: new Date(billRecord.updated_at || billRecord.created_at).getTime(),
      };
    });
  },

  /**
   * Get unsettled bills for a specific user in a group
   * Used to check if a member can be removed from a group
   */
  async getUnsettledBillsForMemberInGroup(groupId: string, userId: string): Promise<Bill[]> {
    const { data: bills, error } = await supabase
      .schema('amot')
      .from('bills')
      .select(`
        *,
        bill_splits!inner(
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
      .eq('bill_splits.user_id', userId)
      .eq('bill_splits.settled', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unsettled bills:', error);
      throw new Error('Failed to fetch unsettled bills');
    }

    return (bills || []).map((billRecord) => {
      const splits = (billRecord.bill_splits || []).map((split: any) => ({
        userId: split.user_id,
        amount: Number(split.amount),
        percentage: split.percent ? Number(split.percent) : undefined,
        settled: split.settled || false,
        settledAt: split.settled_at ? new Date(split.settled_at).getTime() : undefined,
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
        groupId: billRecord.group_id || undefined,
        category: billRecord.category || undefined,
        createdAt: new Date(billRecord.created_at).getTime(),
        updatedAt: new Date(billRecord.updated_at || billRecord.created_at).getTime(),
      };
    });
  },

  // ===== PAYMENT MANAGEMENT =====

  /**
   * Mark a bill split as settled (paid)
   * Directly updates the bill_splits table
   */
  async markBillSplitAsSettled(
    billId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('bill_splits')
      .update({
        settled: true,
        settled_at: new Date().toISOString(),
      })
      .eq('bill_id', billId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking bill split as settled:', error);
      throw new Error('Failed to mark payment as paid');
    }
  },

  /**
   * Unmark a bill split (set as unpaid)
   * Directly updates the bill_splits table
   */
  async unmarkBillSplit(
    billId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('bill_splits')
      .update({
        settled: false,
        settled_at: null,
      })
      .eq('bill_id', billId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error unmarking bill split:', error);
      throw new Error('Failed to unmark payment');
    }
  },

  /**
   * Create a payment record (optional, for tracking)
   */
  async createPaymentRecord(params: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    paymentMethod?: string;
    note?: string;
    externalReference?: string;
  }): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('payments')
      .insert({
        from_user: params.fromUserId,
        to_user: params.toUserId,
        amount: params.amount,
        payment_method: params.paymentMethod || null,
        note: params.note || null,
        external_reference: params.externalReference || null,
      });

    if (error) {
      console.error('Error creating payment record:', error);
      // Don't throw - payment record is optional
    }
  },

  /**
   * Mark a bill payment as paid
   * Updates bill_splits and optionally creates a payment record
   */
  async markBillPaymentAsPaid(
    billId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    paymentMethod: string = 'manual',
    referenceNumber?: string
  ): Promise<void> {
    // Mark the bill split as settled
    await this.markBillSplitAsSettled(billId, fromUserId);

    // Optionally create a payment record for tracking
    await this.createPaymentRecord({
      fromUserId,
      toUserId,
      amount,
      paymentMethod,
      note: `Payment for bill`,
      externalReference: referenceNumber,
    });
  },

  /**
   * Unmark a bill payment (undo marking as paid)
   */
  async unmarkBillPayment(
    billId: string,
    fromUserId: string
  ): Promise<void> {
    await this.unmarkBillSplit(billId, fromUserId);
  },

  // ==================== PUSH TOKEN MANAGEMENT ====================

  /**
   * Save or update user's push token
   */
  async savePushToken(params: {
    userId: string;
    token: string;
    deviceId: string;
    platform: 'ios' | 'android' | 'web';
  }): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('push_tokens')
      .upsert({
        user_id: params.userId,
        token: params.token,
        device_id: params.deviceId,
        platform: params.platform,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_id',
      });

    if (error) throw error;
  },

  /**
   * Get push token for a specific user and device
   */
  async getPushToken(userId: string, deviceId?: string): Promise<string | null> {
    let query = supabase
      .schema('amot')
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }

    return data?.token || null;
  },

  /**
   * Get all push tokens for a user (all devices)
   */
  async getUserPushTokens(userId: string): Promise<Array<{ token: string; deviceId: string; platform: string }>> {
    const { data, error } = await supabase
      .schema('amot')
      .from('push_tokens')
      .select('token, device_id, platform')
      .eq('user_id', userId);

    if (error) throw error;

    return data || [];
  },

  /**
   * Delete push token
   */
  async deletePushToken(userId: string, deviceId: string): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    if (error) throw error;
  },

  // ==================== POKE NOTIFICATIONS ====================

  /**
   * Send a poke notification
   */
  async sendPoke(params: {
    fromUserId: string;
    toUserId: string;
    billId?: string;
    amount?: number;
    message?: string;
  }): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('poke_history')
      .insert({
        from_user_id: params.fromUserId,
        to_user_id: params.toUserId,
        bill_id: params.billId,
        amount: params.amount,
        message: params.message,
        read: false,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
  },

  /**
   * Get poke history for a user
   */
  async getPokeHistory(userId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .schema('amot')
      .from('poke_history')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  },

  /**
   * Mark poke as read
   */
  async markPokeAsRead(pokeId: string): Promise<void> {
    const { error } = await supabase
      .schema('amot')
      .from('poke_history')
      .update({ read: true })
      .eq('id', pokeId);

    if (error) throw error;
  },

  /**
   * Check if user can poke another user
   * Returns eligibility status and unpaid bill details
   */
  async canPoke(fromUserId: string, toUserId: string): Promise<{
    canPoke: boolean;
    reason?: string;
    unpaidBills: any[];
    totalOwed: number;
  }> {
    // Get all bills where fromUser is the payer
    const bills = await this.getBills(fromUserId);

    // Find bills where:
    // 1. fromUser paid the bill (paidBy === fromUserId)
    // 2. toUser has an unsettled split
    const unpaidBills = bills.filter(bill => {
      if (bill.paidBy !== fromUserId) return false;

      const toUserSplit = bill.splits.find(
        split => split.userId === toUserId && !split.settled
      );

      return !!toUserSplit;
    });

    const totalOwed = unpaidBills.reduce((sum, bill) => {
      const toUserSplit = bill.splits.find(s => s.userId === toUserId);
      return sum + (toUserSplit?.amount || 0);
    }, 0);

    const canPoke = unpaidBills.length > 0 && totalOwed > 0;

    return {
      canPoke,
      reason: canPoke ? undefined : 'No unpaid bills found',
      unpaidBills,
      totalOwed,
    };
  },

  /**
   * Get unread pokes for a user from the last 24 hours
   * @param userId User ID to get pokes for
   * @returns Array of recent unread pokes with sender info
   */
  async getRecentUnreadPokes(userId: string): Promise<Array<{
    id: string;
    fromUserId: string;
    fromUserName: string;
    billId?: string;
    billTitle?: string;
    amount?: number;
    message?: string;
    createdAt: string;
  }>> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .schema('amot')
        .from('poke_history')
        .select(`
          id,
          from_user_id,
          bill_id,
          amount,
          message,
          created_at
        `)
        .eq('to_user_id', userId)
        .eq('read', false)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // Get sender user info for each poke
      const pokesWithUserInfo = await Promise.all(
        data.map(async (poke) => {
          // Get sender name
          const { data: userData } = await supabase
            .schema('amot')
            .from('user_profiles')
            .select('display_name')
            .eq('id', poke.from_user_id)
            .single();

          // Get bill title if billId exists
          let billTitle: string | undefined;
          if (poke.bill_id) {
            const { data: billData } = await supabase
              .schema('amot')
              .from('bills')
              .select('title')
              .eq('id', poke.bill_id)
              .single();
            billTitle = billData?.title;
          }

          return {
            id: poke.id,
            fromUserId: poke.from_user_id,
            fromUserName: userData?.display_name || 'Someone',
            billId: poke.bill_id,
            billTitle,
            amount: poke.amount,
            message: poke.message,
            createdAt: poke.created_at,
          };
        })
      );

      return pokesWithUserInfo;
    } catch (error) {
      console.error('Error getting recent unread pokes:', error);
      return [];
    }
  },

  /**
   * Send pending poke notifications to user who just logged in
   * @param userId User ID who just logged in
   * @param pushToken User's push token
   */
  async sendPendingPokeNotifications(userId: string, pushToken: string): Promise<void> {
    try {
      const unreadPokes = await this.getRecentUnreadPokes(userId);

      if (unreadPokes.length === 0) {
        console.log('No pending pokes to send');
        return;
      }

      console.log(`Sending ${unreadPokes.length} pending poke notification(s)`);

      // Import sendPokeNotification dynamically to avoid circular dependency
      const { sendPokeNotification } = await import('./notificationService');

      // Send notification for each recent unread poke
      for (const poke of unreadPokes) {
        try {
          await sendPokeNotification({
            fromUserId: poke.fromUserId,
            fromUserName: poke.fromUserName,
            toUserId: userId,
            toPushToken: pushToken,
            billId: poke.billId,
            billTitle: poke.billTitle,
            amount: poke.amount,
            message: poke.message,
          });

          console.log(`Sent pending poke notification from ${poke.fromUserName}`);
        } catch (error) {
          console.error(`Failed to send poke notification from ${poke.fromUserName}:`, error);
          // Continue sending other notifications even if one fails
        }
      }
    } catch (error) {
      console.error('Error sending pending poke notifications:', error);
      // Don't throw - this is a non-critical operation
    }
  },

  /**
   * Create an activity record for a poke
   * Creates ONE activity record that shows differently based on viewer
   * @param params Activity parameters
   */
  async createPokeActivity(params: {
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    billId?: string;
    billTitle?: string;
    amount?: number;
  }): Promise<void> {
    try {
      const { fromUserId, fromUserName, toUserId, toUserName, billId, billTitle, amount } = params;

      // Create ONE activity record
      // The display logic in ActivityScreen will show different text based on
      // whether the viewer is the actor (fromUser) or target (toUser)
      const payload = {
        fromUserName,
        toUserName,
        billId,
        billTitle,
        amount,
      };

      await supabase.schema('amot').from('activity').insert({
        actor_id: fromUserId,
        action: 'poke',
        target_type: 'user',
        target_id: toUserId,
        payload,
      });

      console.log('Created poke activity');
    } catch (error) {
      console.error('Error creating poke activity:', error);
      // Don't throw - activity creation is non-critical
    }
  },

  /**
   * Get activities for a user from Supabase
   * @param userId User ID to get activities for
   * @param limit Maximum number of activities to return
   * @returns Array of activities
   */
  async getUserActivities(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .schema('amot')
        .from('activity')
        .select('*')
        .or(`actor_id.eq.${userId},target_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Transform Supabase activity format to match mockApi format
      const activities = (data || []).map((activity: any) => {
        let description = activity.payload?.description || '';

        // For poke activities, generate description based on viewer perspective
        if (activity.action === 'poke') {
          const { fromUserName, toUserName, billTitle, amount } = activity.payload || {};
          const isActor = activity.actor_id === userId;

          if (isActor) {
            // User is the one who poked
            description = billTitle
              ? `You poked ${toUserName} about "${billTitle}"`
              : `You poked ${toUserName} about ₱${amount?.toFixed(2) || '0.00'}`;
          } else {
            // User is the one being poked
            description = billTitle
              ? `${fromUserName} poked you about "${billTitle}"`
              : `${fromUserName} poked you about ₱${amount?.toFixed(2) || '0.00'}`;
          }
        }

        return {
          id: activity.id,
          userId: activity.actor_id,
          targetUserId: activity.target_id,
          type: activity.action,
          description,
          amount: activity.payload?.amount,
          createdAt: new Date(activity.created_at).getTime(),
        };
      });

      return activities;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      return [];
    }
  },

  /**
   * Get count of unread poke activities for a user
   * @param userId User ID to check
   * @returns Number of unread poke activities
   */
  async getUnreadPokeCount(userId: string): Promise<number> {
    try {
      // Get unread pokes from poke_history
      const { data, error } = await supabase
        .schema('amot')
        .from('poke_history')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', userId)
        .eq('read', false);

      if (error) throw error;

      return data ? (data as any).length : 0;
    } catch (error) {
      console.error('Error getting unread poke count:', error);
      return 0;
    }
  },

  // ==================== GROUP MANAGEMENT ====================

  /**
   * Get all groups for a user (where they are owner or member)
   */
  async getUserGroups(userId: string): Promise<Group[]> {
    // Get all groups where user is a member
    const { data: groupsData, error } = await supabase
      .schema('amot')
      .from('group_members')
      .select(`
        group:groups(
          id,
          name,
          description,
          owner_id,
          color,
          category,
          created_at,
          updated_at,
          group_members(user_id, role)
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user groups:', error);
      throw new Error('Failed to fetch groups');
    }

    // Transform and deduplicate
    const groupsMap = new Map<string, any>();
    (groupsData || []).forEach((item: any) => {
      if (item.group && !groupsMap.has(item.group.id)) {
        groupsMap.set(item.group.id, item.group);
      }
    });

    // Transform to Group type and sort by created_at descending
    return Array.from(groupsMap.values())
      .map((group: any) => ({
        id: group.id,
        name: group.name,
        description: group.description || undefined,
        members: (group.group_members || []).map((m: any) => m.user_id),
        createdBy: group.owner_id,
        createdAt: new Date(group.created_at).getTime(),
        updatedAt: new Date(group.updated_at).getTime(),
        color: group.color || undefined,
        category: group.category || 'other',
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Create a new group with members
   */
  async createGroup(groupData: CreateGroupData, userId: string): Promise<Group> {
    // Validate input
    if (!groupData.name || groupData.members.length === 0) {
      throw new Error('Group name and members are required');
    }

    // Create the group
    const { data: groupRecord, error: groupError } = await supabase
      .schema('amot')
      .from('groups')
      .insert({
        name: groupData.name,
        description: groupData.description || null,
        owner_id: userId,
        color: groupData.color || null,
        category: groupData.category || 'other',
        public: false,
      })
      .select('*')
      .single();

    if (groupError || !groupRecord) {
      console.error('Error creating group:', groupError);
      throw new Error('Failed to create group');
    }

    // Add all members (including owner)
    const allMembers = Array.from(new Set([userId, ...groupData.members]));
    const memberRecords = allMembers.map((memberId) => ({
      group_id: groupRecord.id,
      user_id: memberId,
      role: memberId === userId ? 'owner' : 'member',
    }));

    const { error: membersError } = await supabase
      .schema('amot')
      .from('group_members')
      .insert(memberRecords);

    if (membersError) {
      // Rollback: delete the group if members creation failed
      await supabase.schema('amot').from('groups').delete().eq('id', groupRecord.id);
      console.error('Error creating group members:', membersError);
      throw new Error('Failed to create group members');
    }

    // Return the created group with members
    return {
      id: groupRecord.id,
      name: groupRecord.name,
      description: groupRecord.description || undefined,
      members: allMembers,
      createdBy: userId,
      createdAt: new Date(groupRecord.created_at).getTime(),
      updatedAt: new Date(groupRecord.created_at).getTime(),
      color: groupRecord.color || undefined,
      category: groupRecord.category || 'other',
    };
  },

  /**
   * Get a specific group by ID
   */
  async getGroupById(groupId: string): Promise<Group | null> {
    const { data: groupRecord, error } = await supabase
      .schema('amot')
      .from('groups')
      .select(`
        id,
        name,
        description,
        owner_id,
        color,
        category,
        created_at,
        updated_at,
        group_members(user_id, role)
      `)
      .eq('id', groupId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error fetching group:', error);
      throw new Error('Failed to fetch group');
    }

    if (!groupRecord) {
      return null;
    }

    return {
      id: groupRecord.id,
      name: groupRecord.name,
      description: groupRecord.description || undefined,
      members: (groupRecord.group_members || []).map((m: any) => m.user_id),
      createdBy: groupRecord.owner_id,
      createdAt: new Date(groupRecord.created_at).getTime(),
      updatedAt: new Date(groupRecord.updated_at).getTime(),
      color: groupRecord.color || undefined,
      category: groupRecord.category || 'other',
    };
  },

  /**
   * Update a group's details
   */
  async updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.category !== undefined) updateData.category = updates.category;

    const { data: groupRecord, error } = await supabase
      .schema('amot')
      .from('groups')
      .update(updateData)
      .eq('id', groupId)
      .select(`
        id,
        name,
        description,
        owner_id,
        color,
        category,
        created_at,
        updated_at,
        group_members(user_id, role)
      `)
      .single();

    if (error || !groupRecord) {
      console.error('Error updating group:', error);
      throw new Error('Failed to update group');
    }

    return {
      id: groupRecord.id,
      name: groupRecord.name,
      description: groupRecord.description || undefined,
      members: (groupRecord.group_members || []).map((m: any) => m.user_id),
      createdBy: groupRecord.owner_id,
      createdAt: new Date(groupRecord.created_at).getTime(),
      updatedAt: new Date(groupRecord.updated_at).getTime(),
      color: groupRecord.color || undefined,
      category: groupRecord.category || 'other',
    };
  },

  /**
   * Delete a group
   */
  async deleteGroup(groupId: string): Promise<void> {
    // Members will cascade delete due to foreign key constraint
    const { error } = await supabase
      .schema('amot')
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Error deleting group:', error);
      throw new Error('Failed to delete group');
    }
  },

  /**
   * Add a member to a group
   */
  async addMember(groupId: string, userId: string, role?: string): Promise<Group> {
    // Check if already a member
    const { data: existing } = await supabase
      .schema('amot')
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      throw new Error('User already in group');
    }

    // Add member
    const { error } = await supabase
      .schema('amot')
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        role: role || 'member',
      });

    if (error) {
      console.error('Error adding member:', error);
      throw new Error('Failed to add member');
    }

    // Return updated group
    const updatedGroup = await this.getGroupById(groupId);
    if (!updatedGroup) {
      throw new Error('Group not found after adding member');
    }
    return updatedGroup;
  },

  /**
   * Remove a member from a group
   */
  async removeMember(groupId: string, userId: string): Promise<Group> {
    // Prevent removing the owner
    const { data: groupData } = await supabase
      .schema('amot')
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();

    if (groupData?.owner_id === userId) {
      throw new Error('Cannot remove group owner');
    }

    // Remove member
    const { error } = await supabase
      .schema('amot')
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
      throw new Error('Failed to remove member');
    }

    // Return updated group
    const updatedGroup = await this.getGroupById(groupId);
    if (!updatedGroup) {
      throw new Error('Group not found after removing member');
    }
    return updatedGroup;
  },
};
