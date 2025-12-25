import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { BillContext } from '../../context/BillContext';
import { GroupContext } from '../../context/GroupContext';
import { AuthContext } from '../../context/AuthContext';
import { mockApi } from '../../services/mockApi';
import { Bill, User, Group } from '../../types';

type BillDetailScreenProps = {
  navigation: any;
  route: any;
};

const BillDetailScreen: React.FC<BillDetailScreenProps> = ({ navigation, route }) => {
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
    // loadBill();
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
      Alert.alert('Error', 'Failed to load bill');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (userIds: string[]) => {
    const loadedUsers = await mockApi.getUsersByIds(userIds);
    const usersMap: { [key: string]: User } = {};
    loadedUsers.forEach(u => {
      usersMap[u.id] = u;
    });
    setUsers(usersMap);
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
      Alert.alert('Error', 'Failed to update payment status');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleDeleteBill = () => {
    Alert.alert('Delete Bill', 'Are you sure you want to delete this bill?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await deleteBill(billId);
            Alert.alert('Success', 'Bill deleted successfully');
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete bill');
          }
        },
        style: 'destructive',
      },
    ]);
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
          <View>
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
        <View style={styles.amountSection}>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amountValue}>${bill.totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.payerCard}>
            <MaterialCommunityIcons name="wallet" size={24} color={COLORS.primary} />
            <View style={styles.payerInfo}>
              <Text style={styles.payerLabel}>Paid by</Text>
              <Text style={styles.payerName}>{payer?.name}</Text>
            </View>
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
                <Text style={styles.splitAmount}>${split.amount.toFixed(2)}</Text>
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
          <Text style={styles.sectionTitle}>Payment Status</Text>
          {bill.payments.map((payment, index) => {
            const fromUser = users[payment.fromUserId];
            const toUser = users[payment.toUserId];
            const isCurrent = user?.id === payment.fromUserId;

            return (
              <View key={index} style={styles.paymentCard}>
                <View style={styles.paymentContent}>
                  <View>
                    <Text style={styles.paymentText}>
                      {fromUser?.name} → {toUser?.name}
                    </Text>
                    <Text style={styles.paymentStatus}>
                      {payment.isPaid
                        ? `Paid on ${new Date(payment.paidAt || 0).toLocaleDateString()}`
                        : 'Pending'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.paymentAmount,
                      payment.isPaid ? styles.paidAmount : styles.pendingAmount,
                    ]}
                  >
                    ${payment.amount.toFixed(2)}
                  </Text>
                </View>

                {isCurrent && !payment.isPaid && (
                  <TouchableOpacity
                    style={styles.markPaidButton}
                    onPress={() => handleMarkPaid(index)}
                    disabled={updatingPayment}
                  >
                    {updatingPayment ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check" size={16} color={COLORS.white} />
                        <Text style={styles.markPaidButtonText}>Mark as Paid</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {payment.isPaid && (
                  <View style={styles.paidBadge}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                    <Text style={styles.paidBadgeText}>Paid</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  amountSection: {
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  amountCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  amountLabel: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  amountValue: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  payerCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  payerInfo: {
    marginLeft: SPACING.lg,
    flex: 1,
  },
  payerLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  payerName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: SPACING.xs,
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
  paymentCard: {
    backgroundColor: COLORS.gray50,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  paymentContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  paymentText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  paymentStatus: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  paymentAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  paidAmount: {
    color: COLORS.success,
  },
  pendingAmount: {
    color: COLORS.danger,
  },
  markPaidButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.success,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  markPaidButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  paidBadgeText: {
    color: COLORS.success,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
});

export default BillDetailScreen;
