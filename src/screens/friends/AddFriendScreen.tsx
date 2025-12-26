import React, { useState, useCallback, useContext, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { FriendsContext } from '../../context/FriendsContext';
import { AuthContext } from '../../context/AuthContext';
import { User } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { COLORS } from '../../constants/theme';

type AddFriendScreenProps = {
  navigation: any;
};

const AddFriendScreen: React.FC<AddFriendScreenProps> = ({ navigation }) => {
  const modal = useConfirmationModal();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

  const friendsContext = useContext(FriendsContext);
  const authContext = useContext(AuthContext);

  if (!friendsContext || !authContext) {
    return null;
  }

  const { searchUsers, addFriend, areFriends } = friendsContext;
  const { user } = authContext;

  const debouncedSearch = useDebounce(searchQuery, 500);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      performSearch(debouncedSearch);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      // Filter out current user
      const filtered = results.filter(u => u.id !== user?.id);
      setSearchResults(filtered);
    } catch (err) {
      console.error('Search error:', err);
      modal.showModal({ type: 'error', title: 'Error', message: 'Failed to search users' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (friendUser: User) => {
    setAddingFriendId(friendUser.id);
    try {
      await addFriend(friendUser.id);
      modal.showModal({ type: 'success', title: 'Success', message: `${friendUser.name} has been added to your friends!` });
      navigation.goBack();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add friend';
      modal.showModal({ type: 'error', title: 'Error', message: errorMessage });
    } finally {
      setAddingFriendId(null);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isFriend = areFriends(item.id);
    const isAdding = addingFriendId === item.id;

    return (
      <View style={styles.userItem}>
        <View style={styles.userItemLeft}>
          <View style={styles.avatarPlaceholder}>
            <MaterialCommunityIcons name="account" size={24} color={COLORS.white} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
        </View>

        <View style={styles.userItemRight}>
          {isFriend ? (
            <Chip
              mode="flat"
              textStyle={styles.alreadyFriendsText}
              style={styles.alreadyFriendsChip}
            >
              Already friends
            </Chip>
          ) : isAdding ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddFriend(item)}
            >
              <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isSearching) {
      return null;
    }

    if (searchQuery.trim().length < 2) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="magnify" size={64} color={COLORS.gray400} />
          <Text style={styles.emptyTitle}>Search for friends</Text>
          <Text style={styles.emptyMessage}>
            Enter a name or email to find registered users
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="account-search" size={64} color={COLORS.gray400} />
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptyMessage}>
          Try searching with a different name or email
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friend</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          label="Search by name or email"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="e.g., John Doe or john@example.com"
          mode="outlined"
          style={styles.searchInput}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
          textColor={COLORS.black}
          left={<TextInput.Icon icon="magnify" />}
          right={
            searchQuery.length > 0 ? (
              <TextInput.Icon
                icon="close"
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              />
            ) : undefined
          }
        />
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmpty}
        />
      )}

      <ConfirmationModal
        visible={modal.isVisible}
        type={modal.config.type}
        icon={modal.config.icon}
        iconColor={modal.config.iconColor}
        title={modal.config.title}
        message={modal.config.message}
        confirmText={modal.config.confirmText}
        cancelText={modal.config.cancelText}
        onConfirm={modal.handleConfirm}
        onCancel={modal.handleCancel}
        showCancel={modal.config.showCancel}
        isLoading={modal.isLoading}
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  headerRight: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    backgroundColor: COLORS.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.gray600,
  },
  listContainer: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  userItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.gray600,
  },
  userItemRight: {
    marginLeft: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  alreadyFriendsChip: {
    backgroundColor: COLORS.success + '20',
  },
  alreadyFriendsText: {
    color: COLORS.success,
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
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
    lineHeight: 20,
  },
});

export default AddFriendScreen;
