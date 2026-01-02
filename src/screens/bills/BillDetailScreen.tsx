import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import ConfirmationModal from '../../components/ConfirmationModal';
import PokeButton from '../../components/PokeButton';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { BillContext } from '../../context/BillContext';
import { GroupContext } from '../../context/GroupContext';
import { AuthContext } from '../../context/AuthContext';
import { supabaseApi } from '../../services/supabaseApi';
import { Bill, User, Group, BillCategory } from '../../types';
import { formatPeso } from '../../utils/formatting';
import { getBillCategoryIcon } from '../../utils/icons';

type BillDetailScreenProps = {
  navigation: any;
  route: any;
};

const BillDetailScreen: React.FC<BillDetailScreenProps> = ({ navigation, route }) => {
  const modal = useConfirmationModal();
  const { billId } = route.params;
  const [bill, setBill] = useState<Bill | null>(null);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);
  const groupContext = useContext(GroupContext);

  if (!authContext || !billContext) {
    return null;
  }

  const { user } = authContext;
  const { getBillById, updatePaymentStatus, deleteBill } = billContext;

  useEffect(() => {
    loadBill();
  }, [billId]);

  // Refresh bill data when returning from edit
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadBill();
    });
    return unsubscribe;
  }, [navigation, billId]);

  const loadBill = async () => {
    try {
      setLoading(true);
      const billData = await getBillById(billId);
      if (billData) {
        setBill(billData);
        await loadUsers(billData.participants);
        // Load group if bill belongs to a group
        if ((billData as any).groupId) {
          const groupData = await groupContext?.getGroupById((billData as any).groupId);
          setGroup(groupData || null);
        }
      }
    } catch (error) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Failed to load bill' });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (userIds: string[]) => {
    try {
      const loadedUsers = await supabaseApi.getUsersByIds(userIds);
      const usersMap: { [key: string]: User } = {};
      loadedUsers.forEach(u => {
        usersMap[u.id] = u;
      });
      setUsers(usersMap);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleMarkPaid = async (paymentIndex: number) => {
    try {
      setUpdatingPayment(true);
      const updatedBill = await updatePaymentStatus(
        billId,
        paymentIndex,
        !bill?.payments[paymentIndex].isPaid
      );
      setBill(updatedBill);
    } catch (error) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Failed to update payment status' });
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleDeleteBill = () => {
    modal.showModal({
      type: 'confirm',
      title: 'Delete Bill',
      message: 'Are you sure you want to delete this bill?',
      confirmText: 'Delete',
      showCancel: true,
      onConfirm: async () => {
        try {
          await deleteBill(billId);
          modal.showModal({ type: 'success', title: 'Success', message: 'Bill deleted successfully' });
          navigation.goBack();
        } catch (error) {
          modal.showModal({ type: 'error', title: 'Error', message: 'Failed to delete bill' });
        }
      }
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bill not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Ensure users object is valid and populated
  if (!users || Object.keys(users).length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const payer = users[bill.paidBy];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Group Badge */}
        {group && (
          <TouchableOpacity
            style={styles.groupBadgeSection}
            onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
          >
            <MaterialCommunityIcons name="folder-account" size={18} color={COLORS.white} />
            <View style={styles.groupBadgeContent}>
              <Text style={styles.groupBadgeLabel}>Part of group</Text>
              <Text style={styles.groupBadgeName}>{group.name}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.white} />
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.categoryBadge}>
            <MaterialCommunityIcons
              name={getBillCategoryIcon(bill.category)}
              size={28}
              color={COLORS.white}
            />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.billTitle}>{bill.title}</Text>
            <Text style={styles.billDate}>
              {new Date(bill.createdAt).toLocaleDateString()}
            </Text>
          </View>
          {user?.id === bill.paidBy && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('CreateBill', { bill })}
              >
                <MaterialCommunityIcons name="pencil" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteBill}
              >
                <MaterialCommunityIcons name="trash-can" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Amount and Payer */}
        <View style={styles.billSummaryCard}>
          <View style={styles.payerSection}>
            <View style={styles.payerAvatar}>
              <Text style={styles.payerInitial}>
                {payer?.name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.payerDetails}>
              <Text style={styles.payerLabel}>PAID BY</Text>
              <Text style={styles.payerName}>{payer?.name}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.amountSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>{formatPeso(bill.totalAmount)}</Text>
          </View>
        </View>

        {/* Split Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Split Details</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badge}>{bill.splitMethod}</Text>
            </View>
          </View>

          {bill.splits.map((split, index) => {
            const participant = users[split.userId];
            return (
              <View key={index} style={styles.splitRow}>
                <View>
                  <Text style={styles.splitName}>{participant?.name}</Text>
                  <Text style={styles.splitEmail}>{participant?.email}</Text>
                </View>
                <Text style={styles.splitAmount}>{formatPeso(split.amount)}</Text>
              </View>
            );
          })}
        </View>

        {/* Description */}
        {bill.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{bill.description}</Text>
            </View>
          </View>
        )}

        {/* Payments */}
        <View style={styles.section}>
          <View style={styles.paymentHeader}>
            <Text style={styles.sectionTitle}>Payment Status</Text>
            <View style={styles.paymentProgressBadge}>
              <MaterialCommunityIcons name="check-circle" size={14} color={COLORS.white} />
              <Text style={styles.paymentProgressText}>
                {bill.payments.filter(p => p.isPaid).length}/{bill.payments.length}
              </Text>
            </View>
          </View>
          {bill.payments.map((payment, index) => {
            const fromUser = users[payment.fromUserId];
            const toUser = users[payment.toUserId];
            const isCurrent = user?.id === payment.fromUserId;

            return (
              <View key={index} style={styles.paymentCard}>
                {/* Header with Status */}
                <View style={styles.paymentCardHeader}>
                  <View style={styles.paymentParties}>
                    <View style={styles.partySection}>
                      <View style={styles.partyIconContainer}>
                        <MaterialCommunityIcons name="account-circle" size={16} color={COLORS.gray600} />
                      </View>
                      <Text style={styles.partyName} numberOfLines={1}>{fromUser?.name}</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right-thin" size={20} color={COLORS.gray400} />
                    <View style={styles.partySection}>
                      <View style={styles.partyIconContainer}>
                        <MaterialCommunityIcons name="account-cash" size={16} color={COLORS.primary} />
                      </View>
                      <Text style={styles.partyName} numberOfLines={1}>{toUser?.name}</Text>
                    </View>
                  </View>
                </View>

                {/* Amount and Status Row */}
                <View style={styles.paymentAmountRow}>
                  <View style={styles.paymentAmountSection}>
                    <Text style={styles.paymentAmountLabel}>Amount</Text>
                    <Text
                      style={[
                        styles.paymentAmountValue,
                        payment.isPaid ? styles.amountPaid : styles.amountPending,
                      ]}
                    >
                      {formatPeso(payment.amount)}
                    </Text>
                  </View>
                  <View style={styles.statusSection}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusPill,
                        payment.isPaid ? styles.statusPillPaid : styles.statusPillPending,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={payment.isPaid ? "check-circle" : "clock-alert-outline"}
                        size={12}
                        color={payment.isPaid ? COLORS.success : COLORS.warning}
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          payment.isPaid ? styles.statusTextPaid : styles.statusTextPending,
                        ]}
                      >
                        {payment.isPaid ? 'Paid' : 'Pending'}
                      </Text>
                    </View>
                    {payment.isPaid && (
                      <Text style={styles.paidDate}>
                        {new Date(payment.paidAt || 0).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                {isCurrent && !payment.isPaid && (
                  <View style={styles.paymentActions}>
                    <TouchableOpacity
                      style={styles.primaryActionButton}
                      onPress={() => navigation.navigate('Payment', {
                        billId: billId,
                        friendId: payment.toUserId,
                        friendName: toUser?.name || 'Friend',
                        amount: payment.amount,
                      })}
                      disabled={updatingPayment}
                    >
                      <MaterialCommunityIcons name="credit-card" size={16} color={COLORS.white} />
                      <Text style={styles.primaryActionText}>Pay Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() => handleMarkPaid(index)}
                      disabled={updatingPayment}
                    >
                      {updatingPayment ? (
                        <ActivityIndicator color={COLORS.primary} size="small" />
                      ) : (
                        <Text style={styles.secondaryActionText}>Mark as Paid</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {!isCurrent && !payment.isPaid && user?.id === payment.toUserId && (
                  <View style={styles.pokeSection}>
                    <PokeButton
                      friendId={payment.fromUserId}
                      friendName={fromUser?.name || 'Friend'}
                      billId={billId}
                      billTitle={bill?.title}
                      amount={payment.amount}
                      size="small"
                      onPokeSuccess={() => {
                        modal.showModal({
                          type: 'success',
                          title: 'Poke Sent! 👋',
                          message: `${fromUser?.name} has been notified about the payment.`,
                        });
                      }}
                    />
                  </View>
                )}

                {payment.isPaid && isCurrent && (
                  <TouchableOpacity
                    style={styles.undoAction}
                    onPress={() => handleMarkPaid(index)}
                    disabled={updatingPayment}
                  >
                    {updatingPayment ? (
                      <ActivityIndicator color={COLORS.gray600} size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="undo" size={14} color={COLORS.gray600} />
                        <Text style={styles.undoActionText}>Undo Payment</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

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
  groupBadgeSection: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  groupBadgeContent: {
    flex: 1,
  },
  groupBadgeLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
    opacity: 0.8,
  },
  groupBadgeName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.gray600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  categoryBadge: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  billTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  billDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginTop: SPACING.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  editButton: {
    padding: SPACING.md,
  },
  deleteButton: {
    padding: SPACING.md,
  },
  billSummaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  payerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  payerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payerInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  payerDetails: {
    flex: 1,
  },
  payerLabel: {
    fontSize: 10,
    color: COLORS.gray500,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  payerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray200,
    marginVertical: SPACING.md,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  section: {
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  badgeContainer: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  badge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray700,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  splitName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  splitEmail: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  splitAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  descriptionBox: {
    backgroundColor: COLORS.gray50,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  descriptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray700,
    lineHeight: 22,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  paymentProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  paymentProgressText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  paymentCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  paymentCardHeader: {
    marginBottom: SPACING.md,
  },
  paymentParties: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  partyIconContainer: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray800,
    flex: 1,
  },
  paymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  paymentAmountSection: {
    flex: 1,
  },
  paymentAmountLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  paymentAmountValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  amountPaid: {
    color: COLORS.success,
  },
  amountPending: {
    color: COLORS.danger,
  },
  statusSection: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusPillPaid: {
    backgroundColor: '#dcfce7',
  },
  statusPillPending: {
    backgroundColor: '#fef3c7',
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  statusTextPaid: {
    color: COLORS.success,
  },
  statusTextPending: {
    color: COLORS.warning,
  },
  paidDate: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
  },
  paymentActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  pokeSection: {
    marginTop: SPACING.md,
    alignItems: 'flex-end',
  },
  undoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  undoActionText: {
    color: COLORS.gray600,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
});

export default BillDetailScreen;
