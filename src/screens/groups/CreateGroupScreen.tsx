import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../../context/AuthContext';
import { GroupContext } from '../../context/GroupContext';
import { FriendsContext } from '../../context/FriendsContext';
import { CreateGroupData, Group, FriendWithBalance } from '../../types';
import { COLORS } from '../../constants/theme';
import { getGroupCategoryIcon } from '../../utils/icons';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { supabaseApi } from '../../services/supabaseApi';

const CreateGroupScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const authContext = useContext(AuthContext);
  const groupContext = useContext(GroupContext);
  const friendsContext = useContext(FriendsContext);
  const modal = useConfirmationModal();

  const user = authContext?.user;
  const editingGroup = route.params?.group;

  const [groupName, setGroupName] = useState(editingGroup?.name || '');
  const [description, setDescription] = useState(editingGroup?.description || '');
  const [category, setCategory] = useState<'trip' | 'roommates' | 'event' | 'other'>(
    editingGroup?.category || 'other'
  );
  const [members, setMembers] = useState<string[]>(editingGroup?.members || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const friends = friendsContext?.friendsWithBalances || [];
  const friendsLoading = friendsContext?.isLoading || false;

  const categories: Array<'trip' | 'roommates' | 'event' | 'other'> = [
    'trip',
    'roommates',
    'event',
    'other',
  ];

  useEffect(() => {
    if (user && friendsContext) {
      friendsContext.loadFriends();
    }
  }, [user]);

  const handleCreateOrUpdate = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    if (members.length === 0) {
      setError('Add at least one member');
      return;
    }

    if (!user) {
      setError('User not found');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Include current user in members if not already present
      const groupMembers = members.includes(user.id) ? members : [user.id, ...members];

      if (editingGroup) {
        // Update group details (name, description, color, category)
        await groupContext?.updateGroup(editingGroup.id, {
          name: groupName.trim(),
          description: description.trim() || undefined,
          category,
        }, user.id);

        // Handle member updates
        const oldMembers = editingGroup.members || [];
        const newMembers = groupMembers;

        // Find members to add (in new but not in old)
        const membersToAdd = newMembers.filter(m => !oldMembers.includes(m));

        // Find members to remove (in old but not in new, excluding owner)
        const membersToRemove = oldMembers.filter(
          m => !newMembers.includes(m) && m !== editingGroup.createdBy
        );

        // Add new members
        for (const memberId of membersToAdd) {
          try {
            await groupContext?.addMember(editingGroup.id, memberId);
          } catch (err) {
            console.error(`Error adding member ${memberId}:`, err);
          }
        }

        // Remove old members
        for (const memberId of membersToRemove) {
          try {
            await groupContext?.removeMember(editingGroup.id, memberId);
          } catch (err) {
            console.error(`Error removing member ${memberId}:`, err);
          }
        }

        modal.showModal({
          type: 'success',
          title: 'Success',
          message: 'Group updated successfully',
          onConfirm: () => navigation.goBack(),
        });
      } else {
        const groupData: CreateGroupData = {
          name: groupName.trim(),
          description: description.trim() || undefined,
          members: groupMembers,
          category,
        };

        await groupContext?.createGroup(groupData, user.id);
        modal.showModal({
          type: 'success',
          title: 'Success',
          message: 'Group created successfully',
          onConfirm: () => navigation.goBack(),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save group';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = async (memberId: string) => {
    if (members.includes(memberId)) {
      // If editing a group, check for unsettled bills before removing
      if (editingGroup) {
        try {
          const unsettledBills = await supabaseApi.getUnsettledBillsForMemberInGroup(
            editingGroup.id,
            memberId
          );

          if (unsettledBills.length > 0) {
            // Show error modal with list of unsettled bills
            const friend = friends.find(f => f.friendId === memberId);
            const memberName = friend?.friendName || memberId.substring(0, 8);

            const billsList = unsettledBills
              .slice(0, 3)
              .map(bill => {
                const userSplit = bill.splits.find(s => s.userId === memberId);
                const amount = userSplit?.amount || 0;
                return `• ${bill.title} (owes ₱${amount.toFixed(2)})`;
              })
              .join('\n');

            const moreText = unsettledBills.length > 3
              ? `\n...and ${unsettledBills.length - 3} more bill(s)`
              : '';

            modal.showModal({
              type: 'error',
              title: 'Cannot Remove Member',
              message: `${memberName} has ${unsettledBills.length} unsettled bill(s) in this group:\n\n${billsList}${moreText}\n\nSettle these bills first, or remove them from each bill individually.`,
            });
            return;
          }
        } catch (err) {
          console.error('Error checking unsettled bills:', err);
          modal.showModal({
            type: 'error',
            title: 'Error',
            message: 'Failed to check for unsettled bills. Please try again.',
          });
          return;
        }
      }

      // Remove member if no unsettled bills or not editing
      setMembers(members.filter(m => m !== memberId));
    } else {
      setMembers([...members, memberId]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editingGroup ? 'Edit Group' : 'Create Group'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Group Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter group name"
              value={groupName}
              onChangeText={setGroupName}
              editable={!isLoading}
              placeholderTextColor={COLORS.gray400}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              editable={!isLoading}
              placeholderTextColor={COLORS.gray400}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}
                  disabled={isLoading}
                >
                  <MaterialCommunityIcons
                    name={getGroupCategoryIcon(cat)}
                    size={24}
                    color={category === cat ? COLORS.white : COLORS.gray600}
                  />
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Members */}
          <View style={styles.section}>
            <Text style={styles.label}>Members *</Text>
            <Text style={styles.hint}>
              Select members from your friends list
            </Text>

            {friendsLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : friends.length === 0 ? (
              <Text style={styles.noFriendsText}>Create a bill first to see your friends here</Text>
            ) : (
              <View>
                {/* Dropdown Button */}
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isLoading}
                >
                  <View style={styles.dropdownButtonContent}>
                    <MaterialCommunityIcons
                      name="account-multiple"
                      size={20}
                      color={COLORS.gray600}
                    />
                    <Text style={styles.dropdownButtonText}>
                      {members.length === 0
                        ? 'Select members'
                        : `${members.length} member${members.length !== 1 ? 's' : ''} selected`}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={COLORS.gray600}
                  />
                </TouchableOpacity>

                {/* Dropdown List */}
                {isDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {friends.map(friend => (
                      <TouchableOpacity
                        key={friend.friendId}
                        style={[
                          styles.dropdownItem,
                          members.includes(friend.friendId) && styles.dropdownItemSelected,
                        ]}
                        onPress={() => toggleMember(friend.friendId)}
                        disabled={isLoading}
                      >
                        <View style={styles.dropdownItemContent}>
                          <Text style={styles.friendName}>{friend.friendName}</Text>
                          <Text style={styles.friendEmail}>{friend.friendEmail}</Text>
                        </View>
                        <MaterialCommunityIcons
                          name={members.includes(friend.friendId) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          size={20}
                          color={members.includes(friend.friendId) ? COLORS.primary : COLORS.gray400}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.membersList}>
              {members.map(memberId => {
                const friend = friends.find(f => f.friendId === memberId);
                const isCurrentUser = memberId === user?.id;
                const isOwner = editingGroup ? memberId === editingGroup.createdBy : isCurrentUser;

                // Display name priority: friend name > "You" for current user > user name > user ID
                let displayName = friend?.friendName;
                if (!displayName) {
                  if (isCurrentUser) {
                    displayName = user?.name ? `${user.name} (You)` : 'You';
                  } else {
                    displayName = memberId.substring(0, 8);
                  }
                }

                return (
                  <View key={memberId} style={styles.memberChip}>
                    <Text style={styles.memberChipText}>{displayName}</Text>
                    {!isOwner && (
                      <TouchableOpacity
                        onPress={() => toggleMember(memberId)}
                        disabled={isLoading}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={COLORS.white}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={20}
                color={COLORS.white}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.spacer} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleCreateOrUpdate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                {editingGroup ? 'Update Group' : 'Create Group'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ConfirmationModal
        visible={modal.isVisible}
        type={modal.config.type}
        icon={modal.config.icon}
        iconColor={modal.config.iconColor}
        title={modal.config.title}
        message={modal.config.message}
        confirmText={modal.config.confirmText}
        cancelText={modal.config.cancelText}
        onConfirm={modal.handleConfirm}
        onCancel={modal.handleCancel}
        showCancel={modal.config.showCancel}
        isLoading={modal.isLoading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: COLORS.gray600,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: COLORS.gray50,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  categoryButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryButtonText: {
    fontSize: 12,
    color: COLORS.gray700,
    marginTop: 4,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: COLORS.white,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.gray50,
    marginBottom: 8,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: COLORS.gray700,
  },
  dropdownList: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 16,
    maxHeight: 300,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  dropdownItemSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  dropdownItemContent: {
    flex: 1,
    marginRight: 12,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 12,
    color: COLORS.gray600,
  },
  noFriendsText: {
    fontSize: 13,
    color: COLORS.gray600,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  memberChip: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberChipText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
    flex: 1,
  },
  spacer: {
    height: 20,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.gray700,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CreateGroupScreen;
