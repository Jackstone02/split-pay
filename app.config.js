module.exports = {
  expo: {
    name: 'Amot',
    slug: 'amot',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'light',
    scheme: 'amot',
    splash: {
      image: './assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#6366F1',
    },
    notification: {
      icon: './assets/logo.png',
      color: '#6366F1',
      androidMode: 'default',
      androidCollapsedTitle: '#{unread_notifications} new notifications',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTabletMode: true,
      infoPlist: {
        LSApplicationQueriesSchemes: ['gcash', 'paymaya'],
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#6366F1',
      },
      package: 'com.amot.app',
      permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
      googleServicesFile: './google-services.json',
    },
    web: {
      bundler: 'webpack',
    },
    sdkVersion: '54.0.0',
    extra: {
      eas: {
        projectId: 'fa176539-95b7-4385-a705-0ad36fe4d4aa',
      },
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: '35.0.0',
            manifestQueries: {
              package: ['com.globe.gcash.android', 'com.paymaya'],
            },
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/logo.png',
          color: '#6366F1',
        },
      ],
    ],
  },
};
