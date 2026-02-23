import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { BillContext } from '../../context/BillContext';
import { UserBillsSummary } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { formatAmount } from '../../utils/formatting';

type ProfileScreenProps = {
  navigation: any;
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);
  const [summary, setSummary] = useState<UserBillsSummary | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const modal = useConfirmationModal();

  if (!authContext || !billContext) {
    return null;
  }

  const { user, sign } = authContext;
  const { getSummary } = billContext;

  const loadSummary = useCallback(async () => {
    if (user) {
      const summary = await getSummary(user.id);
      setSummary(summary);
    }
  }, [user, getSummary]);

  // Reload summary when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const confirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      console.log('Starting logout...');
      await sign.signOut();
      console.log('Logout completed - user should be null now');
      setShowLogoutModal(false);
    } catch (err) {
      console.error('Logout error:', err);
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: `Logout failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleClearData = () => {
    modal.showModal({
      type: 'warning',
      icon: 'trash-can',
      title: 'Clear Data',
      message: 'This will delete all bills and reset the app. Are you sure?',
      confirmText: 'Clear',
      showCancel: true,
      onConfirm: async () => {
        // Would call a clear data function here
        modal.showModal({
          type: 'success',
          title: 'Success',
          message: 'Data cleared successfully',
        });
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <MaterialCommunityIcons name="account" size={56} color={COLORS.white} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.push('EditProfile')}
          >
            <MaterialCommunityIcons name="pencil" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        {summary && (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="hand-coin" size={32} color={COLORS.success} />
                <Text style={styles.statLabel}>Total Owed</Text>
                <Text style={styles.statValue}>{formatAmount(summary.totalOwed, user?.preferredCurrency)}</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="cash-multiple" size={32} color={COLORS.danger} />
                <Text style={styles.statLabel}>Total Owing</Text>
                <Text style={styles.statValue}>{formatAmount(summary.totalOwing, user?.preferredCurrency)}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="check-circle" size={32} color={COLORS.primary} />
                <Text style={styles.statLabel}>Settled</Text>
                <Text style={styles.statValue}>{formatAmount(summary.totalSettled, user?.preferredCurrency)}</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons
                  name="scale-balance"
                  size={32}
                  color={summary.balance > 0 ? COLORS.success : COLORS.danger}
                />
                <Text style={styles.statLabel}>Balance</Text>
                <Text
                  style={[
                    styles.statValue,
                    summary.balance > 0 ? styles.balancePositive : styles.balanceNegative,
                  ]}
                >
                  {formatAmount(summary.balance, user?.preferredCurrency)}
                </Text>
              </View>
            </View>

            <View style={styles.billCountContainer}>
              <MaterialCommunityIcons name="file-document" size={20} color={COLORS.primary} />
              <Text style={styles.billCountText}>
                {summary.billCount} {summary.billCount === 1 ? 'Bill' : 'Bills'}
              </Text>
            </View>
          </View>
        )}

        {/* Account Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.section}>
            <View style={styles.menuItem}>
              <MaterialCommunityIcons name="email" size={20} color={COLORS.gray600} />
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>Email</Text>
                <Text style={styles.menuItemValue}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.menuItem}>
              <MaterialCommunityIcons name="account" size={20} color={COLORS.gray600} />
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>Name</Text>
                <Text style={styles.menuItemValue}>{user?.name}</Text>
              </View>
            </View>

            <View style={styles.menuItem}>
              <MaterialCommunityIcons name="calendar" size={20} color={COLORS.gray600} />
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>Joined</Text>
                <Text style={styles.menuItemValue}>
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.section}>
            {user?.paymentMethod ? (
              <>
                {user.paymentMethod !== 'bank_transfer' && user.phone && (
                  <View style={styles.menuItem}>
                    <MaterialCommunityIcons name="phone" size={20} color={COLORS.gray600} />
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemLabel}>Phone Number</Text>
                      <Text style={styles.menuItemValue}>{user.phone}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.menuItem}>
                  <MaterialCommunityIcons
                    name={user.paymentMethod === 'gcash' ? 'wallet' : user.paymentMethod === 'bank_transfer' ? 'bank' : 'credit-card'}
                    size={20}
                    color={COLORS.gray600}
                  />
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemLabel}>Payment Method</Text>
                    <Text style={styles.menuItemValue}>
                      {user.paymentMethod === 'gcash' ? 'GCash' : user.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Maya'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyPaymentContainer}>
                <MaterialCommunityIcons name="wallet-outline" size={48} color={COLORS.gray400} />
                <Text style={styles.emptyPaymentText}>No payment info added</Text>
                <Text style={styles.emptyPaymentSubtext}>
                  Add your payment details to receive payments easily
                </Text>
                <TouchableOpacity
                  style={styles.addPaymentButton}
                  onPress={() => navigation.push('EditProfile')}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
                  <Text style={styles.addPaymentButtonText}>Add Payment Info</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.section}>
            {/* <TouchableOpacity
              style={styles.settingButton}
              onPress={() => navigation.push('Debug')}
            >
              <MaterialCommunityIcons name="bug" size={20} color={COLORS.primary} />
              <Text style={styles.settingButtonText}>Push Notification Debug</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.gray400}
                style={styles.chevron}
              />
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.settingButton} onPress={handleClearData}>
              <MaterialCommunityIcons name="trash-can" size={20} color={COLORS.warning} />
              <Text style={styles.settingButtonText}>Clear All Data</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={COLORS.gray400}
                style={styles.chevron}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.white} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Amot v1.0.0</Text>
          <Text style={styles.footerSubtext}>Split bills with ease</Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="logout" size={48} color={COLORS.danger} />
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to logout from Amot?</Text>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, isLoggingOut && styles.confirmButtonDisabled]}
                onPress={confirmLogout}
                disabled={isLoggingOut}
              >
                <Text style={styles.confirmButtonText}>
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xl,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInfo: {
    flex: 1,
  },
  editButton: {
    padding: SPACING.sm,
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER_RADIUS.md,
  },
  userName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  summarySection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    fontWeight: '600',
    marginTop: SPACING.sm,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: SPACING.xs,
  },
  balancePositive: {
    color: COLORS.success,
  },
  balanceNegative: {
    color: COLORS.danger,
  },
  billCountContainer: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    gap: SPACING.md,
  },
  billCountText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  section: {
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  menuItemContent: {
    marginLeft: SPACING.lg,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  menuItemValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.black,
    marginTop: SPACING.xs,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  settingButtonText: {
    marginLeft: SPACING.lg,
    fontSize: FONT_SIZES.md,
    color: COLORS.warning,
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.gray600,
  },
  footerSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  modalMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray200,
  },
  cancelButtonText: {
    color: COLORS.black,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  confirmButton: {
    backgroundColor: COLORS.danger,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  emptyPaymentContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  emptyPaymentText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: SPACING.md,
  },
  emptyPaymentSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  addPaymentButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
});

export default ProfileScreen;
