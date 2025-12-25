import React, { useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../../context/AuthContext';
import { GroupContext } from '../../context/GroupContext';
import { Group } from '../../types';
import { COLORS } from '../../constants/theme';

const GroupsScreen = () => {
  const authContext = useContext(AuthContext);
  const groupContext = useContext(GroupContext);
  const navigation = useNavigation<any>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const user = authContext?.user;
  const { groups, isLoading, loadUserGroups } = groupContext || {
    groups: [],
    isLoading: false,
    loadUserGroups: async () => {},
  };

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    await loadUserGroups(user.id);
    setIsRefreshing(false);
  }, [user, loadUserGroups]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadUserGroups(user.id);
      }
    }, [user, loadUserGroups])
  );

  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case 'trip':
        return COLORS.primary;
      case 'roommates':
        return COLORS.secondary;
      case 'event':
        return COLORS.warning;
      case 'other':
      default:
        return COLORS.gray600;
    }
  };

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

  const renderGroupCard = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
    >
      <View style={styles.categoryBadge}>
        <MaterialCommunityIcons
          name={getCategoryIcon(item.category)}
          size={20}
          color={COLORS.white}
        />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <View style={styles.groupStats}>
          <Text style={styles.statText}>
            <MaterialCommunityIcons name="account-multiple" size={12} /> {item.members.length} member(s)
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={COLORS.gray400}
      />
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="folder-open-outline"
        size={64}
        color={COLORS.gray300}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptyMessage}>Create a group to organize your bills</Text>
    </View>
  );

  if (isLoading && groups.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateGroup', {})}
        >
          <MaterialCommunityIcons name="plus" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
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
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  listContent: {
    padding: 12,
    flexGrow: 1,
  },
  groupCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryBadge: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 12,
    color: COLORS.gray600,
    marginBottom: 6,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: COLORS.gray600,
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

export default GroupsScreen;
