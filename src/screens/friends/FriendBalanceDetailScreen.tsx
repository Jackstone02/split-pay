import React, { useCallback, useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../../context/AuthContext';
import { FriendsContext } from '../../context/FriendsContext';
import { BillContext } from '../../context/BillContext';
import { BillBreakdownItem, BillCategory } from '../../types';
import { COLORS, SPACING } from '../../constants/theme';
import { formatAmount } from '../../utils/formatting';
import { getBillCategoryIcon } from '../../utils/icons';
import { getFriendSettlementState, PendingPaymentGroup } from '../../utils/settlements';
import { supabaseApi } from '../../services/supabaseApi';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';

type RouteParams = {
  friendId: string;
  friendName: string;
  friendEmail: string;
  friendAvatarUrl?: string;
  balance: number;
  billBreakdown: BillBreakdownItem[];
};

const FriendBalanceDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as RouteParams;
  const { friendId, friendName, friendEmail, friendAvatarUrl } = params;

  const authContext = useContext(AuthContext);
  const friendsContext = useContext(FriendsContext);
  const billContext = useContext(BillContext);
  const user = authContext?.user;
  const modal = useConfirmationModal();
  const [isWorking, setIsWorking] = useState(false);
  const [proofToView, setProofToView] = useState<string | null>(null);

  // Prefer live data so the screen updates after a payment is confirmed or cancelled
  const liveFriend = friendsContext?.friendsWithBalances.find(f => f.friendId === friendId);
  const balance = liveFriend ? liveFriend.balance : params.balance;
  const billBreakdown = liveFriend ? liveFriend.billBreakdown : params.billBreakdown;

  const settlement = useMemo(() => getFriendSettlementState(billBreakdown), [billBreakdown]);
  const canPay = balance < 0 && settlement.payAmount > 0.005;

  // Bills included in a pending payment (either direction), for the per-bill tag
  const pendingBillIds = useMemo(() => {
    const ids = new Set<string>();
    [...settlement.incomingPending, ...settlement.outgoingPending].forEach(g => {
      g.billIds.forEach(id => ids.add(id));
      g.offsetBillIds.forEach(id => ids.add(id));
    });
    return ids;
  }, [settlement]);

  const refresh = useCallback(async () => {
    await Promise.all([friendsContext?.loadFriends(), billContext?.loadBills()]);
  }, [friendsContext, billContext]);

  useFocusEffect(
    useCallback(() => {
      friendsContext?.loadFriends();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const showErrorAfterModal = (message: string) => {
    // Let the confirm modal close first
    setTimeout(() => modal.showModal({ type: 'error', title: 'Error', message }), 300);
  };

  const billCountText = (group: PendingPaymentGroup) => {
    const count = group.billIds.length + group.offsetBillIds.length;
    return `${count} ${count === 1 ? 'bill' : 'bills'}`;
  };

  const handleConfirmIncoming = (group: PendingPaymentGroup) => {
    if (!user) return;
    modal.showModal({
      type: 'confirm',
      title: 'Confirm Payment Received',
      message: `Confirm that you received ${formatAmount(group.amount, user.preferredCurrency)} from ${friendName}? This will settle ${billCountText(group)}.`,
      confirmText: 'Confirm',
      showCancel: true,
      onConfirm: async () => {
        try {
          setIsWorking(true);
          if (group.settlementId) {
            const result = await supabaseApi.confirmSettlement(group.settlementId, friendId, user.id);
            const userProfile = await supabaseApi.getUserProfile(user.id);
            const firstBillId = result.confirmedBillIds[0];
            const payload = {
              payerName: friendName,
              amount: result.amount,
              billCount: result.confirmedBillIds.length + result.offsetBillIds.length,
              userName: userProfile?.name || 'Someone',
              // Used by the activity text when only one bill was left in the payment
              billId: firstBillId,
              billTitle: billBreakdown.find(b => b.billId === firstBillId)?.billTitle,
            };
            await supabaseApi.createActivity({
              actorId: user.id, action: 'payment_confirmed',
              targetType: 'user', targetId: friendId, payload,
            });
            await supabaseApi.createActivity({
              actorId: user.id, action: 'payment_confirmed',
              targetType: 'user', targetId: user.id, payload,
            });
          } else {
            // Single-bill payment: same as confirming on the bill itself
            await supabaseApi.confirmPayment(group.billIds[0], friendId, user.id);
          }
          await refresh();
        } catch (err) {
          console.error('Error confirming payment:', err);
          showErrorAfterModal('Failed to confirm payment. Please try again.');
        } finally {
          setIsWorking(false);
        }
      },
    });
  };

  const handleCancelOutgoing = (group: PendingPaymentGroup) => {
    if (!user) return;
    modal.showModal({
      type: 'confirm',
      title: 'Cancel Payment',
      message: `Cancel your pending payment of ${formatAmount(group.amount, user.preferredCurrency)} to ${friendName}? ${billCountText(group)} will go back to unpaid.`,
      confirmText: 'Cancel Payment',
      cancelText: 'Keep',
      showCancel: true,
      onConfirm: async () => {
        try {
          setIsWorking(true);
          if (group.settlementId) {
            await supabaseApi.cancelSettlement(group.settlementId, user.id);
          } else {
            await supabaseApi.unmarkBillSplit(group.billIds[0], user.id);
          }
          await refresh();
        } catch (err) {
          console.error('Error cancelling payment:', err);
          showErrorAfterModal('Failed to cancel payment. Please try again.');
        } finally {
          setIsWorking(false);
        }
      },
    });
  };

  const handlePay = () => {
    navigation.navigate('Payment', {
      friendId,
      friendName,
      amount: settlement.payAmount,
      billIds: settlement.payBillIds,
      offsetBillIds: settlement.payOffsetBillIds,
    });
  };

  const balanceColor = balance > 0 ? COLORS.success : balance < 0 ? COLORS.danger : COLORS.gray600;
  const balanceSummary =
    balance > 0
      ? `${friendName} owes you`
      : balance < 0
      ? `You owe ${friendName}`
      : 'All settled';

  const formatDate = (epoch?: number): string => {
    if (!epoch) return '';
    return new Date(epoch).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderPendingCard = (group: PendingPaymentGroup, incoming: boolean) => (
    <View key={group.key} style={[styles.actionCard, incoming ? styles.actionCardIncoming : styles.actionCardOutgoing]}>
      <View style={styles.actionCardRow}>
        <MaterialCommunityIcons
          name={incoming ? 'clock-alert-outline' : 'clock-check-outline'}
          size={20}
          color={incoming ? COLORS.warning : COLORS.primary}
        />
        <View style={styles.actionCardInfo}>
          <Text style={styles.actionCardTitle}>
            {incoming ? `${friendName} marked a payment as paid` : 'Waiting for confirmation'}
          </Text>
          <Text style={styles.actionCardSub}>
            {formatAmount(group.amount, user?.preferredCurrency)} · {billCountText(group)}
          </Text>
        </View>
      </View>
      <View style={styles.actionCardButtons}>
        {group.proofUrl ? (
          <TouchableOpacity
            style={styles.proofButton}
            onPress={async () => setProofToView(await supabaseApi.getViewableProofUrl(group.proofUrl!))}
          >
            <MaterialCommunityIcons name="image-outline" size={16} color={COLORS.primary} />
            <Text style={styles.proofButtonText}>View Proof</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.noProofText}>No proof attached</Text>
        )}
        {incoming ? (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.success }]}
            onPress={() => handleConfirmIncoming(group)}
            disabled={isWorking}
          >
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Confirm</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelOutgoing(group)}
            disabled={isWorking}
          >
            <MaterialCommunityIcons name="undo" size={14} color={COLORS.gray600} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderBillItem = ({ item }: { item: BillBreakdownItem }) => {
    const itemColor = item.youPaid ? COLORS.success : COLORS.danger;
    const itemLabel = item.youPaid
      ? `${friendName} owes you`
      : `You owe ${friendName}`;
    const icon = getBillCategoryIcon(item.category as BillCategory);

    return (
      <TouchableOpacity
        style={styles.billCard}
        onPress={() => navigation.navigate('BillDetail', { billId: item.billId })}
        activeOpacity={0.7}
      >
        <View style={styles.billIconContainer}>
          <MaterialCommunityIcons name={icon as any} size={22} color={COLORS.primary} />
        </View>
        <View style={styles.billInfo}>
          <Text style={styles.billTitle} numberOfLines={1}>{item.billTitle}</Text>
          {item.billDate ? (
            <Text style={styles.billDate}>{formatDate(item.billDate)}</Text>
          ) : null}
          <Text style={[styles.billDirection, { color: itemColor }]}>{itemLabel}</Text>
          {pendingBillIds.has(item.billId) && (
            <View style={styles.pendingTag}>
              <Text style={styles.pendingTagText}>In pending payment</Text>
            </View>
          )}
        </View>
        <View style={styles.billRight}>
          <Text style={[styles.billAmount, { color: itemColor }]}>
            {formatAmount(item.amount, user?.preferredCurrency)}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.gray400} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="receipt" size={48} color={COLORS.gray400} />
      <Text style={styles.emptyText}>No outstanding bills</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Friend Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.avatarContainer}>
          {friendAvatarUrl ? (
            <Image source={{ uri: friendAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {friendName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.friendName}>{friendName}</Text>
        <Text style={styles.friendEmail}>{friendEmail}</Text>
        <View style={styles.balancePill}>
          <Text style={[styles.balanceAmount, { color: balanceColor }]}>
            {formatAmount(Math.abs(balance), user?.preferredCurrency)}
          </Text>
          <Text style={[styles.balanceSummary, { color: balanceColor }]}>
            {balanceSummary}
          </Text>
        </View>
        {canPay && (
          <TouchableOpacity style={styles.payButton} onPress={handlePay} disabled={isWorking}>
            <MaterialCommunityIcons name="cash" size={18} color={COLORS.white} />
            <Text style={styles.payButtonText}>
              Pay {formatAmount(settlement.payAmount, user?.preferredCurrency)}
            </Text>
          </TouchableOpacity>
        )}
        {canPay && settlement.payOffsetBillIds.length > 0 && (
          <Text style={styles.payHint}>
            Net of what {friendName.split(' ')[0]} owes you. Settles all open bills between you once confirmed.
          </Text>
        )}
      </View>

      {isWorking && (
        <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 12 }} />
      )}

      {settlement.incomingPending.map(g => renderPendingCard(g, true))}
      {settlement.outgoingPending.map(g => renderPendingCard(g, false))}

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Contributing Bills</Text>
        <Text style={styles.sectionCount}>{billBreakdown.length} bill(s)</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Balance Breakdown</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={billBreakdown}
        renderItem={renderBillItem}
        keyExtractor={item => item.billId}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
      />

      {/* Full-screen proof viewer */}
      <Modal visible={!!proofToView} transparent animationType="fade" onRequestClose={() => setProofToView(null)}>
        <View style={styles.proofModalOverlay}>
          <TouchableOpacity style={styles.proofModalClose} onPress={() => setProofToView(null)}>
            <MaterialCommunityIcons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          {proofToView && (
            <Image source={{ uri: proofToView }} style={styles.proofModalImage} resizeMode="contain" />
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.gray200,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    marginVertical: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 16,
  },
  balancePill: {
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '800',
  },
  balanceSummary: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: SPACING.lg,
    flexGrow: 1,
  },
  billCard: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  billIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  billDate: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 2,
  },
  billDirection: {
    fontSize: 12,
    fontWeight: '500',
  },
  billRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.gray500,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  payHint: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
  },
  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionCardIncoming: {
    borderColor: COLORS.warning,
  },
  actionCardOutgoing: {
    borderColor: COLORS.primary,
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCardInfo: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  actionCardSub: {
    fontSize: 13,
    color: COLORS.gray600,
    marginTop: 2,
  },
  actionCardButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: COLORS.gray600,
    fontSize: 13,
    fontWeight: '600',
  },
  proofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proofButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  noProofText: {
    fontSize: 12,
    color: COLORS.gray400,
  },
  pendingTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  pendingTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  proofModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofModalClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  proofModalImage: {
    width: '100%',
    height: '80%',
  },
});

export default FriendBalanceDetailScreen;
