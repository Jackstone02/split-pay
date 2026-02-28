import React, { useState, useContext } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TextInput, SegmentedButtons } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { AuthStackParamList, PaymentMethod } from '../../types';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { AppleSignInButton } from '../../components/AppleSignInButton';

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const modal = useConfirmationModal();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const authContext = useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { sign, isSigningUp, isSigningInWithGoogle, error } = authContext;

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please fill in all required fields' });
      return;
    }

    if (password.length < 6) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Password must be at least 6 characters' });
      return;
    }

    if (password !== confirmPassword) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Passwords do not match' });
      return;
    }

    // Validate phone and payment method together (bank_transfer doesn't need a phone)
    if ((phone && !paymentMethod) || (!phone && paymentMethod && paymentMethod !== 'bank_transfer')) {
      modal.showModal({
        type: 'error',
        title: 'Error',
        message: 'Please provide both phone number and payment method, or leave both empty'
      });
      return;
    }

    if (phone && phone.length < 10) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please enter a valid phone number' });
      return;
    }

    try {
      const result = await sign.signUp(email, password, name, phone || undefined, paymentMethod || undefined);

      // Check if email confirmation is required
      if (!result.token) {
        modal.showModal({
          type: 'success',
          title: 'Account Created!',
          message: 'Please check your email to confirm your account before logging in.\n\nCan\'t find it? Check your spam or junk folder.',
          onConfirm: () => {
            navigation.navigate('Login');
          },
        });
      }
      // If token exists, user is auto-logged in (handled by AuthContext)
    } catch (err) {
      modal.showModal({ type: 'error', title: 'Signup Failed', message: err instanceof Error ? err.message : 'Unknown error occurred' });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await sign.signInWithGoogle();
    } catch (err) {
      modal.showModal({ type: 'error', title: 'Google Sign-In Failed', message: err instanceof Error ? err.message : 'Could not sign in with Google' });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await sign.signInWithApple();
    } catch (err) {
      if (err instanceof Error && err.message !== 'Apple Sign-In was cancelled') {
        modal.showModal({ type: 'error', title: 'Apple Sign-In Failed', message: err.message });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Amot today</Text>
        </View>

      <View style={styles.form}>
        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
          placeholderTextColor={COLORS.gray400}
          textColor={COLORS.black}
          mode="outlined"
          editable={!isSigningUp}
          style={styles.input}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
        />

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="john@example.com"
          placeholderTextColor={COLORS.gray400}
          textColor={COLORS.black}
          mode="outlined"
          editable={!isSigningUp}
          style={styles.input}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
          keyboardType="email-address"
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter a strong password"
          placeholderTextColor={COLORS.gray400}
          textColor={COLORS.black}
          mode="outlined"
          secureTextEntry={!showPassword}
          editable={!isSigningUp}
          style={styles.input}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isSigningUp || false}
              forceTextInputFocus={false}
            />
          }
        />

        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm your password"
          placeholderTextColor={COLORS.gray400}
          textColor={COLORS.black}
          mode="outlined"
          secureTextEntry={!showConfirmPassword}
          editable={!isSigningUp}
          style={styles.input}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
          right={
            <TextInput.Icon
              icon={showConfirmPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isSigningUp || false}
              forceTextInputFocus={false}
            />
          }
        />

        <Text style={styles.sectionLabel}>Payment Details (Optional)</Text>
        <Text style={styles.sectionSubtext}>
          Add your payment details to receive payments easily
        </Text>

        <TextInput
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="09123456789"
          placeholderTextColor={COLORS.gray400}
          textColor={COLORS.black}
          mode="outlined"
          editable={!isSigningUp}
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
              disabled: isSigningUp,
            },
            {
              value: 'paymaya',
              label: 'Maya',
              icon: 'credit-card',
              disabled: isSigningUp,
            },
            {
              value: 'bank_transfer',
              label: 'Bank',
              icon: 'bank',
              disabled: isSigningUp,
            },
          ]}
          style={styles.segmentedButtons}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.signupButton, isSigningUp && styles.signupButtonDisabled]}
          onPress={handleSignup}
          disabled={isSigningUp}
        >
          {isSigningUp ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.signupButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <GoogleSignInButton
          onPress={handleGoogleSignIn}
          isLoading={isSigningInWithGoogle}
          disabled={isSigningUp || isSigningInWithGoogle}
        />

        <AppleSignInButton
          onPress={handleAppleSignIn}
          disabled={isSigningUp || isSigningInWithGoogle}
        />

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.pop()}>
            <Text style={styles.loginLink}>Login</Text>
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
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    marginTop: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
    marginTop: SPACING.sm,
  },
  form: {
    marginBottom: SPACING.xxl,
  },
  input: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.gray50,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  sectionSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
    marginBottom: SPACING.lg,
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
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm,
  },
  signupButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  loginText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
  },
  loginLink: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray300,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gray600,
  },
});

export default SignupScreen;
