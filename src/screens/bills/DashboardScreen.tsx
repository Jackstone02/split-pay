import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import DatePickerModal from '../../components/DatePickerModal';
import { AuthContext } from '../../context/AuthContext';
import { BillContext } from '../../context/BillContext';
import { GroupContext } from '../../context/GroupContext';
import { Bill, UserBillsSummary, BillCategory } from '../../types';
import { formatPeso } from '../../utils/formatting';
import { getBillCategoryIcon } from '../../utils/icons';
import { isTablet as checkIsTablet } from '../../utils/deviceUtils';

type DashboardScreenProps = {
  navigation: any;
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);
  const groupContext = useContext(GroupContext);
  const [summary, setSummary] = useState<UserBillsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterFromDate, setFilterFromDate] = useState<Date | null>(null);
  const [filterToDate, setFilterToDate] = useState<Date | null>(null);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  // Detect if device is a tablet (iPad)
  const isTablet = checkIsTablet();

  if (!authContext || !billContext || !groupContext) {
    return null;
  }

  const { user, sign } = authContext;
  const { bills, loadUserBills, getSummary, isLoading } = billContext;
  const { groups, loadUserGroups } = groupContext;

  const loadSummary = useCallback(async () => {
    if (user?.id) {
      const summary = await getSummary(user.id);
      setSummary(summary);
    }
  }, [user?.id, getSummary]);

  const loadData = useCallback(async () => {
    if (user?.id) {
      await Promise.all([
        loadUserBills(user.id),
        loadUserGroups(user.id),
        loadSummary()
      ]);
    }
  }, [user?.id, loadUserBills, loadUserGroups, loadSummary]);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayCount(10); // Reset to show only 10 bills
    await loadData();
    setRefreshing(false);
  };

  const loadMore = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setDisplayCount(prev => prev + 10);
    setIsLoadingMore(false);
  }, [isLoadingMore]);

  const handleLogout = () => {
    sign.signOut();
  };

  const getSortedAndFilteredBills = () => {
    let filtered = [...bills];

    // Apply date filter
    if (filterFromDate || filterToDate) {
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);

        if (filterFromDate) {
          const fromDateStart = new Date(filterFromDate);
          fromDateStart.setHours(0, 0, 0, 0);
          if (billDate < fromDateStart) return false;
        }

        if (filterToDate) {
          const toDateEnd = new Date(filterToDate);
          toDateEnd.setHours(23, 59, 59, 999);
          if (billDate > toDateEnd) return false;
        }

        return true;
      });
    }

    // Sort by date descending (newest first)
    return filtered.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const clearDateFilter = () => {
    setFilterFromDate(null);
    setFilterToDate(null);
    setDisplayCount(10);
  };

  const handleFromDateSelect = (date: Date) => {
    setFilterFromDate(date);
  };

  const handleToDateSelect = (date: Date) => {
    setFilterToDate(date);
  };

  const renderBillCard = ({ item }: { item: Bill }) => {
    const userSplit = item.splits.find(s => s.userId === user?.id);
    const isPayer = item.paidBy === user?.id;

    // Calculate unsettled amount
    let amount = 0;
    if (isPayer) {
      // Sum all unsettled splits for participants
      amount = item.splits
        .filter(s => s.userId !== user?.id && !s.settled)
        .reduce((sum, s) => sum + s.amount, 0);
    } else {
      // User's own split (if not settled)
      amount = (userSplit && !userSplit.settled) ? userSplit.amount : 0;
    }

    const isFullySettled = isPayer
      ? item.splits.filter(s => s.userId !== user?.id).every(s => s.settled)
      : userSplit?.settled;

    // Get group name if bill is part of a group
    const group = item.groupId ? groups.find(g => g.id === item.groupId) : null;

    return (
      <TouchableOpacity
        style={[styles.billCard, isFullySettled && styles.billCardSettled]}
        onPress={() => navigation.push('BillDetail', { billId: item.id })}
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
            {group && (
              <Text style={styles.groupBadge}>
                {group.name}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.billAmount,
              isPayer ? styles.amountOwed : styles.amountOwing,
              isFullySettled && styles.amountSettled
            ]}
            numberOfLines={1}
          >
            {formatPeso(isPayer ? amount : -amount, true)}
          </Text>
        </View>
        <View style={styles.billFooter}>
          <Text style={styles.billDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.billDetails}>
            {item.participants.length} participants
            {isFullySettled && ' • Settled'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const emptyListMessage = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.gray400} />
      <Text style={styles.emptyText}>No bills yet</Text>
      <Text style={styles.emptySubtext}>Create your first bill to get started</Text>
    </View>
  );

  // Calculate displayed bills and hasMore status
  const sortedAndFilteredBills = getSortedAndFilteredBills();
  const displayedBills = sortedAndFilteredBills.slice(0, displayCount);
  const hasMore = sortedAndFilteredBills.length > displayCount;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name}</Text>
          <Text style={styles.subtext}>Manage your expenses</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.push('Profile')}
        >
          <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={[styles.summaryContainer, isTablet && styles.summaryContainerTablet]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Owed</Text>
            <Text style={[styles.summaryAmount, styles.owedColor, isTablet && styles.summaryAmountTablet]}>
              {formatPeso(summary.totalOwed, true)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Owing</Text>
            <Text style={[styles.summaryAmount, styles.owingColor, isTablet && styles.summaryAmountTablet]}>
              {formatPeso(-summary.totalOwing, true)}
            </Text>
          </View>
          <View style={[styles.summaryCard]}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text
              style={[
                styles.summaryAmount,
                summary.balance > 0 ? styles.balancePositive : styles.balanceNegative,
                isTablet && styles.summaryAmountTablet
              ]}
            >
              {formatPeso(Math.abs(summary.balance))}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.billsSection}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          <TouchableOpacity
            onPress={() => setShowDateFilter(!showDateFilter)}
            style={[
              styles.filterButton,
              (filterFromDate || filterToDate) && styles.filterButtonActive
            ]}
          >
            <MaterialCommunityIcons
              name="filter"
              size={20}
              color={(filterFromDate || filterToDate) ? COLORS.primary : COLORS.gray600}
            />
          </TouchableOpacity>
        </View>

        {showDateFilter && (
          <View style={styles.filterContainer}>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowFromDatePicker(true)}
              >
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>
                  {filterFromDate ? filterFromDate.toLocaleDateString() : 'Select'}
                </Text>
              </TouchableOpacity>

              <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.gray400} />

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowToDatePicker(true)}
              >
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>
                  {filterToDate ? filterToDate.toLocaleDateString() : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>

            {(filterFromDate || filterToDate) && (
              <TouchableOpacity onPress={clearDateFilter}>
                <Text style={styles.clearFilterText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* From Date Picker Modal */}
        <DatePickerModal
          visible={showFromDatePicker}
          onClose={() => setShowFromDatePicker(false)}
          onSelect={handleFromDateSelect}
          selectedDate={filterFromDate || undefined}
          maximumDate={filterToDate || new Date()}
          title="Select From Date"
        />

        {/* To Date Picker Modal */}
        <DatePickerModal
          visible={showToDatePicker}
          onClose={() => setShowToDatePicker(false)}
          onSelect={handleToDateSelect}
          selectedDate={filterToDate || undefined}
          minimumDate={filterFromDate || undefined}
          maximumDate={new Date()}
          title="Select To Date"
        />

        <ScrollView
          style={styles.billsScrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {sortedAndFilteredBills.length === 0 ? (
            emptyListMessage()
          ) : (
            <>
              {displayedBills.map((bill) => (
                <View key={bill.id}>
                  {renderBillCard({ item: bill })}
                </View>
              ))}

              {/* Show more button */}
              {hasMore && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <MaterialCommunityIcons name="loading" size={20} color={COLORS.primary} />
                  ) : (
                    <>
                      <Text style={styles.showMoreText}>Show more</Text>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={20}
                        color={COLORS.primary}
                      />
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* End of bills message */}
              {!hasMore && sortedAndFilteredBills.length > 10 && (
                <View style={styles.endMessage}>
                  <Text style={styles.endMessageText}>No more bills</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.push('CreateBill', {})}
        label="New Bill"
        color={COLORS.white}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  greeting: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  subtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  profileButton: {
    padding: SPACING.md,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  summaryAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  owedColor: {
    color: COLORS.success,
  },
  owingColor: {
    color: COLORS.danger,
  },
  balancePositive: {
    color: COLORS.success,
  },
  balanceNegative: {
    color: COLORS.danger,
  },
  billsSection: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  sectionTitleContainer: {
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
  filterButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.gray100,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary + '20',
  },
  filterContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  dateButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  dateLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
    fontWeight: '500',
  },
  clearFilterText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.danger,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  billsScrollView: {
    flex: 1,
    paddingBottom: 80, // Extra padding for FAB
  },
  billCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
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
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  categoryIconBadge: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  billTitleContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  billTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  groupBadge: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginTop: SPACING.xs / 2,
    fontWeight: '600',
  },
  billTitleSettled: {
    color: COLORS.gray600,
  },
  billAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginLeft: SPACING.md,
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
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
  },
  billDetails: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.gray600,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
    marginTop: SPACING.sm,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  showMoreText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: SPACING.sm,
  },
  endMessage: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginTop: SPACING.sm,
  },
  endMessageText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    fontStyle: 'italic',
  },
  summaryContainerTablet: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
  },
  summaryAmountTablet: {
    fontSize: FONT_SIZES.xl,
  },
});

export default DashboardScreen;
