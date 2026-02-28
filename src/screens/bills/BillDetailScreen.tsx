import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { formatAmount } from '../../utils/formatting';
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
      const payment = bill?.payments[paymentIndex];
      // If payment is pending_confirmation or paid, we want to unmark (set to false)
      // Otherwise, we want to mark as paid (set to true)
      const shouldMarkPaid = !payment?.isPaid && payment?.paymentStatus !== 'pending_confirmation';
      const updatedBill = await updatePaymentStatus(
        billId,
        paymentIndex,
        shouldMarkPaid
      );
      setBill(updatedBill);
    } catch (error) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Failed to update payment status' });
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleConfirmPayment = async (payment: any) => {
    modal.showModal({
      type: 'confirm',
      title: 'Confirm Payment Received',
      message: `Confirm that you received ${formatAmount(payment.amount, user?.preferredCurrency)} from ${users[payment.fromUserId]?.name ?? 'Deleted User'}?`,
      confirmText: 'Confirm',
      showCancel: true,
      onConfirm: async () => {
        try {
          setUpdatingPayment(true);
          if (!user) {
            throw new Error('User not authenticated');
          }

          // Call the confirmPayment API
          await supabaseApi.confirmPayment(billId, payment.fromUserId, user.id);

          // Reload the bill to get updated status
          const updatedBill = await getBillById(billId);
          if (updatedBill) {
            setBill(updatedBill);
          }

          modal.showModal({
            type: 'success',
            title: 'Payment Confirmed',
            message: 'Payment has been confirmed successfully!',
          });
        } catch (error) {
          console.error('Error confirming payment:', error);
          modal.showModal({
            type: 'error',
            title: 'Error',
            message: 'Failed to confirm payment. Please try again.',
          });
        } finally {
          setUpdatingPayment(false);
        }
      },
    });
  };

  const handleUndoConfirmPayment = async (payment: any) => {
    modal.showModal({
      type: 'confirm',
      title: 'Undo Payment Confirmation',
      message: `Undo the confirmation for ${formatAmount(payment.amount, user?.preferredCurrency)} from ${users[payment.fromUserId]?.name ?? 'Deleted User'}?\n\nThis will revert the status back to pending confirmation.`,
      confirmText: 'Undo',
      showCancel: true,
      onConfirm: async () => {
        try {
          setUpdatingPayment(true);
          if (!user) {
            throw new Error('User not authenticated');
          }

          // Call the undoConfirmPayment API
          await supabaseApi.undoConfirmPayment(billId, payment.fromUserId, user.id);

          // Reload the bill to get updated status
          const updatedBill = await getBillById(billId);
          if (updatedBill) {
            setBill(updatedBill);
          }

          modal.showModal({
            type: 'success',
            title: 'Confirmation Undone',
            message: 'Payment confirmation has been undone. Status is now pending confirmation.',
          });
        } catch (error) {
          console.error('Error undoing confirmation:', error);
          modal.showModal({
            type: 'error',
            title: 'Error',
            message: 'Failed to undo confirmation. Please try again.',
          });
        } finally {
          setUpdatingPayment(false);
        }
      },
    });
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
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Details</Text>
          <View style={styles.headerRight} />
        </View>
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
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const payer = users[bill.paidBy];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
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
        <View style={styles.billHeader}>
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
              {new Date(bill.billDate ?? bill.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
                {payer?.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.payerDetails}>
              <Text style={styles.payerLabel}>PAID BY</Text>
              <Text style={styles.payerName}>{payer?.name ?? 'Deleted User'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.amountSection}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>{formatAmount(bill.totalAmount, user?.preferredCurrency)}</Text>
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
                  <Text style={styles.splitName}>{participant?.name ?? 'Deleted User'}</Text>
                  <Text style={styles.splitEmail}>{participant?.email ?? ''}</Text>
                </View>
                <Text style={styles.splitAmount}>{formatAmount(split.amount, user?.preferredCurrency)}</Text>
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

        {/* Location */}
        {bill.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.primary} />
              <Text style={styles.metaText}>{bill.location}</Text>
            </View>
          </View>
        )}

        {/* Attachment */}
        {bill.attachmentUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attachment</Text>
            <TouchableOpacity onPress={() => bill.attachmentUrl && Linking.openURL(bill.attachmentUrl)}>
              <Image source={{ uri: bill.attachmentUrl }} style={styles.receiptImage} resizeMode="cover" />
            </TouchableOpacity>
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
                      <Text style={styles.partyName} numberOfLines={1}>{fromUser?.name ?? 'Deleted User'}</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right-thin" size={20} color={COLORS.gray400} />
                    <View style={styles.partySection}>
                      <View style={styles.partyIconContainer}>
                        <MaterialCommunityIcons name="account-cash" size={16} color={COLORS.primary} />
                      </View>
                      <Text style={styles.partyName} numberOfLines={1}>{toUser?.name ?? 'Deleted User'}</Text>
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
                        payment.isPaid || payment.paymentStatus === 'confirmed'
                          ? styles.amountPaid
                          : payment.paymentStatus === 'pending_confirmation'
                          ? styles.amountPendingConfirmation
                          : styles.amountPending,
                      ]}
                    >
                      {formatAmount(payment.amount, user?.preferredCurrency)}
                    </Text>
                  </View>
                  <View style={styles.statusSection}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusPill,
                        payment.isPaid || payment.paymentStatus === 'confirmed'
                          ? styles.statusPillPaid
                          : payment.paymentStatus === 'pending_confirmation'
                          ? styles.statusPillPendingConfirmation
                          : styles.statusPillPending,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          payment.isPaid || payment.paymentStatus === 'confirmed'
                            ? "check-circle"
                            : payment.paymentStatus === 'pending_confirmation'
                            ? "clock-check-outline"
                            : "clock-alert-outline"
                        }
                        size={12}
                        color={
                          payment.isPaid || payment.paymentStatus === 'confirmed'
                            ? COLORS.success
                            : payment.paymentStatus === 'pending_confirmation'
                            ? COLORS.primary
                            : COLORS.warning
                        }
                      />
                      <Text
                        style={[
                          styles.statusPillText,
                          payment.isPaid || payment.paymentStatus === 'confirmed'
                            ? styles.statusTextPaid
                            : payment.paymentStatus === 'pending_confirmation'
                            ? styles.statusTextPendingConfirmation
                            : styles.statusTextPending,
                        ]}
                      >
                        {payment.isPaid || payment.paymentStatus === 'confirmed'
                          ? 'Confirmed'
                          : payment.paymentStatus === 'pending_confirmation'
                          ? 'Pending Confirmation'
                          : 'Unpaid'}
                      </Text>
                    </View>
                    {(payment.isPaid || payment.paymentStatus === 'confirmed') && (
                      <Text style={styles.paidDate}>
                        {new Date(payment.paidAt || 0).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                    {payment.paymentStatus === 'pending_confirmation' && payment.markedPaidAt && (
                      <Text style={styles.paidDate}>
                        Marked {new Date(payment.markedPaidAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                {isCurrent && !payment.isPaid && payment.paymentStatus !== 'pending_confirmation' && (
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

                {/* Confirm Payment button for receiver when status is pending_confirmation */}
                {!isCurrent && user?.id === payment.toUserId && payment.paymentStatus === 'pending_confirmation' && (
                  <View style={styles.paymentActions}>
                    <TouchableOpacity
                      style={styles.confirmPaymentButton}
                      onPress={() => handleConfirmPayment(payment)}
                      disabled={updatingPayment}
                    >
                      {updatingPayment ? (
                        <ActivityIndicator color={COLORS.white} size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.white} />
                          <Text style={styles.primaryActionText}>Confirm Payment Received</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Undo Confirmation button for receiver when status is confirmed */}
                {!isCurrent && user?.id === payment.toUserId && payment.paymentStatus === 'confirmed' && (
                  <TouchableOpacity
                    style={styles.undoAction}
                    onPress={() => handleUndoConfirmPayment(payment)}
                    disabled={updatingPayment}
                  >
                    {updatingPayment ? (
                      <ActivityIndicator color={COLORS.gray600} size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="undo" size={14} color={COLORS.gray600} />
                        <Text style={styles.undoActionText}>Undo Confirmation</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {!isCurrent && !payment.isPaid && payment.paymentStatus !== 'pending_confirmation' && user?.id === payment.toUserId && (
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
                          title: 'Poke Sent!',
                          message: `${fromUser?.name} has been notified about the payment.`,
                          icon: 'gesture-tap',
                        });
                      }}
                    />
                  </View>
                )}

                {/* Undo button for payer when pending or paid */}
                {(payment.isPaid || payment.paymentStatus === 'pending_confirmation') && isCurrent && (
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
                        <Text style={styles.undoActionText}>
                          {payment.paymentStatus === 'pending_confirmation' ? 'Cancel Payment' : 'Undo Payment'}
                        </Text>
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
  backButton: {
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
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  scrollViewContent: {
    flexGrow: 1,
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
    backgroundColor: COLORS.gray50,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.gray600,
  },
  billHeader: {
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
  amountPendingConfirmation: {
    color: COLORS.primary,
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
  statusPillPendingConfirmation: {
    backgroundColor: '#dbeafe',
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
  statusTextPendingConfirmation: {
    color: COLORS.primary,
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
  confirmPaymentButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  metaText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray700,
    flex: 1,
  },
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
});

export default BillDetailScreen;
