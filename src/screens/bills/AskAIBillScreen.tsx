import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { FriendsContext } from '../../context/FriendsContext';
import { supabase } from '../../services/supabase';
import { User } from '../../types';

type AskAIBillScreenProps = {
  navigation: any;
  route?: { params?: { mode?: 'scan' } };
};

const AskAIBillScreen: React.FC<AskAIBillScreenProps> = ({ navigation, route }) => {
  const authContext = useContext(AuthContext);
  const friendsContext = useContext(FriendsContext);

  const isScanMode = route?.params?.mode === 'scan';

  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [prompt, setPrompt] = useState('');
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authContext || !friendsContext) return null;

  const { user } = authContext;
  const { friends, loadFriends } = friendsContext;

  useEffect(() => {
    loadFriends();
  }, []);

  const allFriends: User[] = useMemo(() => {
    const seen = new Map<string, User>();
    friends.forEach(f => {
      if (!seen.has(f.friendId)) {
        seen.set(f.friendId, {
          id: f.friendId,
          email: f.friendEmail,
          name: f.friendName,
          createdAt: f.createdAt,
        });
      }
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [friends]);

  const filteredFriends = useMemo(() => {
    if (!friendSearch) return allFriends;
    const q = friendSearch.toLowerCase();
    return allFriends.filter(f =>
      f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
    );
  }, [allFriends, friendSearch]);

  const handlePickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const toggleFriend = (friend: User) => {
    const exists = participants.find(p => p.id === friend.id);
    if (exists) {
      setParticipants(participants.filter(p => p.id !== friend.id));
    } else {
      setParticipants([...participants, friend]);
    }
  };

  const participantNames = useMemo(() => {
    const names = ['You', ...participants.map(p => p.name)];
    return names.join(', ');
  }, [participants]);

  const canGenerate = !!receiptUri && participants.length > 0 && (isScanMode || prompt.trim().length > 0);

  const handleGenerate = async () => {
    if (!canGenerate || !user) return;

    try {
      setLoading(true);

      const ext = receiptUri!.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const imageBase64 = await FileSystem.readAsStringAsync(receiptUri!, { encoding: 'base64' });

      const allParticipants = [
        { id: user.id, name: 'You (Payer)' },
        ...participants.map(p => ({ id: p.id, name: p.name })),
      ];

      let data: any;
      let error: any;

      if (isScanMode) {
        ({ data, error } = await supabase.functions.invoke('scan-receipt', {
          body: { imageBase64, mimeType },
        }));
      } else {
        ({ data, error } = await supabase.functions.invoke('ai-create-bill', {
          body: { imageBase64, mimeType, participants: allParticipants, prompt: prompt.trim() },
        }));
      }

      if (error) {
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          detail = JSON.stringify(body);
        } catch {
          try { detail = await (error as any).context?.text?.() ?? error.message; } catch {}
        }
        throw new Error(`[${(error as any).status ?? '?'}] ${detail}`);
      }
      if (!data) throw new Error('No response from AI');

      // For scan mode, assign all items to all participants equally before review
      if (isScanMode && data.items) {
        const participantIds = allParticipants.map((p: any) => p.id);
        data = {
          ...data,
          items: data.items.map((item: any) => ({
            ...item,
            assignedTo: participantIds,
            splitMethod: 'equal',
          })),
        };
      }

      navigation.navigate('AIBillReview', {
        billData: data,
        participants: allParticipants,
        imageUrl: receiptUri,
      });
    } catch (err: any) {
      Alert.alert(
        'Generation Failed',
        err?.message || 'Could not generate bill. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const step1Done = !!receiptUri;
  const step2Done = participants.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isScanMode ? 'Scan Receipt' : 'Ask AI to Create Bill'}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Step 1: Upload Receipt */}
        <View style={styles.section}>
          <View style={styles.stepLabel}>
            <View style={[styles.stepBadge, step1Done && styles.stepBadgeDone]}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.sectionTitle}>Upload Receipt</Text>
          </View>

          <TouchableOpacity style={styles.uploadBox} onPress={handlePickReceipt}>
            {receiptUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: receiptUri }} style={styles.receiptPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickReceipt}>
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <MaterialCommunityIcons name="camera-plus" size={32} color={COLORS.gray400} />
                <Text style={styles.uploadText}>Tap to upload receipt</Text>
                <Text style={styles.uploadSubtext}>JPG or PNG</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Step 2: Participants */}
        <View style={[styles.section, !step1Done && styles.sectionDisabled]}>
          <View style={styles.stepLabel}>
            <View style={[styles.stepBadge, step2Done && styles.stepBadgeDone]}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.sectionTitle}>Who's included?</Text>
          </View>

          {step1Done && (
            <>
              <TouchableOpacity
                style={styles.addPeopleBtn}
                onPress={() => setShowFriendPicker(true)}
              >
                <MaterialCommunityIcons name="plus" size={18} color={COLORS.primary} />
                <Text style={styles.addPeopleBtnText}>Add People</Text>
              </TouchableOpacity>

              <View style={styles.participantsList}>
                <View style={styles.participantChip}>
                  <MaterialCommunityIcons name="wallet" size={14} color={COLORS.primary} />
                  <Text style={styles.participantChipText}>You (Payer)</Text>
                </View>
                {participants.map(p => (
                  <View key={p.id} style={styles.participantChip}>
                    <MaterialCommunityIcons name="account" size={14} color={COLORS.white} />
                    <Text style={styles.participantChipText}>{p.name}</Text>
                    <TouchableOpacity onPress={() => setParticipants(prev => prev.filter(x => x.id !== p.id))}>
                      <MaterialCommunityIcons name="close" size={14} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <Text style={styles.hintText}>
                You (payer) are always included automatically
              </Text>
            </>
          )}
        </View>

        {/* Step 3: Prompt (AI mode only) */}
        {!isScanMode && (
          <View style={[styles.section, (!step1Done || !step2Done) && styles.sectionDisabled]}>
            <View style={styles.stepLabel}>
              <View style={[styles.stepBadge, (prompt.trim().length > 0) && styles.stepBadgeDone]}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={styles.sectionTitle}>How should this be split?</Text>
            </View>

            {step1Done && step2Done && (
              <>
                <TextInput
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder="e.g. John pays for the burger. Sarah and Mike split the pizza equally. Everyone splits the drinks."
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  style={styles.promptInput}
                  outlineColor={COLORS.gray300}
                  activeOutlineColor={COLORS.primary}
                  textColor={COLORS.black}
                />
                <View style={styles.namesHint}>
                  <MaterialCommunityIcons name="information-outline" size={14} color={COLORS.gray500} />
                  <Text style={styles.namesHintText}>
                    Use these names: {participantNames}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Generate button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.generateButton, (!canGenerate || loading) && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={!canGenerate || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialCommunityIcons name={isScanMode ? 'line-scan' : 'robot'} size={20} color={COLORS.white} />
                <Text style={styles.generateButtonText}>{isScanMode ? 'Scan Receipt' : 'Generate Bill'}</Text>
              </>
            )}
          </TouchableOpacity>
          {loading && (
            <Text style={styles.loadingText}>{isScanMode ? 'Scanning receipt...' : 'AI is creating your bill...'}</Text>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Friend Picker Modal */}
      {showFriendPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add People</Text>
              <TouchableOpacity onPress={() => { setShowFriendPicker(false); setFriendSearch(''); }}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={friendSearch}
              onChangeText={setFriendSearch}
              placeholder="Search friends..."
              mode="outlined"
              style={styles.searchInput}
              outlineColor={COLORS.gray300}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.black}
              left={<TextInput.Icon icon="magnify" />}
              dense
            />
            <ScrollView style={styles.friendList}>
              {filteredFriends.map(f => {
                const isSelected = participants.some(p => p.id === f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.friendRow, isSelected && styles.friendRowSelected]}
                    onPress={() => toggleFriend(f)}
                  >
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>{f.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Text style={styles.friendEmail}>{f.email}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.success} />
                    )}
                  </TouchableOpacity>
                );
              })}
              {filteredFriends.length === 0 && (
                <Text style={styles.noFriendsText}>No friends found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  stepLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    backgroundColor: COLORS.success,
  },
  stepBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.black,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.md,
    borderStyle: 'dashed',
    minHeight: 140,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    flex: 1,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  uploadText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray400,
  },
  previewContainer: {
    position: 'relative',
  },
  receiptPreview: {
    width: '100%',
    height: 200,
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  changePhotoText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  addPeopleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  addPeopleBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  participantChipText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  hintText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    fontStyle: 'italic',
  },
  promptInput: {
    backgroundColor: COLORS.white,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.sm,
  },
  namesHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  namesHintText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    lineHeight: 18,
  },
  buttonContainer: {
    margin: SPACING.lg,
    alignItems: 'center',
  },
  generateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  generateButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
    fontStyle: 'italic',
  },
  // Friend picker overlay
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    padding: SPACING.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pickerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.black,
  },
  pickerDone: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  friendList: {
    maxHeight: 300,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    gap: SPACING.md,
  },
  friendRowSelected: {
    backgroundColor: '#EEF2FF',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight || COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
  },
  friendEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
  },
  noFriendsText: {
    textAlign: 'center',
    color: COLORS.gray500,
    paddingVertical: SPACING.xl,
    fontSize: FONT_SIZES.sm,
  },
});

export default AskAIBillScreen;
