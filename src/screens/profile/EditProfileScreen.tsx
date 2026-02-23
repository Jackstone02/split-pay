import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TextInput, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { PaymentMethod, SUPPORTED_CURRENCIES } from '../../types';
import { supabaseApi } from '../../services/supabaseApi';
import { supabase } from '../../services/supabase';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';

type EditProfileScreenProps = {
  navigation: any;
};

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const modal = useConfirmationModal();
  const authContext = useContext(AuthContext);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [preferredCurrency, setPreferredCurrency] = useState('PHP');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!authContext) {
    return null;
  }

  const { user, updateProfile } = authContext;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
      setPaymentMethod(user.paymentMethod || null);
      setPreferredCurrency(user.preferredCurrency || 'PHP');
    }
  }, [user]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      modal.showModal({ type: 'error', title: 'Permission Required', message: 'Please allow access to your photo library to change your profile picture.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Name is required' });
      return;
    }

    // For gcash/paymaya, phone is required. bank_transfer needs no phone.
    if ((paymentMethod === 'gcash' || paymentMethod === 'paymaya') && !phone) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please provide a phone number for GCash or Maya payments' });
      return;
    }

    if (phone && phone.length < 10) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please enter a valid phone number' });
      return;
    }

    try {
      setIsSaving(true);

      let finalAvatarUrl = user?.avatarUrl;
      if (avatarUri && user) {
        const ext = avatarUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const storagePath = `${user.id}/avatar.${ext}`;

        const base64 = await FileSystem.readAsStringAsync(avatarUri, { encoding: 'base64' });
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(storagePath, bytes, { contentType, upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
        finalAvatarUrl = urlData.publicUrl;
      }

      await updateProfile({
        name: name.trim(),
        phone: phone || undefined,
        paymentMethod: paymentMethod || undefined,
        preferredCurrency,
        avatarUrl: finalAvatarUrl,
      });

      modal.showModal({
        type: 'success',
        title: 'Success',
        message: 'Profile updated successfully',
        onConfirm: () => navigation.goBack(),
      });
    } catch (err) {
      modal.showModal({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const currentCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === preferredCurrency);
  const avatarSource = avatarUri || user?.avatarUrl;
  const paymentLabel = paymentMethod === 'gcash' ? 'GCash' : paymentMethod === 'paymaya' ? 'Maya' : paymentMethod === 'bank_transfer' ? 'Bank Transfer' : '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={isSaving} style={styles.avatarWrapper}>
            {avatarSource ? (
              <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons name="account" size={48} color={COLORS.white} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialCommunityIcons name="camera" size={14} color={COLORS.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="John Doe"
            placeholderTextColor={COLORS.gray400}
            textColor={COLORS.black}
            mode="outlined"
            editable={!isSaving}
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            left={<TextInput.Icon icon="account" />}
          />

          <View style={styles.disabledField}>
            <MaterialCommunityIcons name="email" size={20} color={COLORS.gray600} />
            <View style={styles.disabledFieldContent}>
              <Text style={styles.disabledFieldLabel}>Email</Text>
              <Text style={styles.disabledFieldValue}>{user?.email}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Cannot be changed</Text>
            </View>
          </View>
        </View>

        {/* Currency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <Text style={styles.sectionSubtext}>Used as the default currency across the app</Text>
          <TouchableOpacity
            style={styles.currencySelector}
            onPress={() => setShowCurrencyPicker(true)}
            disabled={isSaving}
          >
            <Text style={styles.currencySelectorText}>
              {currentCurrency ? `${currentCurrency.symbol}  ${currentCurrency.code} — ${currentCurrency.name}` : preferredCurrency}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.gray600} />
          </TouchableOpacity>
        </View>

        {/* Payment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <Text style={styles.sectionSubtext}>
            This information will be shown to friends when they need to pay you
          </Text>

          <TextInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="09123456789"
            placeholderTextColor={COLORS.gray400}
            textColor={COLORS.black}
            mode="outlined"
            editable={!isSaving}
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone" />}
          />

          <Text style={styles.inputLabel}>Payment Method</Text>
          <SegmentedButtons
            value={paymentMethod || ''}
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            buttons={[
              { value: 'gcash', label: 'GCash', icon: 'wallet', disabled: isSaving },
              { value: 'paymaya', label: 'Maya', icon: 'credit-card', disabled: isSaving },
              { value: 'bank_transfer', label: 'Bank', icon: 'bank', disabled: isSaving },
            ]}
            style={styles.segmentedButtons}
          />

          {paymentMethod && (
            <View style={styles.previewContainer}>
              <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
              <View style={styles.previewContent}>
                <Text style={styles.previewLabel}>Payment Preview</Text>
                <Text style={styles.previewText}>
                  {paymentMethod === 'bank_transfer'
                    ? 'Friends will see: Bank Transfer'
                    : `Friends will see: ${paymentLabel}${phone ? ` - ${phone}` : ''}`}
                </Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={() => setShowCurrencyPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCurrencyPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={SUPPORTED_CURRENCIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.currencyItem, preferredCurrency === item.code && styles.currencyItemActive]}
                onPress={() => { setPreferredCurrency(item.code); setShowCurrencyPicker(false); }}
              >
                <Text style={styles.currencyItemSymbol}>{item.symbol}</Text>
                <View style={styles.currencyItemInfo}>
                  <Text style={styles.currencyItemCode}>{item.code}</Text>
                  <Text style={styles.currencyItemName}>{item.name}</Text>
                </View>
                {preferredCurrency === item.code && (
                  <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.black },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: SPACING.xl },
  avatarWrapper: { position: 'relative' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarHint: { marginTop: SPACING.sm, fontSize: FONT_SIZES.sm, color: COLORS.gray600 },

  // Sections
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.black, marginBottom: SPACING.sm },
  sectionSubtext: { fontSize: FONT_SIZES.sm, color: COLORS.gray600, marginBottom: SPACING.lg },
  input: { marginBottom: SPACING.lg, backgroundColor: COLORS.white },
  inputLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gray700, marginBottom: SPACING.sm },
  segmentedButtons: { marginBottom: SPACING.lg },

  // Currency selector
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  currencySelectorText: { fontSize: FONT_SIZES.md, color: COLORS.black },

  // Disabled email field
  disabledField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  disabledFieldContent: { marginLeft: SPACING.md, flex: 1 },
  disabledFieldLabel: { fontSize: FONT_SIZES.xs, color: COLORS.gray600, fontWeight: '600', textTransform: 'uppercase' },
  disabledFieldValue: { fontSize: FONT_SIZES.md, color: COLORS.gray700, marginTop: SPACING.xs },
  badge: { backgroundColor: COLORS.warning, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
  badgeText: { fontSize: FONT_SIZES.xs, color: COLORS.white, fontWeight: '600' },

  // Payment preview
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  previewContent: { marginLeft: SPACING.sm, flex: 1 },
  previewLabel: { fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: '600', textTransform: 'uppercase', marginBottom: SPACING.xs },
  previewText: { fontSize: FONT_SIZES.sm, color: COLORS.gray700 },

  // Save button
  saveButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.white, fontSize: FONT_SIZES.lg, fontWeight: 'bold' },

  // Currency modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingBottom: SPACING.xl,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.black },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  currencyItemActive: { backgroundColor: COLORS.primary + '10' },
  currencyItemSymbol: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.primary, width: 36 },
  currencyItemInfo: { flex: 1, marginLeft: SPACING.md },
  currencyItemCode: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.black },
  currencyItemName: { fontSize: FONT_SIZES.sm, color: COLORS.gray600 },
});

export default EditProfileScreen;
