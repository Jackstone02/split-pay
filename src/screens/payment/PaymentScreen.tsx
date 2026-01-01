import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
  Clipboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as IntentLauncher from 'expo-intent-launcher';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { BillContext } from '../../context/BillContext';
import { supabaseApi } from '../../services/supabaseApi';
import { mockApi } from '../../services/mockApi';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { User } from '../../types';
import { formatPeso, formatCurrency } from '../../utils/formatting';

type PaymentMethod = 'gcash' | 'paymaya' | 'card' | 'manual';

type PaymentScreenProps = {
  navigation: any;
  route: any;
};

const PaymentScreen: React.FC<PaymentScreenProps> = ({ navigation, route }) => {
  const { billId, friendId, friendName, amount } = route.params;
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [friendUser, setFriendUser] = useState<User | null>(null);
  const [isLoadingFriend, setIsLoadingFriend] = useState(true);

  const authContext = useContext(AuthContext);
  const billContext = useContext(BillContext);
  const modal = useConfirmationModal();

  if (!authContext || !billContext) {
    return null;
  }

  const { user } = authContext;

  // Fetch friend's user data to get phone number
  useEffect(() => {
    const loadFriendData = async () => {
      try {
        setIsLoadingFriend(true);
        // Try to get from Supabase first
        try {
          const users = await supabaseApi.getUsersByIds([friendId]);
          if (users.length > 0) {
            setFriendUser(users[0]);
          }
        } catch (supabaseError) {
          // Fallback to mockApi
          const userData = await mockApi.getUserById(friendId);
          if (userData) {
            setFriendUser(userData);
          }
        }
      } catch (error) {
        console.error('Error loading friend data:', error);
      } finally {
        setIsLoadingFriend(false);
      }
    };

    loadFriendData();
  }, [friendId]);

  const allPaymentMethods = [
    {
      id: 'gcash' as PaymentMethod,
      name: 'GCash',
      icon: 'wallet',
      color: '#007DFF',
      description: 'Opens GCash app - you\'ll manually enter amount',
      enabled: true,
    },
    {
      id: 'paymaya' as PaymentMethod,
      name: 'Maya (PayMaya)',
      icon: 'wallet-outline',
      color: '#00D632',
      description: 'Opens Maya app - you\'ll manually enter amount',
      enabled: true,
    },
    {
      id: 'manual' as PaymentMethod,
      name: 'Mark as Paid',
      icon: 'check-circle-outline',
      color: COLORS.success,
      description: 'Already paid via cash, bank transfer, etc.',
      enabled: true,
    },
  ];

  // Filter payment methods based on friend's preferred method
  const paymentMethods = allPaymentMethods.filter(method => {
    // Always show the manual option
    if (method.id === 'manual') return true;

    // If friend has a payment method preference, show only that method
    if (friendUser?.paymentMethod) {
      return method.id === friendUser.paymentMethod;
    }

    // If no preference, show both GCash and Maya
    return true;
  });

  const handleCopyPhone = (phone: string) => {
    Clipboard.setString(phone);
    modal.showModal({
      type: 'success',
      title: 'Copied!',
      message: 'Phone number copied to clipboard',
    });
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Please select a payment method',
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (selectedMethod === 'manual') {
        // Handle manual payment marking
        modal.showModal({
          type: 'confirm',
          title: 'Confirm Payment',
          message: `Mark ${formatPeso(amount)} to ${friendName} as paid?`,
          confirmText: 'Confirm',
          showCancel: true,
          onConfirm: async () => {
            if (!user) {
              throw new Error('User not authenticated');
            }

            // If billId is provided, mark the bill split as settled
            if (billId) {
              await supabaseApi.markBillSplitAsSettled(billId, user.id);
            }

            // Create payment record for tracking
            await supabaseApi.createPaymentRecord({
              fromUserId: user.id,
              toUserId: friendId,
              amount: amount,
              paymentMethod: 'manual',
              note: `Manual payment to ${friendName}`,
            });

            // Reload bills and navigate
            await billContext?.loadBills();

            if (billId) {
              // Navigate back to bill detail screen
              navigation.navigate('BillDetail', { billId });
            } else {
              navigation.goBack();
            }
          },
        });
        setIsProcessing(false);
      } else {
        // Handle online payment via payment gateway
        await processOnlinePayment(selectedMethod);
      }
    } catch (error) {
      console.error('Payment error:', error);
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to process payment. Please try again.',
      });
      setIsProcessing(false);
    }
  };

  const processOnlinePayment = async (method: PaymentMethod) => {
    let appName = '';
    let packageName = '';
    let storeUrl = '';
    let iosUrl = '';

    // Configure package names and URLs for each payment method
    if (method === 'gcash') {
      appName = 'GCash';
      packageName = 'com.globe.gcash.android';
      iosUrl = 'gcash://';
      storeUrl = Platform.select({
        ios: 'https://apps.apple.com/ph/app/gcash/id520020791',
        android: 'https://play.google.com/store/apps/details?id=com.globe.gcash.android',
      }) || 'https://play.google.com/store/apps/details?id=com.globe.gcash.android';
    } else if (method === 'paymaya') {
      appName = 'Maya';
      packageName = 'com.paymaya';
      iosUrl = 'paymaya://';
      storeUrl = Platform.select({
        ios: 'https://apps.apple.com/ph/app/maya/id768423611',
        android: 'https://play.google.com/store/apps/details?id=com.paymaya',
      }) || 'https://play.google.com/store/apps/details?id=com.paymaya';
    }

    try {
      if (Platform.OS === 'android') {
        // Android: Try URL scheme first, then fall back to IntentLauncher
        console.log(`Launching ${appName} on Android`);

        try {
          // Try URL scheme approach first
          if (method === 'gcash') {
            // Try multiple GCash URL schemes (GCash might use a different scheme)
            const gcashSchemes = [
              'gcash://',
              'com.globe.gcash.android://',
              'globegcash://',
              'gcash://gcash.com',
            ];

            let opened = false;
            for (const scheme of gcashSchemes) {
              try {
                console.log(`Trying GCash URL scheme: ${scheme}`);
                await Linking.openURL(scheme);
                opened = true;
                break;
              } catch (e) {
                console.log(`Scheme ${scheme} failed:`, e);
              }
            }

            if (!opened) {
              throw new Error('All GCash URL schemes failed');
            }
          } else {
            // PayMaya works with paymaya://
            console.log(`Trying PayMaya URL scheme: paymaya://`);
            await Linking.openURL('paymaya://');
          }

          // If successful, show confirmation screen
          setIsProcessing(false);
          setShowConfirmation(true);
        } catch (urlError) {
          console.log('URL scheme failed, trying IntentLauncher:', urlError);

          // Fallback: Try IntentLauncher
          const result = await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            packageName: packageName,
            flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
          });

          console.log('IntentLauncher result:', result);
          setIsProcessing(false);
          setShowConfirmation(true);
        }
      } else {
        // iOS: Use URL scheme
        console.log(`Attempting to open ${appName} on iOS with URL: ${iosUrl}`);
        const canOpen = await Linking.canOpenURL(iosUrl);

        if (canOpen) {
          await Linking.openURL(iosUrl);
          setIsProcessing(false);
          setShowConfirmation(true);
        } else {
          throw new Error('App not installed');
        }
      }
    } catch (error) {
      console.error(`Error opening ${appName}:`, error);

      // If opening failed, app is likely not installed
      modal.showModal({
        type: 'warning',
        title: `${appName} Not Installed`,
        message: `Would you like to install ${appName}?`,
        confirmText: 'Install',
        showCancel: true,
        onConfirm: async () => {
          try {
            await Linking.openURL(storeUrl);
          } catch (storeError) {
            console.error('Error opening store:', storeError);
          }
          setIsProcessing(false);
        },
        onCancel: () => setIsProcessing(false),
      });
    }
  };

  const handleConfirmPayment = async () => {
    if (!user) return;

    try {
      setIsProcessing(true);

      // If billId is provided, mark the bill split as settled
      if (billId) {
        await supabaseApi.markBillSplitAsSettled(billId, user.id);
      }

      // Create payment record in database for tracking
      await supabaseApi.createPaymentRecord({
        fromUserId: user.id,
        toUserId: friendId,
        amount: amount,
        paymentMethod: selectedMethod || 'manual',
        externalReference: referenceNumber || undefined,
        note: `Payment to ${friendName} via ${selectedMethod}`,
      });

      modal.showModal({
        type: 'success',
        title: 'Payment Recorded',
        message: `Your payment of ${formatPeso(amount)} to ${friendName} has been recorded.${
          referenceNumber ? `\n\nReference: ${referenceNumber}` : ''
        }`,
        confirmText: 'Done',
        onConfirm: () => {
          billContext?.loadBills();
          if (billId) {
            // Navigate back to bill detail screen
            navigation.navigate('BillDetail', { billId });
          } else {
            navigation.goBack();
          }
        },
      });
    } catch (error) {
      console.error('Error saving payment:', error);
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to save payment record',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show confirmation screen after returning from e-wallet app
  if (showConfirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowConfirmation(false)}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Confirm Payment</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Success Icon */}
          <View style={styles.confirmationContainer}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check-circle" size={80} color={COLORS.success} />
            </View>
            <Text style={styles.confirmationTitle}>Payment Completed?</Text>
            <Text style={styles.confirmationSubtitle}>
              Did you successfully complete the payment of {formatPeso(amount)} to {friendName}?
            </Text>

            {/* Reference Number Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Reference Number (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter reference/transaction number"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholderTextColor={COLORS.gray400}
              />
              <Text style={styles.inputHint}>
                Add the reference number from your receipt for record keeping
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.white} />
                    <Text style={styles.confirmButtonText}>Yes, Mark as Paid</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowConfirmation(false);
                  setReferenceNumber('');
                }}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>No, Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Paying to</Text>
          <Text style={styles.summaryName}>{friendName}</Text>

          {/* Phone Number Section */}
          {isLoadingFriend ? (
            <View style={styles.phoneContainer}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.phoneLabel}>Loading contact info...</Text>
            </View>
          ) : friendUser?.phone ? (
            <TouchableOpacity
              style={styles.phoneContainer}
              onPress={() => handleCopyPhone(friendUser.phone!)}
              activeOpacity={0.7}
            >
              <View style={styles.phoneRow}>
                <MaterialCommunityIcons name="phone" size={16} color={COLORS.white} />
                <Text style={styles.phoneLabel}>
                  {friendUser.paymentMethod === 'gcash' ? 'GCash' : friendUser.paymentMethod === 'paymaya' ? 'Maya' : 'GCash/Maya'} Number
                </Text>
              </View>
              <View style={styles.phoneValueRow}>
                <Text style={styles.phoneValue}>{friendUser.phone}</Text>
                <View style={styles.copyButton}>
                  <MaterialCommunityIcons name="content-copy" size={16} color={COLORS.white} />
                  <Text style={styles.copyButtonText}>Tap to copy</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.phoneContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.white} />
              <Text style={styles.phoneWarning}>
                No phone number on file. You'll need to ask {friendName.split(' ')[0]} for their {friendUser?.paymentMethod === 'gcash' ? 'GCash' : friendUser?.paymentMethod === 'paymaya' ? 'Maya' : 'GCash/Maya'} number.
              </Text>
            </View>
          )}

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount to Pay</Text>
            <Text style={styles.amountValue}>{formatPeso(amount)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod === method.id && styles.methodCardSelected,
                !method.enabled && styles.methodCardDisabled,
              ]}
              onPress={() => method.enabled && setSelectedMethod(method.id)}
              disabled={!method.enabled}
            >
              <View style={styles.methodIconContainer}>
                <MaterialCommunityIcons
                  name={method.icon as any}
                  size={28}
                  color={selectedMethod === method.id ? COLORS.white : method.color}
                />
              </View>
              <View style={styles.methodInfo}>
                <Text
                  style={[
                    styles.methodName,
                    selectedMethod === method.id && styles.methodNameSelected,
                  ]}
                >
                  {method.name}
                </Text>
                <Text
                  style={[
                    styles.methodDescription,
                    selectedMethod === method.id && styles.methodDescriptionSelected,
                  ]}
                >
                  {method.description}
                </Text>
              </View>
              {selectedMethod === method.id && (
                <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Instructions Card */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <Text style={styles.infoText}>
              1. Select {friendUser?.paymentMethod === 'gcash' ? 'GCash' : friendUser?.paymentMethod === 'paymaya' ? 'Maya' : 'GCash or Maya'} to open the app{'\n'}
              2. Manually enter the amount ({formatPeso(amount)}) and recipient's number{friendUser?.phone ? ' (copied above)' : ''}{'\n'}
              3. Complete the payment in the app{'\n'}
              4. Return here and mark as paid
            </Text>
            <Text style={styles.infoNote}>
              Or choose "Mark as Paid" if you've already paid via cash, bank transfer, or other method.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, !selectedMethod && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!selectedMethod || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="cash" size={20} color={COLORS.white} />
              <Text style={styles.payButtonText}>
                {selectedMethod === 'manual' ? 'Mark as Paid' : `Pay ${formatPeso(amount)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  summaryCard: {
    backgroundColor: COLORS.primary,
    margin: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: SPACING.xs,
  },
  summaryName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  phoneContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  phoneLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    opacity: 0.9,
    fontWeight: '600',
  },
  phoneValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  phoneValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  copyButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  phoneWarning: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginLeft: SPACING.xs,
    lineHeight: 18,
  },
  amountContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: SPACING.lg,
  },
  amountLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: SPACING.xs,
  },
  amountValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  methodCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gray200,
  },
  methodCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  methodCardDisabled: {
    opacity: 0.5,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: SPACING.xs,
  },
  methodNameSelected: {
    color: COLORS.white,
  },
  methodDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
  },
  methodDescriptionSelected: {
    color: COLORS.white,
    opacity: 0.9,
  },
  infoCard: {
    backgroundColor: COLORS.primary + '10',
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  infoTextContainer: {
    flex: 1,
    gap: SPACING.sm,
  },
  infoTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray700,
    lineHeight: 20,
  },
  infoNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray600,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  footer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  payButton: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  payButtonDisabled: {
    backgroundColor: COLORS.gray400,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  confirmationContainer: {
    flex: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconContainer: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  confirmationTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.black,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  confirmationSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.black,
  },
  inputHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray500,
    marginTop: SPACING.sm,
  },
  confirmationButtons: {
    width: '100%',
    gap: SPACING.md,
  },
  confirmButton: {
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.gray700,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
});

export default PaymentScreen;
