import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GroupContext } from '../../context/GroupContext';
import { AuthContext } from '../../context/AuthContext';
import { Group, Bill, User, BillCategory } from '../../types';
import { COLORS } from '../../constants/theme';
import { supabaseApi } from '../../services/supabaseApi';
import { formatPeso } from '../../utils/formatting';
import { getBillCategoryIcon, getGroupCategoryIcon } from '../../utils/icons';

const GroupDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const groupContext = useContext(GroupContext);
  const authContext = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  const { groupId } = route.params || {};
  const [group, setGroup] = useState<Group | null>(null);
  const [groupBills, setGroupBills] = useState<Bill[]>([]);
  const [memberUsers, setMemberUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const user = authContext?.user;

  const { getGroupById, getGroupBills } = groupContext || {
    getGroupById: async () => null,
    getGroupBills: async () => [],
  };

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

      // Fetch member user data
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

  // Reload group details when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadGroupDetails();
    }, [loadGroupDetails])
  );

  const renderBillItem = ({ item }: { item: Bill }) => {
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

  const renderEmptyBills = () => (
    <View style={styles.emptyBillsContainer}>
      <Text style={styles.emptyBillsText}>No bills in this group yet</Text>
    </View>
  );

  if (isLoading) {
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
          <Text style={styles.headerTitle}>Group Details</Text>
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === group.createdBy;

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
        <Text style={styles.headerTitle}>Group Details</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={groupBills}
        renderItem={renderBillItem}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 80 + Math.max(insets.bottom, 12) }]}
        ListHeaderComponent={
          <View>
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              <View style={styles.membersList}>
                {group.members.map((memberId, index) => {
                  const memberUser = memberUsers.find(u => u.id === memberId);
                  const displayName = memberUser?.name || memberId.substring(0, 8);
                  const isOwner = group.createdBy === memberId;

                  return (
                    <View key={memberId} style={styles.memberTag}>
                      <Text style={styles.memberText}>
                        {displayName}
                        {isOwner && ' (Owner)'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {groupBills.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bills</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={groupBills.length === 0 ? renderEmptyBills : undefined}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('CreateBill', { groupId: group.id })
          }
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Create Bill</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('CreateGroup', { group })
            }
          >
            <MaterialCommunityIcons name="pencil" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
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
  listContent: {
    backgroundColor: COLORS.gray50,
  },
  groupHeaderSection: {
    backgroundColor: COLORS.white,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomColor: COLORS.gray200,
    borderBottomWidth: 1,
  },
  groupHeader: {
    flex: 1,
  },
  categoryBadge: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 13,
    color: COLORS.gray600,
    marginBottom: 6,
  },
  groupStats: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  section: {
    backgroundColor: COLORS.gray50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 12,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberTag: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  memberText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
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
    flexDirection: 'column',
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
  emptyBillsContainer: {
    backgroundColor: COLORS.white,
    padding: 32,
    alignItems: 'center',
  },
  emptyBillsText: {
    fontSize: 14,
    color: COLORS.gray600,
  },
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
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
  },
});

export default GroupDetailScreen;
