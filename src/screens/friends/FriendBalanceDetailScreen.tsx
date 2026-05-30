import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../../context/AuthContext';
import { BillBreakdownItem, BillCategory } from '../../types';
import { COLORS, SPACING } from '../../constants/theme';
import { formatAmount } from '../../utils/formatting';
import { getBillCategoryIcon } from '../../utils/icons';

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
  const { friendName, friendEmail, friendAvatarUrl, balance, billBreakdown } = params;

  const authContext = useContext(AuthContext);
  const user = authContext?.user;

  const balanceColor = balance > 0 ? COLORS.success : COLORS.danger;
  const balanceSummary =
    balance > 0
      ? `${friendName} owes you`
      : `You owe ${friendName}`;

  const formatDate = (epoch?: number): string => {
    if (!epoch) return '';
    return new Date(epoch).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Contributing Bills</Text>
        <Text style={styles.sectionCount}>{billBreakdown.length} bill(s)</Text>
      </View>

      <FlatList
        data={billBreakdown}
        renderItem={renderBillItem}
        keyExtractor={item => item.billId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
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
    margin: 16,
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
    paddingHorizontal: 16,
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
});

export default FriendBalanceDetailScreen;
