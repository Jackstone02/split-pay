module.exports = {
  expo: {
    name: 'Amot',
    slug: 'amot',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'light',
    scheme: ['amot', 'com.amot.app'],
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
      bundleIdentifier: 'com.theamot.app',
      config: {
        googleMapsApiKey: 'AIzaSyDcaDaB4hdR4SGGGotR7l8saIR8Zp_zPY0',
      },
      infoPlist: {
        LSApplicationQueriesSchemes: ['gcash', 'paymaya', 'googlechrome', 'safari'],
        UIBackgroundModes: ['remote-notification'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#6366F1',
      },
      package: 'com.amot.app',
      permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'READ_EXTERNAL_STORAGE'],
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: 'AIzaSyDcaDaB4hdR4SGGGotR7l8saIR8Zp_zPY0',
        },
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'quvlrsdtrxjikyipxlhd.supabase.co',
              pathPrefix: '/auth/v1/callback',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
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
      'expo-web-browser',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow Amot to use your location to tag bills.',
          locationWhenInUsePermission: 'Allow Amot to use your location to tag bills.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Amot to access your photos for receipts and profile pictures.',
          cameraPermission: 'Allow Amot to access your camera.',
        },
      ],
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
