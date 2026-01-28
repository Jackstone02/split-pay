import React, { useState, useContext } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
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
import { isTablet as checkIsTablet } from '../../utils/deviceUtils';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const modal = useConfirmationModal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isTablet = checkIsTablet();

  const authContext = useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { sign, isSigningIn, error } = authContext;

  const handleLogin = async () => {
    if (!email || !password) {
      modal.showModal({ type: 'error', title: 'Error', message: 'Please fill in all fields' });
      return;
    }

    try {
      await sign.signIn(email, password);
    } catch (err) {
      modal.showModal({ type: 'error', title: 'Login Failed', message: err instanceof Error ? err.message : 'Unknown error occurred' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Amot</Text>
          <Text style={styles.subtitle}>Split bills with ease</Text>
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
          editable={!isSigningIn}
          style={styles.input}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={COLORS.gray400}
          textColor={COLORS.black}
          mode="outlined"
          secureTextEntry={!showPassword}
          editable={!isSigningIn}
          style={styles.input}
          outlineColor={COLORS.gray300}
          activeOutlineColor={COLORS.primary}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isSigningIn || false}
              forceTextInputFocus={false}
            />
          }
        />

        <TouchableOpacity
          onPress={() => navigation.push('ForgotPassword')}
          style={styles.forgotPasswordContainer}
        >
          <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.loginButton, isSigningIn && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.push('Signup')}>
            <Text style={styles.signupLink}>Sign up</Text>
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
  contentContainerTablet: {
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    marginTop: SPACING.md,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
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
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  signupText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray600,
  },
  signupLink: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: SPACING.sm,
  },
  forgotPasswordLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;
