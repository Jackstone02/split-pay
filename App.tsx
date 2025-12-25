import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { BillProvider } from './src/context/BillContext';
import { GroupProvider } from './src/context/GroupContext';
import { FriendsProvider } from './src/context/FriendsContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { COLORS } from './src/constants/theme';

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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <BillProvider>
              <GroupProvider>
                <FriendsProvider>
                  <AppNavigator />
                </FriendsProvider>
              </GroupProvider>
            </BillProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
