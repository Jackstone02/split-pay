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
import { AuthContext } from '../../context/AuthContext';
import { BillContext } from '../../context/BillContext';
import { Bill, UserBillsSummary } from '../../types';

type DashboardScreenProps = {
  navigation: any;
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);
  const [summary, setSummary] = useState<UserBillsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (!authContext || !billContext) {
    return null;
  }

  const { user, sign } = authContext;
  const { bills, loadUserBills, getSummary, isLoading } = billContext;

  const loadSummary = useCallback(async () => {
    if (user) {
      const summary = await getSummary(user.id);
      setSummary(summary);
    }
  }, [user, getSummary]);

  const loadData = useCallback(async () => {
    if (user) {
      await loadUserBills(user.id);
      await loadSummary();
    }
  }, [user, loadUserBills, loadSummary]);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    sign.signOut();
  };

  const renderBillCard = ({ item }: { item: Bill }) => {
    const userSplit = item.splits.find(s => s.userId === user?.id);
    const isPayer = item.paidBy === user?.id;
    const amount = userSplit?.amount || 0;

    return (
      <TouchableOpacity
        style={styles.billCard}
        onPress={() => navigation.push('BillDetail', { billId: item.id })}
      >
        <View style={styles.billHeader}>
          <Text style={styles.billTitle}>{item.title}</Text>
          <Text style={[styles.billAmount, isPayer ? styles.amountOwed : styles.amountOwing]}>
            {isPayer ? '+' : '-'}₱{amount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.billFooter}>
          <Text style={styles.billDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.billDetails}>
            {item.participants.length} participants
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
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Owed</Text>
            <Text style={[styles.summaryAmount, styles.owedColor]}>
              +₱{summary.totalOwed.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Owing</Text>
            <Text style={[styles.summaryAmount, styles.owingColor]}>
              -₱{summary.totalOwing.toFixed(2)}
            </Text>
          </View>
          <View style={[styles.summaryCard]}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text
              style={[
                styles.summaryAmount,
                summary.balance > 0 ? styles.balancePositive : styles.balanceNegative,
              ]}
            >
              ₱{Math.abs(summary.balance).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.billsSection}>
        <Text style={styles.sectionTitle}>Recent Bills</Text>
        <FlatList
          data={bills}
          renderItem={renderBillCard}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          ListEmptyComponent={emptyListMessage}
          contentContainerStyle={bills.length === 0 ? styles.emptyListContainer : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>

      <FAB
        icon="plus"
        label="New Bill"
        style={styles.fab}
        onPress={() => navigation.push('CreateBill', {})}
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
    fontSize: FONT_SIZES.lg,
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
    paddingVertical: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.lg,
  },
  billCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  billTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.black,
    flex: 1,
  },
  billAmount: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginLeft: SPACING.md,
  },
  amountOwed: {
    color: COLORS.success,
  },
  amountOwing: {
    color: COLORS.danger,
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
    backgroundColor: COLORS.primary,
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
  },
});

export default DashboardScreen;
