import React, { useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { FriendsContext } from '../../context/FriendsContext';
import { FriendWithBalance } from '../../types';
import { COLORS } from '../../constants/theme';

type FriendsScreenProps = {
  navigation: any;
};

const FriendsScreen: React.FC<FriendsScreenProps> = ({ navigation }) => {
  const friendsContext = useContext(FriendsContext);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!friendsContext) {
    return null;
  }

  const { friendsWithBalances, isLoading, error, loadFriends, removeFriend } = friendsContext;

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFriends();
    setIsRefreshing(false);
  }, [loadFriends]);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [loadFriends])
  );

  const handleRemoveFriend = (friend: FriendWithBalance) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.friendName} from your friends?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friend.id);
            } catch (err) {
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const getBalanceColor = (balance: number): string => {
    if (balance > 0) return COLORS.success; // They owe you
    if (balance < 0) return COLORS.danger; // You owe them
    return COLORS.gray600; // No balance
  };

  const getBalanceLabel = (balance: number): string => {
    if (balance > 0) return `owes you ₱${Math.abs(balance).toFixed(2)}`;
    if (balance < 0) return `you owe ₱${Math.abs(balance).toFixed(2)}`;
    return 'settled';
  };

  const renderFriendItem = ({ item }: { item: FriendWithBalance }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.friendName}</Text>
        <Text style={styles.friendEmail}>{item.friendEmail}</Text>
        <Text style={styles.billCount}>{item.billCount} bill(s)</Text>
      </View>
      <View style={styles.rightContainer}>
        <View style={styles.balanceContainer}>
          <Text style={[styles.balanceAmount, { color: getBalanceColor(item.balance) }]}>
            ₹{Math.abs(item.balance).toFixed(2)}
          </Text>
          <Text style={[styles.balanceLabel, { color: getBalanceColor(item.balance) }]}>
            {getBalanceLabel(item.balance)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFriend(item)}
        >
          <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-multiple-outline" size={64} color={COLORS.gray400} />
      <Text style={styles.emptyTitle}>No friends yet!</Text>
      <Text style={styles.emptyMessage}>Tap the + button below to add friends</Text>
    </View>
  );

  if (isLoading && friendsWithBalances.length === 0) {
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
        <Text style={styles.headerTitle}>Friends</Text>
      </View>
      <FlatList
        data={friendsWithBalances}
        renderItem={renderFriendItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddFriend')}
        label="Add Friend"
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
  listContent: {
    padding: 12,
    flexGrow: 1,
  },
  friendCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 12,
    color: COLORS.gray600,
    marginBottom: 4,
  },
  billCount: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    padding: 12,
    margin: 12,
    borderRadius: 6,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: COLORS.primary,
  },
});

export default FriendsScreen;
