import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { AuthContext } from '../../context/AuthContext';
import { supabaseApi } from '../../services/supabaseApi';
import { registerForPushNotifications, getDeviceId } from '../../services/notificationService';
import { COLORS } from '../../constants/theme';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

const DebugScreen = () => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;

  const [pushToken, setPushToken] = useState<string | null>(null);
  const [dbToken, setDbToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<any>({});

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{ timestamp, type, message }, ...prev.slice(0, 49)]);
  };

  const loadDeviceInfo = () => {
    const info = {
      Platform: Platform.OS,
      'Is Device': Device.isDevice ? 'Yes' : 'No (Simulator)',
      'Device Name': Device.deviceName || 'Unknown',
      'Device ID': getDeviceId(),
      'Expo Version': Constants.expoVersion || 'N/A',
      'Project ID (expoConfig)': Constants.expoConfig?.extra?.eas?.projectId || 'Not found',
      'Project ID (manifest2)': Constants.manifest2?.extra?.eas?.projectId || 'Not found',
      'Project ID (manifest)': Constants.manifest?.extra?.eas?.projectId || 'Not found',
    };
    setDeviceInfo(info);
    addLog('info', 'Device info loaded');
  };

  const checkDatabaseToken = async () => {
    if (!user) {
      addLog('warning', 'No user logged in');
      return;
    }

    try {
      addLog('info', 'Checking database for push token...');
      const token = await supabaseApi.getPushToken(user.id);
      setDbToken(token);
      if (token) {
        addLog('success', `Found token in DB: ${token.substring(0, 30)}...`);
      } else {
        addLog('warning', 'No token found in database');
      }
    } catch (error: any) {
      addLog('error', `DB check failed: ${error.message}`);
    }
  };

  const testPushTokenRegistration = async () => {
    if (!user) {
      addLog('error', 'Please login first');
      return;
    }

    setLoading(true);
    addLog('info', 'Starting push token registration test...');

    try {
      // Step 1: Register for push notifications
      addLog('info', 'Step 1: Requesting push token...');

      // Intercept console logs during token registration
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = (...args) => {
        if (args[0]?.includes('[Push Token]')) {
          addLog('info', args.join(' '));
        }
        originalLog(...args);
      };

      console.warn = (...args) => {
        if (args[0]?.includes('[Push Token]')) {
          addLog('warning', args.join(' '));
        }
        originalWarn(...args);
      };

      console.error = (...args) => {
        if (args[0]?.includes('[Push Token]')) {
          addLog('error', String(args[0]) + (args[1] ? ': ' + String(args[1]) : ''));
        }
        originalError(...args);
      };

      const token = await registerForPushNotifications();

      // Restore console
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;

      if (!token) {
        addLog('error', 'Failed to get push token - see logs above for details');
        setLoading(false);
        return;
      }

      setPushToken(token);
      addLog('success', `Got token: ${token.substring(0, 30)}...`);

      // Step 2: Save to database
      addLog('info', 'Step 2: Saving token to database...');
      const deviceId = getDeviceId();
      await supabaseApi.savePushToken({
        userId: user.id,
        token,
        deviceId,
        platform: Platform.OS as 'ios' | 'android' | 'web',
      });

      addLog('success', 'Token saved to database successfully!');

      // Step 3: Verify it was saved
      addLog('info', 'Step 3: Verifying token in database...');
      await checkDatabaseToken();

      addLog('success', '✅ All steps completed successfully!');
    } catch (error: any) {
      addLog('error', `Error: ${error.message}`);
      console.error('Push token test error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeviceInfo();
    if (user) {
      checkDatabaseToken();
    }
  }, [user]);

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return { name: 'check-circle', color: COLORS.success };
      case 'error':
        return { name: 'alert-circle', color: COLORS.danger };
      case 'warning':
        return { name: 'alert', color: COLORS.warning };
      default:
        return { name: 'information', color: COLORS.primary };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Push Notification Debug</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Info</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>ID: {user?.id || 'Not logged in'}</Text>
            <Text style={styles.infoText}>Email: {user?.email || 'N/A'}</Text>
            <Text style={styles.infoText}>Name: {user?.name || 'N/A'}</Text>
          </View>
        </View>

        {/* Device Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Info</Text>
          <View style={styles.infoBox}>
            {Object.entries(deviceInfo).map(([key, value]) => (
              <Text key={key} style={styles.infoText}>
                {key}: {String(value)}
              </Text>
            ))}
          </View>
        </View>

        {/* Push Token Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Token Status</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Current Token: {pushToken ? `${pushToken.substring(0, 40)}...` : 'None'}
            </Text>
            <Text style={styles.infoText}>
              DB Token: {dbToken ? `${dbToken.substring(0, 40)}...` : 'None'}
            </Text>
            <Text style={[styles.statusText, dbToken ? styles.statusSuccess : styles.statusError]}>
              {dbToken ? '✅ Token saved in database' : '❌ No token in database'}
            </Text>
          </View>
        </View>

        {/* Test Button */}
        <TouchableOpacity
          style={styles.testButton}
          onPress={testPushTokenRegistration}
          disabled={loading || !user}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="play-circle" size={24} color={COLORS.white} />
              <Text style={styles.testButtonText}>Test Push Token Registration</Text>
            </>
          )}
        </TouchableOpacity>

        {!user && (
          <Text style={styles.warningText}>⚠️ Please login to test push notifications</Text>
        )}

        {/* Refresh Button */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            loadDeviceInfo();
            checkDatabaseToken();
            addLog('info', 'Refreshed data');
          }}
        >
          <MaterialCommunityIcons name="refresh" size={20} color={COLORS.primary} />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>

        {/* Logs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logs</Text>
          <View style={styles.logsContainer}>
            {logs.length === 0 ? (
              <Text style={styles.noLogsText}>No logs yet. Press "Test" to start.</Text>
            ) : (
              logs.map((log, index) => {
                const { name, color } = getLogIcon(log.type);
                return (
                  <View key={index} style={styles.logEntry}>
                    <MaterialCommunityIcons name={name as any} size={16} color={color} />
                    <View style={styles.logContent}>
                      <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                      <Text style={[styles.logMessage, { color }]}>{log.message}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Build: {Constants.expoConfig?.version || 'Unknown'}
          </Text>
          <Text style={styles.footerText}>
            SDK: {Constants.expoConfig?.sdkVersion || 'Unknown'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray900,
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.gray700,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  statusSuccess: {
    color: COLORS.success,
  },
  statusError: {
    color: COLORS.danger,
  },
  testButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  refreshButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  warningText: {
    textAlign: 'center',
    color: COLORS.warning,
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 16,
  },
  logsContainer: {
    backgroundColor: COLORS.gray900,
    borderRadius: 8,
    padding: 12,
    maxHeight: 400,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  logContent: {
    flex: 1,
  },
  logTimestamp: {
    fontSize: 11,
    color: COLORS.gray400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMessage: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  noLogsText: {
    color: COLORS.gray400,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.gray500,
  },
});

export default DebugScreen;
