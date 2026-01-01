import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { BillProvider } from './src/context/BillContext';
import { GroupProvider } from './src/context/GroupContext';
import { FriendsProvider } from './src/context/FriendsContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { COLORS } from './src/constants/theme';
import {
  registerForPushNotifications,
  setupNotificationHandlers,
  getDeviceId,
} from './src/services/notificationService';
import { supabaseApi } from './src/services/supabaseApi';

const theme = {
  colors: {
    primary: COLORS.primary,
    primaryContainer: COLORS.primaryLight,
    onPrimary: COLORS.white,
    secondary: COLORS.secondary,
    secondaryContainer: COLORS.secondary,
    onSecondary: COLORS.white,
    tertiary: COLORS.primary,
    tertiaryContainer: COLORS.primaryLight,
    onTertiary: COLORS.white,
    error: COLORS.danger,
    errorContainer: COLORS.danger,
    onError: COLORS.white,
    background: COLORS.white,
    onBackground: COLORS.black,
    surface: COLORS.white,
    onSurface: COLORS.black,
    surfaceVariant: COLORS.gray100,
    onSurfaceVariant: COLORS.gray700,
    outline: COLORS.gray300,
    outlineVariant: COLORS.gray200,
    scrim: COLORS.black,
    inverseSurface: COLORS.gray900,
    inverseOnSurface: COLORS.white,
    inversePrimary: COLORS.primaryLight,
  },
};

// Wrapper component to handle notification setup
function AppContent() {
  const authContext = React.useContext(AuthContext);

  useEffect(() => {
    // Setup notification handlers for deep linking
    const cleanup = setupNotificationHandlers(
      // When notification is received in foreground
      (notification) => {
        console.log('Notification received:', notification);
      },
      // When user taps on notification
      (response) => {
        const data = response.notification.request.content.data;
        console.log('Notification tapped:', data);

        // Handle deep link navigation
        if (data.deepLink) {
          // The deep link will be handled by React Navigation's linking config
          console.log('Deep link:', data.deepLink);
        }
      }
    );

    return cleanup;
  }, []);

  useEffect(() => {
    // Register for push notifications when user logs in
    if (authContext?.user) {
      (async () => {
        try {
          console.log('Registering for push notifications...');
          const pushToken = await registerForPushNotifications();

          if (pushToken) {
            console.log('Push token received:', pushToken);

            // Save push token to database
            const deviceId = getDeviceId();
            await supabaseApi.savePushToken({
              userId: authContext.user.id,
              token: pushToken,
              deviceId,
              platform: Platform.OS as 'ios' | 'android' | 'web',
            });

            console.log('Push token saved successfully');
          } else {
            console.warn('Failed to get push token');
          }
        } catch (error) {
          console.error('Error registering for push notifications:', error);
        }
      })();
    }
  }, [authContext?.user]);

  return <AppNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <BillProvider>
              <GroupProvider>
                <FriendsProvider>
                  <AppContent />
                </FriendsProvider>
              </GroupProvider>
            </BillProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
