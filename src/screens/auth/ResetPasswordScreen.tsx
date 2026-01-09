import React, { useState, useContext, useEffect } from 'react';
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
import { RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { AuthContext } from '../../context/AuthContext';
import { AuthStackParamList } from '../../types';

type ResetPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
};

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation, route }) => {
  const modal = useConfirmationModal();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const authContext = useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { sign, isConfirmingReset, error } = authContext;
  const { accessToken, refreshToken } = route.params;

  useEffect(() => {
    // Check if access token is provided
    if (!accessToken) {
      modal.showModal({
        type: 'error',
        title: 'Invalid Link',
        message: 'This password reset link is invalid or has expired. Please request a new one.',
        onConfirm: () => {
          navigation.navigate('Login');
        },
      });
    }
  }, [accessToken]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please fill in all fields' });
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

    try {
      await sign.confirmPasswordReset(accessToken, refreshToken, password);
      modal.showModal({
        type: 'success',
        title: 'Password Reset!',
        message: 'Your password has been reset successfully. You can now login with your new password.',
        onConfirm: () => {
          navigation.navigate('Login');
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';

      // Check for common errors
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        modal.showModal({
          type: 'error',
          title: 'Link Expired',
          message: 'This password reset link has expired. Please request a new one.',
          onConfirm: () => {
            navigation.navigate('ForgotPassword');
          },
        });
      } else {
        modal.showModal({
          type: 'error',
          title: 'Reset Failed',
          message: errorMessage,
        });
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
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your new password</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="New Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter a strong password"
            placeholderTextColor={COLORS.gray400}
            textColor={COLORS.black}
            mode="outlined"
            secureTextEntry={!showPassword}
            editable={!isConfirmingReset}
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isConfirmingReset || false}
                forceTextInputFocus={false}
              />
            }
          />

          <TextInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your new password"
            placeholderTextColor={COLORS.gray400}
            textColor={COLORS.black}
            mode="outlined"
            secureTextEntry={!showConfirmPassword}
            editable={!isConfirmingReset}
            style={styles.input}
            outlineColor={COLORS.gray300}
            activeOutlineColor={COLORS.primary}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isConfirmingReset || false}
                forceTextInputFocus={false}
              />
            }
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.resetButton, isConfirmingReset && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={isConfirmingReset}
          >
            {isConfirmingReset ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.resetButtonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
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

export default ResetPasswordScreen;
