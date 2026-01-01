import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  FlatList,
  Modal,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { TextInput, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { BillContext } from '../../context/BillContext';
import { GroupContext } from '../../context/GroupContext';
import { FriendsContext } from '../../context/FriendsContext';
import {
  generateEqualSplits,
  validateCustomSplit,
  calculatePercentageSplit,
  validatePercentageSplit,
} from '../../utils/calculations';
import { formatPeso } from '../../utils/formatting';
import { User, SplitMethod, Group } from '../../types';

type CreateBillScreenProps = {
  navigation: any;
  route?: any;
};

const CreateBillScreen: React.FC<CreateBillScreenProps> = ({ navigation, route }) => {
  const modal = useConfirmationModal();
  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);
  const groupContext = useContext(GroupContext);
  const friendsContext = useContext(FriendsContext);
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [description, setDescription] = useState('');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [participants, setParticipants] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAmounts, setCustomAmounts] = useState<{ [key: string]: string }>({});
  const [percentages, setPercentages] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);

  // Extract bill from route params for edit mode, and groupId if creating for a group
  const bill = route?.params?.bill;
  const groupId = route?.params?.groupId;
  const isEditMode = !!bill;

  if (!authContext || !billContext || !friendsContext) {
    return null;
  }

  const { user } = authContext;
  const { createBill, updateBill } = billContext;
  const { friends, loadFriends } = friendsContext;

  // Convert friends to User objects for participant selection
  // Deduplicate by friend ID to prevent duplicate participants
  const allUsers: User[] = useMemo(() => {
    const uniqueFriends = new Map<string, User>();
    friends.forEach(f => {
      if (!uniqueFriends.has(f.friendId)) {
        uniqueFriends.set(f.friendId, {
          id: f.friendId,
          email: f.friendEmail,
          name: f.friendName,
          createdAt: f.createdAt,
        });
      }
    });
    return Array.from(uniqueFriends.values());
  }, [friends]);

  // Load friends when component mounts
  useEffect(() => {
    loadFriends();
  }, []);

  // Load group details once when groupId is available
  useEffect(() => {
    let isMounted = true;

    const loadGroupDetails = async () => {
      if (!groupId || !groupContext) return;

      try {
        const groupData = await groupContext.getGroupById(groupId);
        if (isMounted) {
          setGroup(groupData);
        }
      } catch (err) {
        console.error('Error loading group:', err);
      }
    };

    loadGroupDetails();

    return () => {
      isMounted = false;
    };
  }, [groupId]); // Only depend on groupId, not groupContext

  // Pre-fill participants when both group and allUsers are ready
  useEffect(() => {
    if (group && allUsers.length > 0 && participants.length === 0) {
      const groupParticipants = allUsers.filter(
        u => group.members.includes(u.id) && u.id !== user?.id
      );
      setParticipants(groupParticipants);
    }
  }, [group, allUsers, user?.id]);

  // Pre-populate form fields when in edit mode
  useEffect(() => {
    if (isEditMode && bill) {
      setTitle(bill.title);
      setTotalAmount(bill.totalAmount.toString());
      setDescription(bill.description || '');
      setSplitMethod(bill.splitMethod);

      // Load participants (exclude the payer since they're shown separately)
      const participantIds = bill.participants.filter((id: string) => id !== user?.id);
      const participantUsers = allUsers.filter(u => participantIds.includes(u.id));
      setParticipants(participantUsers);

      // Pre-populate custom amounts if applicable
      if (bill.splitMethod === 'custom' || bill.splitMethod === 'percentage') {
        const amounts: { [key: string]: string } = {};
        const percentages: { [key: string]: string } = {};

        bill.splits.forEach((split: any) => {
          if (bill.splitMethod === 'custom') {
            amounts[split.userId] = split.amount.toString();
          } else if (bill.splitMethod === 'percentage') {
            percentages[split.userId] = (split.percentage || '0').toString();
          }
        });

        setCustomAmounts(amounts);
        setPercentages(percentages);
      }
    }
  }, [isEditMode, bill, allUsers, user?.id]);

  const toggleParticipant = (participant: User) => {
    const isAlreadySelected = participants.find(p => p.id === participant.id);

    if (isAlreadySelected) {
      // Remove participant
      setParticipants(participants.filter(p => p.id !== participant.id));
      const newCustomAmounts = { ...customAmounts };
      delete newCustomAmounts[participant.id];
      setCustomAmounts(newCustomAmounts);
      const newPercentages = { ...percentages };
      delete newPercentages[participant.id];
      setPercentages(newPercentages);
    } else {
      // Add participant
      setParticipants([...participants, participant]);
      setCustomAmounts({ ...customAmounts, [participant.id]: '' });
      setPercentages({ ...percentages, [participant.id]: '' });
    }
  };

  const closeParticipantModal = () => {
    setShowUserModal(false);
    setSearchQuery('');
  };

  const removeParticipant = (userId: string) => {
    const participantToRemove = participants.find(p => p.id === userId);

    // Show warning for custom/percentage splits
    if ((splitMethod === 'custom' || splitMethod === 'percentage') && participantToRemove) {
      modal.showModal({
        type: 'warning',
        title: 'Remove Participant',
        message: `Remove ${participantToRemove.name}? You'll need to adjust the ${splitMethod === 'custom' ? 'amounts' : 'percentages'} for the remaining participants.`,
        confirmText: 'Remove',
        cancelText: 'Cancel',
        showCancel: true,
        onConfirm: () => {
          setParticipants(participants.filter(p => p.id !== userId));
          const newCustomAmounts = { ...customAmounts };
          delete newCustomAmounts[userId];
          setCustomAmounts(newCustomAmounts);
          const newPercentages = { ...percentages };
          delete newPercentages[userId];
          setPercentages(newPercentages);
        },
      });
    } else {
      setParticipants(participants.filter(p => p.id !== userId));
      const newCustomAmounts = { ...customAmounts };
      delete newCustomAmounts[userId];
      setCustomAmounts(newCustomAmounts);
      const newPercentages = { ...percentages };
      delete newPercentages[userId];
      setPercentages(newPercentages);
    }
  };

  const searchUsers = () => {
    if (!searchQuery) return allUsers;
    return allUsers.filter(
      u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Calculate live split preview
  const splitPreview = useMemo(() => {
    const amount = parseFloat(totalAmount);
    if (!totalAmount || isNaN(amount) || amount <= 0 || participants.length === 0) {
      return null;
    }

    const allParticipantIds = [user!.id, ...participants.map(p => p.id)];
    const allParticipants = [user!, ...participants];

    if (splitMethod === 'equal') {
      const splits = generateEqualSplits(amount, allParticipantIds);
      return splits.map(split => {
        const participant = allParticipants.find(p => p.id === split.userId);
        return {
          name: participant?.id === user?.id ? `${participant.name} (You)` : participant?.name || 'Unknown',
          amount: split.amount,
        };
      });
    } else if (splitMethod === 'custom') {
      const splits = allParticipantIds.map(id => {
        const participant = allParticipants.find(p => p.id === id);
        return {
          name: participant?.id === user?.id ? `${participant.name} (You)` : participant?.name || 'Unknown',
          amount: parseFloat(customAmounts[id] || '0'),
        };
      });
      return splits;
    } else if (splitMethod === 'percentage') {
      const splits = allParticipantIds.map(id => {
        const participant = allParticipants.find(p => p.id === id);
        const percentage = parseFloat(percentages[id] || '0');
        return {
          name: participant?.id === user?.id ? `${participant.name} (You)` : participant?.name || 'Unknown',
          amount: parseFloat((amount * percentage / 100).toFixed(2)),
          percentage,
        };
      });
      return splits;
    }

    return null;
  }, [totalAmount, participants, splitMethod, customAmounts, percentages, user]);

  const handleCreateBill = async () => {
    // Validation
    if (!title.trim()) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please enter a bill title' });
      return;
    }

    const amount = parseFloat(totalAmount);
    if (!totalAmount || isNaN(amount) || amount <= 0) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please enter a valid amount' });
      return;
    }

    if (participants.length === 0) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please add at least one participant' });
      return;
    }

    let splits: any[] = [];

    // Calculate splits based on method
    if (splitMethod === 'equal') {
      splits = generateEqualSplits(amount, [user!.id, ...participants.map(p => p.id)]);
    } else if (splitMethod === 'custom') {
      const customSplits = [user!.id, ...participants.map(p => p.id)].map(id => ({
        userId: id,
        amount: parseFloat(customAmounts[id] || '0'),
      }));
      const validation = validateCustomSplit(customSplits, amount);
      if (!validation.isValid) {
        modal.showModal({ type: 'error', title: 'Error', message: validation.error || 'Invalid split amounts' });
        return;
      }
      splits = customSplits;
    } else if (splitMethod === 'percentage') {
      const percentageSplits = [user!.id, ...participants.map(p => p.id)].map(id => ({
        userId: id,
        percentage: parseFloat(percentages[id] || '0'),
      }));
      const validation = validatePercentageSplit(percentageSplits);
      if (!validation.isValid) {
        modal.showModal({ type: 'error', title: 'Error', message: validation.error || 'Percentages must total 100%' });
        return;
      }
      splits = calculatePercentageSplit(amount, percentageSplits);
    }

    try {
      setLoading(true);
      const billData: any = {
        title: title.trim(),
        totalAmount: amount,
        paidBy: user!.id,
        participants: [user!.id, ...participants.map(p => p.id)],
        splitMethod,
        splits,
        description: description.trim(),
      };

      // Include groupId if creating a bill for a group
      if (groupId) {
        billData.groupId = groupId;
      }

      if (isEditMode) {
        await updateBill(bill.id, billData);
        modal.showModal({ type: 'success', title: 'Success', message: 'Bill updated successfully' });
      } else {
        await createBill(billData);
        modal.showModal({ type: 'success', title: 'Success', message: 'Bill created successfully' });
      }

      navigation.goBack();
    } catch (error) {
      modal.showModal({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : isEditMode ? 'Failed to update bill' : 'Failed to create bill' });
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = participants.some(p => p.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.userListItem, isSelected && styles.userListItemSelected]}
        onPress={() => toggleParticipant(item)}
      >
        <View>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        {isSelected && (
          <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {group && (
          <View style={styles.groupBadgeContainer}>
            <MaterialCommunityIcons name="folder-account" size={16} color={COLORS.white} />
            <Text style={styles.groupBadgeText}>{group.name}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          <TextInput
            label="Bill Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Dinner at restaurant"
            mode="outlined"
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            textColor={COLORS.black}
          />

          <TextInput
            label="Total Amount"
            value={totalAmount}
            onChangeText={setTotalAmount}
            placeholder="e.g., 120.50"
            mode="outlined"
            keyboardType="decimal-pad"
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            textColor={COLORS.black}
            left={<TextInput.Affix text="₱" />}
          />

          <TextInput
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Add a note..."
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            textColor={COLORS.black}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <TouchableOpacity
            style={styles.addParticipantButton}
            onPress={() => setShowUserModal(true)}
          >
            <MaterialCommunityIcons name="plus" size={20} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Add Participant</Text>
          </TouchableOpacity>

          <View style={styles.participantsContainer}>
            <Chip
              style={styles.participantChip}
              onClose={() => {}}
              disabled
              icon={() => (
                <MaterialCommunityIcons
                  name="wallet"
                  size={16}
                  color={COLORS.primary}
                />
              )}
            >
              <Text style={styles.chipText}>{user?.name} (You - Payer)</Text>
            </Chip>

            {participants.map(participant => (
              <Chip
                key={participant.id}
                style={styles.participantChip}
                onClose={() => removeParticipant(participant.id)}
                icon={() => (
                  <MaterialCommunityIcons
                    name="account"
                    size={16}
                    color={COLORS.white}
                  />
                )}
              >
                <Text style={styles.chipText}>{participant.name}</Text>
              </Chip>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Split Method</Text>
          <View style={styles.splitMethodContainer}>
            {(['equal', 'custom', 'percentage'] as SplitMethod[]).map(method => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.splitMethodOption,
                  splitMethod === method && styles.splitMethodActive,
                ]}
                onPress={() => setSplitMethod(method)}
              >
                <MaterialCommunityIcons
                  name={
                    method === 'equal'
                      ? 'equal'
                      : method === 'custom'
                        ? 'pencil'
                        : 'percent'
                  }
                  size={20}
                  color={splitMethod === method ? COLORS.white : COLORS.gray600}
                />
                <Text
                  style={[
                    styles.splitMethodText,
                    splitMethod === method && styles.splitMethodTextActive,
                  ]}
                >
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {splitMethod === 'custom' && participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Amounts</Text>
            <View style={styles.customAmountsContainer}>
              {[user!.id, ...participants.map(p => p.id)].map(id => {
                const participant = [user!].concat(participants).find(p => p.id === id);
                return (
                  <View key={id} style={styles.customAmountRow}>
                    <Text style={styles.customAmountLabel}>{participant?.name}</Text>
                    <TextInput
                      value={customAmounts[id]}
                      onChangeText={value => setCustomAmounts({ ...customAmounts, [id]: value })}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      mode="outlined"
                      style={styles.customAmountInput}
                      outlineColor={COLORS.gray300}
                      activeOutlineColor={COLORS.primary}
                      textColor={COLORS.black}
                      left={<TextInput.Affix text="₱" />}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {splitMethod === 'percentage' && participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Percentages</Text>
            <View style={styles.customAmountsContainer}>
              {[user!.id, ...participants.map(p => p.id)].map(id => {
                const participant = [user!].concat(participants).find(p => p.id === id);
                return (
                  <View key={id} style={styles.customAmountRow}>
                    <Text style={styles.customAmountLabel}>{participant?.name}</Text>
                    <TextInput
                      value={percentages[id]}
                      onChangeText={value => setPercentages({ ...percentages, [id]: value })}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      mode="outlined"
                      style={styles.customAmountInput}
                      outlineColor={COLORS.gray300}
                      activeOutlineColor={COLORS.primary}
                      textColor={COLORS.black}
                      right={<TextInput.Affix text="%" />}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {splitPreview && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Split Preview</Text>
            <View style={styles.previewContainer}>
              {splitPreview.map((item, index) => (
                <View key={index} style={styles.previewRow}>
                  <Text style={styles.previewName}>{item.name}</Text>
                  <Text style={styles.previewAmount}>
                    {formatPeso(item.amount)}
                    {splitMethod === 'percentage' && item.percentage !== undefined && (
                      <Text style={styles.previewPercentage}> ({item.percentage}%)</Text>
                    )}
                  </Text>
                </View>
              ))}
              <View style={styles.previewDivider} />
              <View style={styles.previewRow}>
                <Text style={styles.previewTotalLabel}>Total</Text>
                <Text style={styles.previewTotalAmount}>
                  {formatPeso(splitPreview.reduce((sum, item) => sum + item.amount, 0))}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateBill}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.createButtonText}>
                {isEditMode ? 'Update Bill' : 'Create Bill'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showUserModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeParticipantModal}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Participants</Text>
            <TouchableOpacity onPress={closeParticipantModal}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {allUsers.length === 0 ? (
            <View style={styles.emptyModalContainer}>
              <MaterialCommunityIcons
                name="account-multiple-plus"
                size={64}
                color={COLORS.gray400}
              />
              <Text style={styles.emptyModalTitle}>No friends yet</Text>
              <Text style={styles.emptyModalMessage}>
                You need to add friends before creating a bill
              </Text>
              <TouchableOpacity
                style={styles.addFriendButton}
                onPress={() => {
                  setShowUserModal(false);
                  navigation.navigate('AddFriend');
                }}
              >
                <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
                <Text style={styles.addFriendButtonText}>Add Friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                label="Search users"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Name or email"
                mode="outlined"
                style={styles.searchInput}
                outlineColor={COLORS.gray300}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.black}
                left={<TextInput.Icon icon="magnify" />}
              />

              <FlatList
                data={searchUsers()}
                renderItem={renderUserItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.userListContainer}
              />
            </>
          )}
        </SafeAreaView>
      </Modal>

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
    backgroundColor: COLORS.gray50,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  groupBadgeContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  groupBadgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  input: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  addParticipantButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addButtonText: {
    marginLeft: SPACING.md,
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  participantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  participantChip: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.white,
  },
  splitMethodContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  splitMethodOption: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gray200,
  },
  splitMethodActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  splitMethodText: {
    marginTop: SPACING.sm,
    color: COLORS.gray600,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  splitMethodTextActive: {
    color: COLORS.white,
  },
  customAmountsContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  customAmountRow: {
    marginBottom: SPACING.md,
  },
  customAmountLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  customAmountInput: {
    backgroundColor: COLORS.gray50,
  },
  previewContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  previewName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray700,
    flex: 1,
  },
  previewAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  previewPercentage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    fontWeight: 'normal',
  },
  previewDivider: {
    height: 1,
    backgroundColor: COLORS.gray300,
    marginVertical: SPACING.sm,
  },
  previewTotalLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  previewTotalAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  buttonContainer: {
    paddingVertical: SPACING.xl,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  doneButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchInput: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.gray50,
  },
  userListContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  userListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.sm,
  },
  userListItemSelected: {
    backgroundColor: COLORS.gray100,
  },
  userName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  emptyModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyModalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyModalMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  addFriendButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default CreateBillScreen;
