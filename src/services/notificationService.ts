import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PokeParams } from '../types';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and get Expo Push Token
 * @returns Expo Push Token string or null if failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Push notifications don't work on web or simulators
    if (Platform.OS === 'web') {
      console.warn('Push notifications are not supported on web');
      return null;
    }

    // Check if running on physical device (push notifications don't work on simulators)
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If permission not granted, request it
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If permission still not granted, return null
    if (finalStatus !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Get Expo Push Token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('Project ID not found in app configuration');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pokes', {
        name: 'Payment Pokes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6F00',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Get unique device ID for this device
 * @returns Device ID string
 */
export function getDeviceId(): string {
  const deviceId = Constants.installationId || Constants.deviceId || 'unknown';
  return deviceId;
}

/**
 * Send a poke notification via Expo Push Service
 * @param params Poke parameters including recipient token, sender info, and bill details
 */
export async function sendPokeNotification(params: PokeParams): Promise<void> {
  const {
    fromUserName,
    toPushToken,
    billId,
    billTitle,
    amount,
    message,
  } = params;

  try {
    // Construct notification message
    const title = `${fromUserName} is poking you! 👋`;

    let body: string;
    if (billTitle && amount) {
      body = `Friendly reminder: You owe ₱${amount.toFixed(2)} for "${billTitle}"`;
    } else if (amount) {
      body = `You have an unpaid balance of ₱${amount.toFixed(2)}`;
    } else if (message) {
      body = message;
    } else {
      body = 'Time to settle up!';
    }

    // Construct notification payload
    const notificationPayload = {
      to: toPushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: 'poke',
        fromUserId: params.fromUserId,
        billId,
        amount,
        deepLink: billId ? `amot://bill/${billId}` : 'amot://friends',
      },
      priority: 'high' as const,
      channelId: Platform.OS === 'android' ? 'pokes' : undefined,
      badge: 1,
    };

    // Send notification via Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();

    if (!response.ok || result.data?.status === 'error') {
      throw new Error(result.data?.message || 'Failed to send push notification');
    }

    console.log('Poke notification sent successfully:', result);
  } catch (error) {
    console.error('Error sending poke notification:', error);
    throw error;
  }
}

/**
 * Setup notification event listeners
 * @param onNotificationReceived Callback when notification is received while app is in foreground
 * @param onNotificationTapped Callback when user taps on a notification
 */
export function setupNotificationHandlers(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
): () => void {
  // Listener for notifications received while app is in foreground
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    onNotificationReceived?.(notification);
  });

  // Listener for when user taps on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification tapped:', response);
    onNotificationTapped?.(response);
  });

  // Return cleanup function
  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
}

/**
 * Listen for push token updates and call callback with new token
 * @param callback Function to call with new token
 */
export function setupPushTokenUpdateListener(
  callback: (token: string) => void
): () => void {
  const subscription = Notifications.addPushTokenListener((tokenData) => {
    console.log('Push token updated:', tokenData.data);
    callback(tokenData.data);
  });

  return () => subscription.remove();
}

/**
 * Clear all notifications from the notification tray
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Get current notification permissions status
 */
export async function getNotificationPermissionsStatus(): Promise<Notifications.NotificationPermissionsStatus> {
  return await Notifications.getPermissionsAsync();
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleTestNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: {
      seconds: 2,
    },
  });
}

/**
 * Set app badge count (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'ios') {
    await Notifications.setBadgeCountAsync(count);
  }
}

/**
 * Get current app badge count (iOS)
 */
export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === 'ios') {
    return await Notifications.getBadgeCountAsync();
  }
  return 0;
}
