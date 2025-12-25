import { supabase } from './supabase';
import { User, Friend } from '../types';

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
      createdAt: new Date(profile.users?.created_at).getTime(),
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
          user_profiles(display_name, avatar_url, phone)
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
};
