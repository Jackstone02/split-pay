import React, { useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { FriendsContext } from '../../context/FriendsContext';
import { AuthContext } from '../../context/AuthContext';
import { FriendWithBalance } from '../../types';
import { COLORS, SPACING } from '../../constants/theme';
import ConfirmationModal from '../../components/ConfirmationModal';
import PokeButton from '../../components/PokeButton';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { formatAmount, formatCurrency } from '../../utils/formatting';
import { getFriendSettlementState } from '../../utils/settlements';

type FriendsScreenProps = {
  navigation: any;
};

const FriendsScreen: React.FC<FriendsScreenProps> = ({ navigation }) => {
  const friendsContext = useContext(FriendsContext);
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendWithBalance | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const modal = useConfirmationModal();

  if (!friendsContext) {
    return null;
  }

  const { friendsWithBalances, isLoading, error, loadFriends, removeFriend } = friendsContext;

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFriends();
    setIsRefreshing(false);
  }, [loadFriends]);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [loadFriends])
  );

  const handleRemoveFriend = (friend: FriendWithBalance) => {
    setFriendToRemove(friend);
    setShowRemoveModal(true);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;

    try {
      setIsRemoving(true);
      await removeFriend(friendToRemove.id);
      setShowRemoveModal(false);
      setFriendToRemove(null);
    } catch (err) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to remove friend',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const getBalanceColor = (balance: number): string => {
    if (balance > 0) return COLORS.success; // They owe you
    if (balance < 0) return COLORS.danger; // You owe them
    return COLORS.gray600; // No balance
  };

  const getBalanceLabel = (balance: number): string => {
    if (balance > 0) return `owes you ${formatAmount(Math.abs(balance), user?.preferredCurrency)}`;
    if (balance < 0) return `you owe ${formatAmount(Math.abs(balance), user?.preferredCurrency)}`;
    return 'settled';
  };

  const handleFriendPress = (item: FriendWithBalance) => {
    if (item.billBreakdown.length === 0) return;
    navigation.navigate('FriendBalanceDetail', {
      friendId: item.friendId,
      friendName: item.friendName,
      friendEmail: item.friendEmail,
      friendAvatarUrl: item.friendAvatarUrl,
      balance: item.balance,
      billBreakdown: item.billBreakdown,
    });
  };

  const renderFriendItem = ({ item }: { item: FriendWithBalance }) => {
    const settlement = getFriendSettlementState(item.billBreakdown);
    const canPay = item.balance < 0 && settlement.payAmount > 0.005;
    const hasOutgoingPending = settlement.outgoingPending.length > 0;
    const hasIncomingPending = settlement.incomingPending.length > 0;
    const hasBreakdown = item.billBreakdown.length > 0;

    return (
    <View style={styles.friendCard}>
      <TouchableOpacity
        style={styles.friendPressable}
        onPress={() => handleFriendPress(item)}
        activeOpacity={hasBreakdown ? 0.7 : 1}
      >
        <View style={styles.avatarContainer}>
          {item.friendAvatarUrl ? (
            <Image source={{ uri: item.friendAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {item.friendName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.friendName}</Text>
          <Text style={styles.friendEmail}>{item.friendEmail}</Text>
          <View style={styles.billCountRow}>
            {item.openBillCount > 0 && (
              <View style={styles.billBadgeOpen}>
                <Text style={styles.billBadgeOpenText}>{item.openBillCount} open</Text>
              </View>
            )}
            {item.settledBillCount > 0 && (
              <View style={styles.billBadgeSettled}>
                <Text style={styles.billBadgeSettledText}>{item.settledBillCount} settled</Text>
              </View>
            )}
            {item.billCount === 0 && (
              <Text style={styles.billCount}>No bills</Text>
            )}
          </View>
          {hasIncomingPending && (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="clock-alert-outline" size={12} color={COLORS.warning} />
              <Text style={[styles.statusText, { color: COLORS.warning }]}>Awaiting your confirmation</Text>
            </View>
          )}
          {hasOutgoingPending && (
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="clock-check-outline" size={12} color={COLORS.primary} />
              <Text style={styles.statusText}>Payment pending confirmation</Text>
            </View>
          )}
          {hasBreakdown && (
            <Text style={styles.tapHint}>Tap to see breakdown</Text>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.rightContainer}>
        <View style={styles.balanceContainer}>
          <Text style={[styles.balanceAmount, { color: getBalanceColor(item.balance) }]}>
            {formatAmount(Math.abs(item.balance), user?.preferredCurrency)}
          </Text>
          <Text style={[styles.balanceLabel, { color: getBalanceColor(item.balance) }]}>
            {getBalanceLabel(item.balance)}
          </Text>
          {canPay ? (
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => navigation.navigate('Payment', {
                friendId: item.friendId,
                friendName: item.friendName,
                // Net of every open bill between you: your debts are marked as paid,
                // and their debts to you are cancelled out once they confirm.
                amount: settlement.payAmount,
                billIds: settlement.payBillIds,
                offsetBillIds: settlement.payOffsetBillIds,
              })}
            >
              <MaterialCommunityIcons name="cash" size={14} color={COLORS.white} />
              <Text style={styles.payButtonText}>Pay</Text>
            </TouchableOpacity>
          ) : item.balance < 0 && hasOutgoingPending ? (
            <TouchableOpacity
              style={[styles.payButton, styles.pendingButton]}
              onPress={() => handleFriendPress(item)}
            >
              <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.white} />
              <Text style={styles.payButtonText}>Pending</Text>
            </TouchableOpacity>
          ) : null}
          {hasIncomingPending && (
            <TouchableOpacity
              style={[styles.payButton, styles.confirmPaymentButton]}
              onPress={() => handleFriendPress(item)}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={14} color={COLORS.white} />
              <Text style={styles.payButtonText}>Confirm</Text>
            </TouchableOpacity>
          )}
        </View>
        {item.balance > 0 && !hasIncomingPending && (
          <PokeButton
            friendId={item.friendId}
            friendName={item.friendName}
            amount={item.balance}
            size="small"
            variant="icon"
            onPokeSuccess={() => {
              modal.showModal({
                type: 'success',
                title: 'Poke Sent!',
                message: `${item.friendName} has been notified about the payment.`,
                icon: 'gesture-tap',
              });
            }}
          />
        )}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFriend(item)}
        >
          <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-multiple-outline" size={64} color={COLORS.gray400} />
      <Text style={styles.emptyTitle}>No friends yet!</Text>
      <Text style={styles.emptyMessage}>Tap the + button below to add friends</Text>
    </View>
  );

  if (isLoading && friendsWithBalances.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Sort friends by name ascending (A-Z)
  const sortedFriends = [...friendsWithBalances].sort((a, b) => {
    return a.friendName.localeCompare(b.friendName);
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>
      <FlatList
        data={sortedFriends}
        renderItem={renderFriendItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddFriend')}
        label="Add Friend"
        color={COLORS.white}
      />

      {/* Remove Friend Confirmation Modal */}
      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isRemoving && setShowRemoveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="account-remove" size={48} color={COLORS.danger} />
            <Text style={styles.modalTitle}>Remove Friend</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to remove {friendToRemove?.friendName} from your friends?
            </Text>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRemoveModal(false)}
                disabled={isRemoving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, isRemoving && styles.confirmButtonDisabled]}
                onPress={confirmRemoveFriend}
                disabled={isRemoving}
              >
                <Text style={styles.confirmButtonText}>
                  {isRemoving ? 'Removing...' : 'Remove'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.gray200,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  listContent: {
    padding: 12,
    flexGrow: 1,
  },
  friendCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 12,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  friendPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 12,
    color: COLORS.gray600,
    marginBottom: 4,
  },
  billCount: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  billCountRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  billBadgeOpen: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  billBadgeOpenText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  billBadgeSettled: {
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  billBadgeSettledText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  tapHint: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    marginTop: 8,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  pendingButton: {
    backgroundColor: COLORS.gray400,
  },
  confirmPaymentButton: {
    backgroundColor: COLORS.success,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  removeButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    padding: 12,
    margin: 12,
    borderRadius: 6,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray200,
  },
  cancelButtonText: {
    color: COLORS.black,
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: COLORS.danger,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default FriendsScreen;
