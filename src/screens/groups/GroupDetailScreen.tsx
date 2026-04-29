import React, { useContext, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GroupContext } from '../../context/GroupContext';
import { AuthContext } from '../../context/AuthContext';
import { Group, Bill, User } from '../../types';
import { COLORS } from '../../constants/theme';
import { supabaseApi } from '../../services/supabaseApi';
import { formatAmount } from '../../utils/formatting';
import { getBillCategoryIcon, getGroupCategoryIcon } from '../../utils/icons';
import BillCreationPickerModal from '../../components/BillCreationPickerModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';

type Tab = 'bills' | 'settlements' | 'summary';

const TABS: { key: Tab; label: string }[] = [
  { key: 'bills', label: 'Bills' },
  { key: 'settlements', label: 'Settlements' },
  { key: 'summary', label: 'Summary' },
];

const CHART_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#F97316', '#EC4899',
];

interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

const DonutChart = ({ slices, size = 200 }: { slices: DonutSlice[]; size?: number }) => {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.58;
  const GAP = 0.018; // radians gap between slices

  let cursor = -Math.PI / 2;

  const paths = slices
    .filter(d => d.value > 0)
    .map(d => {
      const sweep = (d.value / total) * 2 * Math.PI - GAP;
      const start = cursor + GAP / 2;
      const end = start + sweep;
      cursor += (d.value / total) * 2 * Math.PI;

      const x1 = cx + outerR * Math.cos(start);
      const y1 = cy + outerR * Math.sin(start);
      const x2 = cx + outerR * Math.cos(end);
      const y2 = cy + outerR * Math.sin(end);
      const ix1 = cx + innerR * Math.cos(end);
      const iy1 = cy + innerR * Math.sin(end);
      const ix2 = cx + innerR * Math.cos(start);
      const iy2 = cy + innerR * Math.sin(start);
      const large = sweep > Math.PI ? 1 : 0;

      return {
        color: d.color,
        d: `M${x1} ${y1} A${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L${ix1} ${iy1} A${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2}Z`,
      };
    });

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={innerR} fill={COLORS.white} />
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} />
      ))}
    </Svg>
  );
};

/** Net balance between the current user and one other group member, from group bills only. */
interface MemberBalance {
  memberId: string;
  /** positive → they owe me; negative → I owe them */
  net: number;
  /** number of unsettled bills involved */
  billCount: number;
  /** amount I've marked as paid but awaiting their confirmation (on bills I owe) */
  myPendingAmount: number;
  /** amount they've marked as paid but awaiting my confirmation (on bills they owe me) */
  theirPendingAmount: number;
  /** bill IDs where I owe this member (to pass to PaymentScreen) */
  billIds: string[];
  /** bill IDs where my split is pending_confirmation (so I can undo) */
  myPendingBillIds: string[];
  /** bill IDs where they've marked as paid and I need to confirm receipt */
  theirPendingBillIds: string[];
}

const GroupDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const groupContext = useContext(GroupContext);
  const authContext = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  const { groupId, initialTab } = route.params || {};
  const [group, setGroup] = useState<Group | null>(null);
  const [groupBills, setGroupBills] = useState<Bill[]>([]);
  const [memberUsers, setMemberUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreationPicker, setShowCreationPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'bills');
  const [recentlyConfirmed, setRecentlyConfirmed] = useState<{
    memberName: string;
    memberId: string;
    billIds: string[];
    totalAmount: number;
  } | null>(null);
  const user = authContext?.user;

  const modal = useConfirmationModal();

  const { getGroupById, getGroupBills, deleteGroup } = groupContext || {
    getGroupById: async () => null,
    getGroupBills: async () => [],
    deleteGroup: async () => ({ success: false }),
  };

  const handleDeleteGroup = useCallback(() => {
    modal.showModal({
      type: 'confirm',
      title: 'Delete Group',
      message: `Are you sure you want to delete "${group?.name}"? This will permanently delete the group and all its bills. This cannot be undone.`,
      confirmText: 'Delete',
      showCancel: true,
      onConfirm: async () => {
        try {
          await deleteGroup(groupId);
          navigation.goBack();
        } catch (err) {
          modal.showModal({
            type: 'error',
            title: 'Error',
            message: 'Failed to delete the group. Please try again.',
          });
        }
      },
    });
  }, [group, groupId, deleteGroup, navigation, modal]);

  const loadGroupDetails = useCallback(async () => {
    if (!groupId) return;
    try {
      setIsLoading(true);
      const [groupData, bills] = await Promise.all([
        getGroupById(groupId),
        getGroupBills(groupId),
      ]);
      setGroup(groupData);
      setGroupBills(bills);
      if (groupData && groupData.members.length > 0) {
        try {
          const users = await supabaseApi.getUsersByIds(groupData.members);
          setMemberUsers(users);
        } catch (err) {
          console.error('Error fetching member users:', err);
        }
      }
    } catch (err) {
      console.error('Error loading group details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, getGroupById, getGroupBills]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadGroupDetails();
    setIsRefreshing(false);
  }, [loadGroupDetails]);

  useFocusEffect(
    useCallback(() => {
      loadGroupDetails();
    }, [loadGroupDetails])
  );

  const getMemberName = useCallback(
    (memberId: string) => {
      if (memberId === user?.id) return 'You';
      return memberUsers.find(u => u.id === memberId)?.name || memberId.substring(0, 8);
    },
    [user, memberUsers]
  );

  const handleUndoSettlement = useCallback((memberName: string, pendingBillIds: string[]) => {
    if (!user || pendingBillIds.length === 0) return;
    modal.showModal({
      type: 'confirm',
      title: 'Undo Payment',
      message: `Cancel the pending payment to ${memberName}? This will revert ${pendingBillIds.length} ${pendingBillIds.length === 1 ? 'bill' : 'bills'} back to unpaid.`,
      confirmText: 'Undo Payment',
      showCancel: true,
      onConfirm: async () => {
        for (const billId of pendingBillIds) {
          await supabaseApi.unmarkBillSplit(billId, user.id);
        }
        await loadGroupDetails();
      },
    });
  }, [user, modal, loadGroupDetails]);

  const handleConfirmSettlement = useCallback((
    memberName: string,
    memberId: string,
    pendingBillIds: string[],
    totalAmount: number,
  ) => {
    if (!user || pendingBillIds.length === 0) return;
    modal.showModal({
      type: 'confirm',
      title: 'Confirm Payment Received',
      message: `Confirm that you received all pending payments from ${memberName}? This will settle ${pendingBillIds.length} ${pendingBillIds.length === 1 ? 'bill' : 'bills'}.`,
      confirmText: 'Confirm',
      showCancel: true,
      onConfirm: async () => {
        const isMulti = pendingBillIds.length > 1;
        for (const billId of pendingBillIds) {
          await supabaseApi.confirmPayment(billId, memberId, user.id, { skipActivity: isMulti });
        }
        if (isMulti && group) {
          const userProfile = await supabaseApi.getUserProfile(user.id);
          const userName = userProfile?.name || 'Someone';
          const payload = {
            groupId: group.id,
            payerName: memberName,
            amount: totalAmount,
            billCount: pendingBillIds.length,
            userName,
          };
          await supabaseApi.createActivity({
            actorId: user.id, action: 'payment_confirmed',
            targetType: 'user', targetId: memberId, payload,
          });
          await supabaseApi.createActivity({
            actorId: user.id, action: 'payment_confirmed',
            targetType: 'user', targetId: user.id, payload,
          });
        }
        setRecentlyConfirmed({ memberName, memberId, billIds: pendingBillIds, totalAmount });
        await loadGroupDetails();
      },
    });
  }, [user, group, modal, loadGroupDetails]);

  const handleUndoConfirmSettlement = useCallback(async () => {
    if (!user || !recentlyConfirmed) return;
    const { memberId, memberName, billIds, totalAmount } = recentlyConfirmed;
    setRecentlyConfirmed(null);
    const isMulti = billIds.length > 1;
    for (const billId of billIds) {
      await supabaseApi.undoConfirmPayment(billId, memberId, user.id, { skipActivity: isMulti });
    }
    if (isMulti && group) {
      const userProfile = await supabaseApi.getUserProfile(user.id);
      const userName = userProfile?.name || 'Someone';
      await supabaseApi.createActivity({
        actorId: user.id, action: 'payment_made',
        targetType: 'user', targetId: memberId,
        payload: { groupId: group.id, receiverName: memberName, amount: totalAmount, billCount: billIds.length, userName, status: 'pending_confirmation' },
      });
      await supabaseApi.createActivity({
        actorId: user.id, action: 'payment_made',
        targetType: 'user', targetId: user.id,
        payload: { groupId: group.id, receiverName: memberName, amount: totalAmount, billCount: billIds.length, userName, status: 'pending_confirmation' },
      });
    }
    await loadGroupDetails();
  }, [user, group, recentlyConfirmed, loadGroupDetails]);

  /**
   * Per-member net balance with the current user, from unsettled group bill splits only.
   * net > 0 → they owe me; net < 0 → I owe them.
   */
  const memberBalances = useMemo<MemberBalance[]>(() => {
    if (!user || !group) return [];

    return group.members
      .filter(memberId => memberId !== user.id)
      .map(memberId => {
        let theyOweMe = 0;
        let iOweThem = 0;
        let myPendingAmount = 0;
        let theirPendingAmount = 0;
        const involvedBillIds = new Set<string>();
        const billIds: string[] = [];
        const myPendingBillIds: string[] = [];
        const theirPendingBillIds: string[] = [];

        groupBills.forEach(bill => {
          if (bill.paidBy === user.id) {
            const theirSplit = bill.splits.find(s => s.userId === memberId);
            if (theirSplit && !theirSplit.settled && theirSplit.amount > 0) {
              theyOweMe += theirSplit.amount;
              involvedBillIds.add(bill.id);
              if (theirSplit.paymentStatus === 'pending_confirmation') {
                theirPendingAmount += theirSplit.amount;
                theirPendingBillIds.push(bill.id);
              }
            }
          } else if (bill.paidBy === memberId) {
            const mySplit = bill.splits.find(s => s.userId === user.id);
            if (mySplit && !mySplit.settled && mySplit.amount > 0) {
              iOweThem += mySplit.amount;
              involvedBillIds.add(bill.id);
              billIds.push(bill.id);
              if (mySplit.paymentStatus === 'pending_confirmation') {
                myPendingAmount += mySplit.amount;
                myPendingBillIds.push(bill.id);
              }
            }
          }
        });

        const net = parseFloat((theyOweMe - iOweThem).toFixed(2));
        return {
          memberId,
          net,
          billCount: involvedBillIds.size,
          myPendingAmount: parseFloat(myPendingAmount.toFixed(2)),
          theirPendingAmount: parseFloat(theirPendingAmount.toFixed(2)),
          billIds,
          myPendingBillIds,
          theirPendingBillIds,
        };
      })
      .filter(b => Math.abs(b.net) > 0.005);
  }, [user, group, groupBills]);

  const iOweList = useMemo(
    () => memberBalances.filter(b => b.net < 0).sort((a, b) => a.net - b.net),
    [memberBalances]
  );

  const oweMeList = useMemo(
    () => memberBalances.filter(b => b.net > 0).sort((a, b) => b.net - a.net),
    [memberBalances]
  );

  const totalIOwe = useMemo(
    () => parseFloat(iOweList.reduce((s, b) => s + Math.abs(b.net), 0).toFixed(2)),
    [iOweList]
  );

  const totalOwedToMe = useMemo(
    () => parseFloat(oweMeList.reduce((s, b) => s + b.net, 0).toFixed(2)),
    [oweMeList]
  );

  // Per-member totals for Summary tab (all splits, settled or not)
  const memberShareData = useMemo(() => {
    if (!group) return [];
    return group.members
      .map(memberId => {
        const totalPaid = groupBills
          .filter(b => b.paidBy === memberId)
          .reduce((sum, b) => sum + b.totalAmount, 0);

        const totalShare = groupBills.reduce((sum, b) => {
          const split = b.splits.find(s => s.userId === memberId);
          return sum + (split?.amount || 0);
        }, 0);

        return {
          memberId,
          totalPaid: parseFloat(totalPaid.toFixed(2)),
          totalShare: parseFloat(totalShare.toFixed(2)),
        };
      })
      .sort((a, b) => b.totalShare - a.totalShare);
  }, [group, groupBills]);

  const maxShare = useMemo(
    () => Math.max(...memberShareData.map(m => m.totalShare), 1),
    [memberShareData]
  );

  const totalGroupSpend = useMemo(
    () => memberShareData.reduce((sum, m) => sum + m.totalShare, 0),
    [memberShareData]
  );

  // ─── Bills tab ────────────────────────────────────────────────────────────

  const renderBillItem = ({ item }: { item: Bill }) => {
    const userSplit = item.splits.find(s => s.userId === user?.id);
    const isPayer = item.paidBy === user?.id;

    let amount = 0;
    if (isPayer) {
      amount = item.splits
        .filter(s => s.userId !== user?.id && !s.settled)
        .reduce((sum, s) => sum + s.amount, 0);
    } else {
      amount = userSplit && !userSplit.settled ? userSplit.amount : 0;
    }

    const isFullySettled = isPayer
      ? item.splits.filter(s => s.userId !== user?.id).every(s => s.settled)
      : userSplit?.settled;

    return (
      <TouchableOpacity
        style={[styles.billCard, isFullySettled && styles.billCardSettled]}
        onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
      >
        <View style={styles.billHeader}>
          <View style={styles.categoryIconBadge}>
            <MaterialCommunityIcons
              name={getBillCategoryIcon(item.category)}
              size={20}
              color={COLORS.white}
            />
          </View>
          <View style={styles.billTitleContainer}>
            <Text style={[styles.billTitle, isFullySettled && styles.billTitleSettled]}>
              {item.title}
              {isFullySettled && ' ✓'}
            </Text>
          </View>
          <Text
            style={[
              styles.billAmount,
              isPayer ? styles.amountOwed : styles.amountOwing,
              isFullySettled && styles.amountSettled,
            ]}
            numberOfLines={1}
          >
            {formatAmount(isPayer ? amount : -amount, user?.preferredCurrency)}
          </Text>
        </View>
        <View style={styles.billFooter}>
          <Text style={styles.billDate}>
            {new Date(item.billDate ?? item.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.billDetails}>
            {item.participants.length} participants
            {isFullySettled && ' • Settled'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Settlements tab ──────────────────────────────────────────────────────

  const renderSettlementsTab = () => {
    const allSettled = iOweList.length === 0 && oweMeList.length === 0;
    const currency = user?.preferredCurrency;

    return (
      <ScrollView
        contentContainerStyle={[
          styles.tabContent,
          { paddingBottom: 80 + Math.max(insets.bottom, 12) },
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {/* Undo confirmation banner — shown briefly after confirming a settlement */}
        {recentlyConfirmed && (
          <View style={styles.undoBanner}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={COLORS.success} />
            <Text style={styles.undoBannerText} numberOfLines={1}>
              Confirmed payment from {recentlyConfirmed.memberName}
            </Text>
            <TouchableOpacity onPress={handleUndoConfirmSettlement} style={styles.undoBannerBtn}>
              <Text style={styles.undoBannerBtnText}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRecentlyConfirmed(null)} style={styles.undoBannerDismiss}>
              <MaterialCommunityIcons name="close" size={14} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {/* Summary banner */}
        <View style={styles.settleSummaryRow}>
          <View style={[styles.settleSummaryCard, { borderColor: COLORS.danger }]}>
            <Text style={styles.settleSummaryLabel}>You owe</Text>
            <Text style={[styles.settleSummaryAmount, { color: COLORS.danger }]}>
              {formatAmount(totalIOwe, currency)}
            </Text>
            <Text style={styles.settleSummaryCount}>
              {iOweList.length} {iOweList.length === 1 ? 'person' : 'people'}
            </Text>
          </View>
          <View style={[styles.settleSummaryCard, { borderColor: COLORS.success }]}>
            <Text style={styles.settleSummaryLabel}>Owed to you</Text>
            <Text style={[styles.settleSummaryAmount, { color: COLORS.success }]}>
              {formatAmount(totalOwedToMe, currency)}
            </Text>
            <Text style={styles.settleSummaryCount}>
              {oweMeList.length} {oweMeList.length === 1 ? 'person' : 'people'}
            </Text>
          </View>
        </View>

        {allSettled ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="check-circle-outline" size={52} color={COLORS.success} />
            <Text style={styles.emptyStateTitle}>All settled up!</Text>
            <Text style={styles.emptyStateSubtitle}>
              No outstanding balances in this group.
            </Text>
          </View>
        ) : (
          <>
            {/* You owe section */}
            {iOweList.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionDot, { backgroundColor: COLORS.danger }]} />
                  <Text style={styles.sectionHeaderText}>You owe</Text>
                </View>
                {iOweList.map(b => {
                  const name = getMemberName(b.memberId);
                  const memberUser = memberUsers.find(u => u.id === b.memberId);
                  const isFullyPending = b.myPendingAmount >= Math.abs(b.net);
                  const unpaidAmount = parseFloat((Math.abs(b.net) - b.myPendingAmount).toFixed(2));
                  return (
                    <View key={b.memberId} style={[styles.balanceCard, styles.balanceCardOwe]}>
                      <View style={styles.balanceCardLeft}>
                        <View style={[styles.avatarCircle, { backgroundColor: COLORS.danger }]}>
                          <Text style={styles.avatarText}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.balanceCardInfo}>
                          <Text style={styles.balanceCardName}>{name}</Text>
                          <Text style={styles.balanceCardSub}>
                            across {b.billCount} {b.billCount === 1 ? 'bill' : 'bills'}
                          </Text>
                          {b.myPendingAmount > 0 && (
                            <View style={styles.statusBadge}>
                              <MaterialCommunityIcons name="clock-check-outline" size={11} color={COLORS.primary} />
                              <Text style={styles.statusBadgeText}>
                                {isFullyPending
                                  ? 'Pending Confirmation'
                                  : `${formatAmount(b.myPendingAmount, currency)} Pending`}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.balanceCardRight}>
                        <Text style={[styles.balanceCardAmount, { color: COLORS.danger }]}>
                          {formatAmount(Math.abs(b.net), currency)}
                        </Text>
                        {isFullyPending ? (
                          <>
                            <View style={[styles.payBtn, styles.payBtnPending]}>
                              <MaterialCommunityIcons name="clock-outline" size={13} color={COLORS.white} />
                              <Text style={styles.payBtnText}>Pending</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.undoBtn}
                              onPress={() => handleUndoSettlement(name, b.myPendingBillIds)}
                            >
                              <MaterialCommunityIcons name="undo" size={12} color={COLORS.gray600} />
                              <Text style={styles.undoBtnText}>Undo</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.payBtn}
                              onPress={() =>
                                navigation.navigate('Payment', {
                                  friendId: b.memberId,
                                  friendName: memberUser?.name || name,
                                  amount: unpaidAmount,
                                  billIds: b.billIds,
                                  groupId: group?.id,
                                })
                              }
                            >
                              <MaterialCommunityIcons name="cash" size={13} color={COLORS.white} />
                              <Text style={styles.payBtnText}>Pay</Text>
                            </TouchableOpacity>
                            {b.myPendingAmount > 0 && (
                              <TouchableOpacity
                                style={styles.undoBtn}
                                onPress={() => handleUndoSettlement(name, b.myPendingBillIds)}
                              >
                                <MaterialCommunityIcons name="undo" size={12} color={COLORS.gray600} />
                                <Text style={styles.undoBtnText}>Undo</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Owed to you section */}
            {oweMeList.length > 0 && (
              <>
                <View style={[styles.sectionHeaderRow, iOweList.length > 0 && { marginTop: 8 }]}>
                  <View style={[styles.sectionDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.sectionHeaderText}>Owed to you</Text>
                </View>
                {oweMeList.map(b => {
                  const name = getMemberName(b.memberId);
                  return (
                    <View key={b.memberId} style={[styles.balanceCard, styles.balanceCardOwed]}>
                      <View style={styles.balanceCardLeft}>
                        <View style={[styles.avatarCircle, { backgroundColor: COLORS.success }]}>
                          <Text style={styles.avatarText}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.balanceCardInfo}>
                          <Text style={styles.balanceCardName}>{name}</Text>
                          <Text style={styles.balanceCardSub}>
                            across {b.billCount} {b.billCount === 1 ? 'bill' : 'bills'}
                          </Text>
                          {b.theirPendingAmount > 0 && (
                            <View style={[styles.statusBadge, styles.statusBadgeWarning]}>
                              <MaterialCommunityIcons name="clock-alert-outline" size={11} color={COLORS.warning} />
                              <Text style={[styles.statusBadgeText, { color: COLORS.warning }]}>
                                {b.theirPendingAmount >= b.net
                                  ? 'Awaiting Your Confirmation'
                                  : `${formatAmount(b.theirPendingAmount, currency)} Awaiting`}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.balanceCardRight}>
                        <Text style={[styles.balanceCardAmount, { color: COLORS.success }]}>
                          {formatAmount(b.net, currency)}
                        </Text>
                        {b.theirPendingBillIds.length > 0 && (
                          <TouchableOpacity
                            style={[styles.payBtn, styles.confirmBtn]}
                            onPress={() => handleConfirmSettlement(name, b.memberId, b.theirPendingBillIds, b.theirPendingAmount)}
                          >
                            <MaterialCommunityIcons name="check-circle-outline" size={13} color={COLORS.white} />
                            <Text style={styles.payBtnText}>Confirm</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  // ─── Summary tab ──────────────────────────────────────────────────────────

  const renderSummaryTab = () => {
    const currency = user?.preferredCurrency;

    const chartSlices: DonutSlice[] = memberShareData
      .filter(m => m.totalShare > 0)
      .map((m, i) => ({
        value: m.totalShare,
        color: CHART_COLORS[i % CHART_COLORS.length],
        label: getMemberName(m.memberId),
      }));

    return (
      <ScrollView
        contentContainerStyle={[
          styles.tabContent,
          { paddingBottom: 80 + Math.max(insets.bottom, 12) },
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.totalGroupCard}>
          <Text style={styles.totalGroupLabel}>Total Group Spend</Text>
          <Text style={styles.totalGroupAmount}>{formatAmount(totalGroupSpend, currency)}</Text>
          <Text style={styles.totalGroupSub}>{groupBills.length} bill(s)</Text>
        </View>

        {/* Donut chart */}
        {chartSlices.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Spend Distribution</Text>
            <View style={styles.chartBody}>
              <View style={styles.chartDonutWrap}>
                <DonutChart slices={chartSlices} size={180} />
                <View style={styles.chartCenter} pointerEvents="none">
                  <Text style={styles.chartCenterLabel}>Total</Text>
                  <Text style={styles.chartCenterAmount} numberOfLines={1}>
                    {formatAmount(totalGroupSpend, currency)}
                  </Text>
                </View>
              </View>
              <View style={styles.chartLegend}>
                {chartSlices.map((s, i) => {
                  const pct =
                    totalGroupSpend > 0
                      ? ((s.value / totalGroupSpend) * 100).toFixed(1)
                      : '0';
                  return (
                    <View key={i} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                      <Text style={styles.legendName} numberOfLines={1}>
                        {s.label}
                      </Text>
                      <Text style={[styles.legendPct, { color: s.color }]}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>Per Member Breakdown</Text>

        {memberShareData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateSubtitle}>No expenses yet.</Text>
          </View>
        ) : (
          memberShareData.map((m, i) => {
            const name = getMemberName(m.memberId);
            const color = CHART_COLORS[i % CHART_COLORS.length];
            const barWidth = maxShare > 0 ? (m.totalShare / maxShare) * 100 : 0;
            const pct =
              totalGroupSpend > 0
                ? ((m.totalShare / totalGroupSpend) * 100).toFixed(1)
                : '0.0';
            const net = parseFloat((m.totalPaid - m.totalShare).toFixed(2));
            const isMe = m.memberId === user?.id;

            return (
              <View
                key={m.memberId}
                style={[styles.summaryCard, isMe && styles.summaryCardHighlight]}
              >
                <View style={styles.summaryCardHeader}>
                  <View style={[styles.avatarCircle, { backgroundColor: color }]}>
                    <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.summaryNameBlock}>
                    <Text style={styles.summaryName}>{name}</Text>
                    <Text style={styles.summaryPct}>{pct}% of group spend</Text>
                  </View>
                  <Text style={styles.summaryShareAmount}>
                    {formatAmount(m.totalShare, currency)}
                  </Text>
                </View>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barWidth}%` as any, backgroundColor: color }]} />
                </View>

                <View style={styles.summaryStatsRow}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatLabel}>Paid</Text>
                    <Text style={[styles.summaryStatValue, { color: COLORS.primary }]}>
                      {formatAmount(m.totalPaid, currency)}
                    </Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatLabel}>Share</Text>
                    <Text style={[styles.summaryStatValue, { color: COLORS.gray700 }]}>
                      {formatAmount(m.totalShare, currency)}
                    </Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatLabel}>Net</Text>
                    <Text
                      style={[
                        styles.summaryStatValue,
                        { color: net >= 0 ? COLORS.success : COLORS.danger },
                      ]}
                    >
                      {net >= 0 ? '+' : ''}
                      {formatAmount(net, currency)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ─── Loading / error states ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.navHeaderTitle}>Group Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.navHeaderTitle}>Group Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === group.createdBy;
  const sortedBills = [...groupBills].sort(
    (a, b) => (b.billDate ?? b.createdAt) - (a.billDate ?? a.createdAt)
  );

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Group Details</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Group info + members */}
      <View style={styles.groupInfoBlock}>
        <View style={styles.groupHeaderSection}>
          <View style={styles.categoryBadge}>
            <MaterialCommunityIcons
              name={getGroupCategoryIcon(group.category)}
              size={32}
              color={COLORS.white}
            />
          </View>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description && (
              <Text style={styles.groupDescription}>{group.description}</Text>
            )}
            <Text style={styles.groupStats}>
              {group.members.length} member(s) • {groupBills.length} bill(s)
            </Text>
          </View>
        </View>

        <View style={styles.membersRow}>
          {group.members.map(memberId => {
            const memberUser = memberUsers.find(u => u.id === memberId);
            const displayName = memberUser?.name || memberId.substring(0, 8);
            const isGroupOwner = group.createdBy === memberId;
            return (
              <View key={memberId} style={styles.memberTag}>
                <Text style={styles.memberText}>
                  {displayName}
                  {isGroupOwner && ' ★'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'bills' && (
        <FlatList
          data={sortedBills}
          renderItem={renderBillItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.tabContent,
            { paddingBottom: 80 + Math.max(insets.bottom, 12) },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="receipt" size={48} color={COLORS.gray300} />
              <Text style={styles.emptyStateTitle}>No bills yet</Text>
              <Text style={styles.emptyStateSubtitle}>Add a bill to get started.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        />
      )}
      {activeTab === 'settlements' && renderSettlementsTab()}
      {activeTab === 'summary' && renderSummaryTab()}

      {/* Action bar */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowCreationPicker(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Create Bill</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CreateGroup', { group })}
          >
            <MaterialCommunityIcons name="pencil" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleDeleteGroup}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      <ConfirmationModal
        visible={modal.isVisible}
        type={modal.config.type}
        title={modal.config.title}
        message={modal.config.message}
        confirmText={modal.config.confirmText}
        cancelText={modal.config.cancelText}
        showCancel={modal.config.showCancel}
        onConfirm={modal.handleConfirm}
        onCancel={modal.handleCancel}
        isLoading={modal.isLoading}
      />

      <BillCreationPickerModal
        visible={showCreationPicker}
        onSelectManual={() => {
          setShowCreationPicker(false);
          navigation.navigate('CreateBill', { groupId: group.id });
        }}
        onSelectScanReceipt={() => {
          setShowCreationPicker(false);
          navigation.navigate('AskAIBill', { mode: 'scan', groupId: group.id });
        }}
        onSelectAskAI={() => {
          setShowCreationPicker(false);
          navigation.navigate('AskAIBill', { groupId: group.id });
        }}
        onClose={() => setShowCreationPicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    padding: 4,
  },
  navHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerRight: {
    width: 32,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
  },

  // Group info
  groupInfoBlock: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  groupHeaderSection: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupHeader: {
    flex: 1,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 13,
    color: COLORS.gray600,
    marginBottom: 4,
  },
  groupStats: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  membersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  memberTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '500',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray500,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Shared tab wrapper
  tabContent: {
    flexGrow: 1,
    backgroundColor: COLORS.gray50,
    paddingTop: 12,
  },

  // Bills tab
  billCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  billCardSettled: {
    backgroundColor: COLORS.gray100,
    opacity: 0.7,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  categoryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  billTitleContainer: {
    flex: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  billTitleSettled: {
    color: COLORS.gray600,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
    flexShrink: 0,
  },
  amountOwed: {
    color: COLORS.success,
  },
  amountOwing: {
    color: COLORS.danger,
  },
  amountSettled: {
    color: COLORS.gray600,
  },
  billFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billDate: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  billDetails: {
    fontSize: 12,
    color: COLORS.gray500,
  },

  // Settlements tab
  settleSummaryRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  settleSummaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  settleSummaryLabel: {
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  settleSummaryAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  settleSummaryCount: {
    fontSize: 11,
    color: COLORS.gray400,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 6,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  balanceCardOwe: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  balanceCardOwed: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  balanceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  balanceCardInfo: {
    flex: 1,
  },
  balanceCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
  },
  balanceCardSub: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  balanceCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  balanceCardAmount: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  payBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  payBtnPending: {
    backgroundColor: COLORS.gray400,
  },
  confirmBtn: {
    backgroundColor: COLORS.success,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  undoBtnText: {
    fontSize: 11,
    color: COLORS.gray600,
    fontWeight: '600',
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  undoBannerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  undoBannerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  undoBannerBtnText: {
    fontSize: 12,
    color: COLORS.gray700,
    fontWeight: '700',
  },
  undoBannerDismiss: {
    padding: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statusBadgeWarning: {
    backgroundColor: COLORS.warning + '20',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Chart card
  chartCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 12,
    textAlign: 'center',
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chartDonutWrap: {
    position: 'relative',
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
  },
  chartCenterLabel: {
    fontSize: 10,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  chartCenterAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  chartLegend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendName: {
    flex: 1,
    fontSize: 12,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Summary tab
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray500,
    marginHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalGroupCard: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  totalGroupLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  totalGroupAmount: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: 'bold',
  },
  totalGroupSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  summaryCardHighlight: {
    borderColor: COLORS.primaryLight,
    backgroundColor: '#F5F3FF',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryNameBlock: {
    flex: 1,
    marginLeft: 10,
  },
  summaryName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  summaryPct: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 1,
  },
  summaryShareAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  barTrack: {
    height: 6,
    backgroundColor: COLORS.gray200,
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 10,
    color: COLORS.gray500,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryStatValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.gray200,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray600,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: COLORS.gray400,
    textAlign: 'center',
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.gray200,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonDanger: {
    backgroundColor: COLORS.danger,
    flex: 0,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default GroupDetailScreen;
