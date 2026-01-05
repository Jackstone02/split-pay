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
    console.log('[Push Token] Starting registration...');
    console.log('[Push Token] Platform:', Platform.OS);
    console.log('[Push Token] Is Device:', Device.isDevice);

    // Push notifications don't work on web or simulators
    if (Platform.OS === 'web') {
      console.warn('[Push Token] ❌ Not supported on web');
      return null;
    }

    // Check if running on physical device (push notifications don't work on simulators)
    if (!Device.isDevice) {
      console.warn('[Push Token] ❌ Only works on physical devices');
      return null;
    }

    // Request notification permissions
    console.log('[Push Token] Checking permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    console.log('[Push Token] Existing permission status:', existingStatus);

    // If permission not granted, request it
    if (existingStatus !== 'granted') {
      console.log('[Push Token] Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Push Token] New permission status:', finalStatus);
    }

    // If permission still not granted, return null
    if (finalStatus !== 'granted') {
      console.warn('[Push Token] ❌ Permission not granted');
      return null;
    }

    console.log('[Push Token] ✅ Permissions granted');

    // Get Expo Push Token
    // Access project ID from different sources depending on build type
    console.log('[Push Token] Attempting to get project ID...');
    console.log('[Push Token] expoConfig.extra:', Constants.expoConfig?.extra);
    console.log('[Push Token] manifest2.extra:', Constants.manifest2?.extra);
    console.log('[Push Token] manifest.extra:', Constants.manifest?.extra);

    let projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.manifest2?.extra?.eas?.projectId ||
      Constants.manifest?.extra?.eas?.projectId;

    // Fallback: Use hardcoded project ID from app.config.js for standalone builds
    if (!projectId) {
      console.warn('[Push Token] Project ID not found in Constants, using fallback');
      projectId = 'fa176539-95b7-4385-a705-0ad36fe4d4aa'; // From app.config.js
    }

    console.log('[Push Token] Using Expo project ID:', projectId);

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

      await Notifications.setNotificationChannelAsync('activities', {
        name: 'Activity Updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    console.log('[Push Token] ✅ Token obtained successfully:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('[Push Token] ❌ Error during registration:', error);
    if (error instanceof Error) {
      console.error('[Push Token] Error message:', error.message);
      console.error('[Push Token] Error stack:', error.stack);
    }
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
 * Send an activity notification via Expo Push Service
 * @param params Activity notification parameters
 */
export async function sendActivityNotification(params: {
  toPushToken: string;
  actorName: string;
  action: string;
  targetType?: string;
  payload?: any;
}): Promise<void> {
  const { toPushToken, actorName, action, payload = {} } = params;

  try {
    // Construct notification based on activity type
    let title = '';
    let body = '';
    let deepLink = 'amot://activity';

    switch (action) {
      case 'friend_added':
        title = 'New Friend';
        body = `${actorName} added you as a friend`;
        deepLink = 'amot://friends';
        break;

      case 'bill_created':
        title = 'New Bill';
        body = `${actorName} created bill "${payload.billTitle}"`;
        deepLink = payload.billId ? `amot://bill/${payload.billId}` : 'amot://activity';
        break;

      case 'bill_updated':
        title = 'Bill Updated';
        body = `${actorName} updated bill "${payload.billTitle}"`;
        deepLink = payload.billId ? `amot://bill/${payload.billId}` : 'amot://activity';
        break;

      case 'bill_deleted':
        title = 'Bill Deleted';
        body = `${actorName} deleted bill "${payload.billTitle}"`;
        deepLink = 'amot://activity';
        break;

      case 'bill_settled':
        title = 'Bill Settled';
        body = `${actorName} settled bill "${payload.billTitle}"`;
        deepLink = payload.billId ? `amot://bill/${payload.billId}` : 'amot://activity';
        break;

      case 'payment_made':
        title = 'Payment Received';
        body = `${actorName} paid ₱${payload.amount?.toFixed(2)} for "${payload.billTitle}"`;
        deepLink = payload.billId ? `amot://bill/${payload.billId}` : 'amot://activity';
        break;

      case 'group_created':
        title = 'New Group';
        body = `${actorName} added you to group "${payload.groupName}"`;
        deepLink = payload.groupId ? `amot://group/${payload.groupId}` : 'amot://groups';
        break;

      case 'group_updated':
        title = 'Group Updated';
        body = `${actorName} updated group "${payload.groupName}"`;
        deepLink = payload.groupId ? `amot://group/${payload.groupId}` : 'amot://groups';
        break;

      case 'member_added':
        title = 'Group Member Added';
        body = `${actorName} joined group "${payload.groupName}"`;
        deepLink = payload.groupId ? `amot://group/${payload.groupId}` : 'amot://groups';
        break;

      case 'member_removed':
        title = 'Group Member Removed';
        body = `${actorName} left group "${payload.groupName}"`;
        deepLink = payload.groupId ? `amot://group/${payload.groupId}` : 'amot://groups';
        break;

      default:
        // Generic fallback
        title = 'Activity Update';
        body = `${actorName} performed an action`;
        break;
    }

    // Construct notification payload
    const notificationPayload = {
      to: toPushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: 'activity',
        action,
        deepLink,
        ...payload,
      },
      priority: 'default' as const,
      channelId: Platform.OS === 'android' ? 'activities' : undefined,
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

    console.log('Activity notification sent successfully:', result);
  } catch (error) {
    console.error('Error sending activity notification:', error);
    // Don't throw - notification is non-critical
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
