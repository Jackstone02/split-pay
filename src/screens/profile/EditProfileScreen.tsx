import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TextInput, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { PaymentMethod } from '../../types';
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
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Name is required'
      });
      return;
    }

    // Validate phone and payment method together
    if ((phone && !paymentMethod) || (!phone && paymentMethod)) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Please provide both phone number and payment method, or leave both empty'
      });
      return;
    }

    if (phone && phone.length < 10) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Please enter a valid phone number'
      });
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        name: name.trim(),
        phone: phone || undefined,
        paymentMethod: paymentMethod || undefined,
      });

      modal.showModal({
        type: 'success',
        title: 'Success',
        message: 'Profile updated successfully',
        onConfirm: () => {
          navigation.goBack();
        }
      });
    } catch (err) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update profile'
      });
    } finally {
      setIsSaving(false);
    }
  };

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
              {
                value: 'gcash',
                label: 'GCash',
                icon: 'wallet',
                disabled: isSaving,
              },
              {
                value: 'maya',
                label: 'Maya',
                icon: 'credit-card',
                disabled: isSaving,
              },
            ]}
            style={styles.segmentedButtons}
          />

          {phone && paymentMethod && (
            <View style={styles.previewContainer}>
              <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
              <View style={styles.previewContent}>
                <Text style={styles.previewLabel}>Payment Preview</Text>
                <Text style={styles.previewText}>
                  Friends will see: {paymentMethod === 'gcash' ? 'GCash' : 'Maya'} - {phone}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.sm,
  },
  sectionSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginBottom: SPACING.lg,
  },
  input: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  segmentedButtons: {
    marginBottom: SPACING.lg,
  },
  disabledField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  disabledFieldContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  disabledFieldLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  disabledFieldValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray700,
    marginTop: SPACING.xs,
  },
  badge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  previewContent: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  previewLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  previewText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray700,
  },
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
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen;
