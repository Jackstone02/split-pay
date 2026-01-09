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
import { TextInput } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { AuthStackParamList } from '../../types';

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const modal = useConfirmationModal();
  const [email, setEmail] = useState('');

  const authContext = useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { sign, isResettingPassword, error } = authContext;

  const handleResetPassword = async () => {
    if (!email) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please enter your email address' });
      return;
    }

    try {
      await sign.resetPassword(email);
      modal.showModal({
        type: 'success',
        title: 'Email Sent',
        message: 'Check your email for password reset instructions. The link will expire in 1 hour.',
        onConfirm: () => {
          navigation.pop();
        },
      });
    } catch (err) {
      modal.showModal({
        type: 'error',
        title: 'Reset Failed',
        message: err instanceof Error ? err.message : 'Failed to send reset email'
      });
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
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a password reset link</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="john@example.com"
            placeholderTextColor={COLORS.gray400}
            textColor={COLORS.black}
            mode="outlined"
            editable={!isResettingPassword}
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.resetButton, isResettingPassword && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={isResettingPassword}
          >
            {isResettingPassword ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.resetButtonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Remember your password? </Text>
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
    textAlign: 'center',
  },
  form: {
    marginBottom: SPACING.xxl,
  },
  input: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.gray50,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm,
  },
  resetButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
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
});

export default ForgotPasswordScreen;
