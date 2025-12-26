import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GroupContext } from '../../context/GroupContext';
import { AuthContext } from '../../context/AuthContext';
import { Group, Bill } from '../../types';
import { COLORS } from '../../constants/theme';

const GroupDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const groupContext = useContext(GroupContext);
  const authContext = useContext(AuthContext);

  const { groupId } = route.params || {};
  const [group, setGroup] = useState<Group | null>(null);
  const [groupBills, setGroupBills] = useState<Bill[]>([]);
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

  useEffect(() => {
    loadGroupDetails();
  }, [loadGroupDetails]);

  const getCategoryIcon = (category?: string): string => {
    switch (category) {
      case 'trip':
        return 'airplane';
      case 'roommates':
        return 'home';
      case 'event':
        return 'party-popper';
      case 'other':
      default:
        return 'folder-account';
    }
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <TouchableOpacity
      style={styles.billItem}
      onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
    >
      <View>
        <Text style={styles.billTitle}>{item.title}</Text>
        <Text style={styles.billAmount}>₱{item.totalAmount.toFixed(2)}</Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={COLORS.gray400}
      />
    </TouchableOpacity>
  );

  const renderEmptyBills = () => (
    <View style={styles.emptyBillsContainer}>
      <Text style={styles.emptyBillsText}>No bills in this group yet</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Group not found</Text>
      </View>
    );
  }

  const isOwner = user?.id === group.createdBy;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={groupBills}
        renderItem={renderBillItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.categoryBadge}>
                <MaterialCommunityIcons
                  name={getCategoryIcon(group.category)}
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
                {group.members.map((memberId, index) => (
                  <View key={memberId} style={styles.memberTag}>
                    <Text style={styles.memberText}>{memberId}</Text>
                  </View>
                ))}
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
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />

      <View style={styles.actionBar}>
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
          <TouchableOpacity style={styles.actionButton}>
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
    backgroundColor: COLORS.gray50,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  listContent: {
    paddingBottom: 80,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomColor: COLORS.gray200,
    borderBottomWidth: 1,
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
  groupHeader: {
    flex: 1,
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
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  billItem: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: COLORS.gray100,
    borderBottomWidth: 1,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 4,
  },
  billAmount: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
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
    padding: 12,
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
