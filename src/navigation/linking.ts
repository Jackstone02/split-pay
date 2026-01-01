import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

/**
 * Deep linking configuration for handling notification navigation
 * Supports the custom URL scheme: amot://
 */
export const linking: LinkingOptions<any> = {
  prefixes: [
    Linking.createURL('/'),
    'amot://',
    'https://amot.app',
  ],
  config: {
    screens: {
      // Auth screens
      Login: 'login',
      Signup: 'signup',

      // Main app screens (nested in tabs)
      MainTabs: {
        screens: {
          Dashboard: 'dashboard',
          Friends: 'friends',
          Groups: 'groups',
          Activity: 'activity',
          Profile: 'profile',
        },
      },

      // Detail screens (outside tabs)
      BillDetail: 'bill/:billId',
      Payment: {
        path: 'payment/:friendId',
        parse: {
          friendId: (friendId: string) => friendId,
          friendName: (friendName: string) => friendName || '',
          amount: (amount: string) => parseFloat(amount) || 0,
          billId: (billId: string) => billId || undefined,
        },
        stringify: {
          friendId: (friendId: string) => friendId,
          friendName: (friendName: string) => friendName,
          amount: (amount: number) => amount.toString(),
          billId: (billId?: string) => billId || '',
        },
      },
      CreateBill: 'create-bill',
      CreateGroup: 'create-group',
      GroupDetail: 'group/:groupId',
      AddFriend: 'add-friend',
      EditProfile: 'edit-profile',

      // Fallback
      NotFound: '*',
    },
  },
};

/**
 * Handle deep link navigation from notification tap
 * @param url Deep link URL (e.g., amot://bill/123)
 * @returns Object with screen name and params to navigate to
 */
export function parseNotificationDeepLink(url: string): {
  screen: string;
  params?: any;
} | null {
  try {
    const parsed = Linking.parse(url);
    const { hostname, path, queryParams } = parsed;

    // Handle bill deep link: amot://bill/:billId
    if (hostname === 'bill' || path?.startsWith('/bill/')) {
      const billId = hostname === 'bill' ? path?.replace('/', '') : path?.split('/')[2];
      if (billId) {
        return {
          screen: 'BillDetail',
          params: { billId },
        };
      }
    }

    // Handle payment deep link: amot://payment/:friendId
    if (hostname === 'payment' || path?.startsWith('/payment/')) {
      const friendId = hostname === 'payment' ? path?.replace('/', '') : path?.split('/')[2];
      if (friendId) {
        return {
          screen: 'Payment',
          params: {
            friendId,
            friendName: queryParams?.friendName || '',
            amount: parseFloat(queryParams?.amount as string) || 0,
            billId: queryParams?.billId,
          },
        };
      }
    }

    // Handle friends deep link: amot://friends
    if (hostname === 'friends' || path === '/friends') {
      return {
        screen: 'MainTabs',
        params: { screen: 'Friends' },
      };
    }

    // Handle activity deep link: amot://activity
    if (hostname === 'activity' || path === '/activity') {
      return {
        screen: 'MainTabs',
        params: { screen: 'Activity' },
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing deep link:', error);
    return null;
  }
}

/**
 * Create a deep link URL for a specific screen
 * @param screen Screen name
 * @param params Screen parameters
 * @returns Deep link URL string
 */
export function createDeepLink(screen: string, params?: any): string {
  switch (screen) {
    case 'BillDetail':
      return `amot://bill/${params.billId}`;

    case 'Payment':
      return `amot://payment/${params.friendId}?friendName=${params.friendName}&amount=${params.amount}${params.billId ? `&billId=${params.billId}` : ''}`;

    case 'Friends':
      return 'amot://friends';

    case 'Activity':
      return 'amot://activity';

    default:
      return 'amot://';
  }
}
