import React, { useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../../context/AuthContext';
import { mockApi } from '../../services/mockApi';
import { Activity, ActivityType } from '../../types';
import { COLORS } from '../../constants/theme';
import SlotGame from '../../components/SlotGame';

const ActivityScreen = () => {
  const authContext = useContext(AuthContext);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const user = authContext?.user;

  const loadActivities = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const userActivities = await mockApi.getUserActivities(user.id, 50);
      setActivities(userActivities);
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadActivities();
    setIsRefreshing(false);
  }, [loadActivities]);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities])
  );

  const getActivityIcon = (type: ActivityType): { icon: string; color: string } => {
    switch (type) {
      case 'bill_created':
        return { icon: 'file-plus', color: COLORS.success };
      case 'bill_updated':
        return { icon: 'file-edit', color: COLORS.primary };
      case 'bill_deleted':
        return { icon: 'file-remove', color: COLORS.danger };
      case 'payment_made':
        return { icon: 'cash-check', color: COLORS.success };
      case 'payment_requested':
        return { icon: 'cash-multiple', color: COLORS.warning };
      case 'group_created':
        return { icon: 'folder-plus', color: COLORS.success };
      case 'group_updated':
        return { icon: 'folder-edit', color: COLORS.primary };
      case 'member_added':
        return { icon: 'account-plus', color: COLORS.success };
      case 'member_removed':
        return { icon: 'account-minus', color: COLORS.danger };
      default:
        return { icon: 'bell', color: COLORS.gray600 };
    }
  };

  const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const groupActivitiesByDate = (activities: Activity[]): { [key: string]: Activity[] } => {
    const grouped: { [key: string]: Activity[] } = {};

    activities.forEach(activity => {
      const date = new Date(activity.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey: string;

      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        groupKey = 'Today';
      } else if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        groupKey = 'Yesterday';
      } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
        groupKey = 'This Week';
      } else {
        groupKey = 'Earlier';
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(activity);
    });

    return grouped;
  };

  const renderActivityItem = ({ item }: { item: Activity }) => {
    const { icon, color } = getActivityIcon(item.type);

    return (
      <View style={styles.activityItem}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityDescription}>{item.description}</Text>
          <Text style={styles.activityTime}>{getRelativeTime(item.createdAt)}</Text>
        </View>
        {item.amount && (
          <Text style={styles.activityAmount}>
            ₱{Math.abs(item.amount).toFixed(2)}
          </Text>
        )}
      </View>
    );
  };

  const renderActivityGroup = (groupKey: string, items: Activity[]) => (
    <View key={groupKey}>
      <Text style={styles.dateGroupLabel}>{groupKey}</Text>
      {items.map((item, index) => (
        <View key={item.id || index}>
          {renderActivityItem({ item } as any)}
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="history"
        size={64}
        color={COLORS.gray300}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>No activity yet</Text>
      <Text style={styles.emptyMessage}>Create bills and manage groups to see activity</Text>
    </View>
  );

  if (isLoading && activities.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const groupedActivities = groupActivitiesByDate(activities);
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        <SlotGame onWin={(amount) => console.log('Won:', amount)} />

        {activities.length === 0 ? (
          renderEmpty()
        ) : (
          <View style={styles.listContent}>
            {groupOrder
              .filter(group => groupedActivities[group])
              .map(groupKey => renderActivityGroup(groupKey, groupedActivities[groupKey]))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.gray200,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  emptyWrapper: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  dateGroupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.gray100,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 4,
  },
  activityItem: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.gray600,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});

export default ActivityScreen;
