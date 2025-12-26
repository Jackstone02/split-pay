import React, { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AuthContext } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { RootStackParamList, TabParamList, AuthStackParamList } from '../types';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Main Tab Screens
import DashboardScreen from '../screens/bills/DashboardScreen';
import FriendsScreen from '../screens/friends/FriendsScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import ActivityScreen from '../screens/activity/ActivityScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Modal/Detail Screens
import CreateBillScreen from '../screens/bills/CreateBillScreen';
import BillDetailScreen from '../screens/bills/BillDetailScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import AddFriendScreen from '../screens/friends/AddFriendScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const AuthStackNavigator = createNativeStackNavigator<AuthStackParamList>();

const AuthStack = () => (
  <AuthStackNavigator.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <AuthStackNavigator.Screen
      name="Login"
      component={LoginScreen}
    />
    <AuthStackNavigator.Screen
      name="Signup"
      component={SignupScreen}
    />
  </AuthStackNavigator.Navigator>
);

const MainTabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.gray600,
      tabBarStyle: {
        paddingBottom: 5,
        height: 60,
        borderTopColor: COLORS.gray200,
        borderTopWidth: 1,
      },
    }}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{
        tabBarLabel: 'Dashboard',
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Friends"
      component={FriendsScreen}
      options={{
        tabBarLabel: 'Friends',
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name="account-group" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Groups"
      component={GroupsScreen}
      options={{
        tabBarLabel: 'Groups',
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name="folder-account" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Activity"
      component={ActivityScreen}
      options={{
        tabBarLabel: 'Activity',
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name="bell" size={size} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name="account" size={size} color={color} />
        ),
      }}
    />
  </Tab.Navigator>
);

const MainStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.primary,
      },
      headerTintColor: COLORS.white,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerBackTitle: 'Back',
    }}
  >
    <Stack.Screen
      name="MainTabs"
      component={MainTabNavigator}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="CreateBill"
      component={CreateBillScreen}
      options={({ route }) => ({
        title: route?.params?.bill ? 'Edit Bill' : 'Create Bill',
        presentation: 'modal',
      })}
    />
    <Stack.Screen
      name="BillDetail"
      component={BillDetailScreen}
      options={{
        title: 'Bill Details',
      }}
    />
    <Stack.Screen
      name="CreateGroup"
      component={CreateGroupScreen}
      options={({ route }) => ({
        title: route?.params?.group ? 'Edit Group' : 'Create Group',
        presentation: 'modal',
      })}
    />
    <Stack.Screen
      name="GroupDetail"
      component={GroupDetailScreen}
      options={{
        title: 'Group Details',
      }}
    />
    <Stack.Screen
      name="AddFriend"
      component={AddFriendScreen}
      options={{
        title: 'Add Friend',
        presentation: 'modal',
      }}
    />
    <Stack.Screen
      name="Payment"
      component={PaymentScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="EditProfile"
      component={EditProfileScreen}
      options={{
        headerShown: false,
      }}
    />
  </Stack.Navigator>
);

// Linking configuration to prevent deep link parsing issues
const linking = {
  prefixes: [],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: 'dashboard',
          Friends: 'friends',
          Groups: 'groups',
          Activity: 'activity',
          Profile: 'profile',
        },
      },
      CreateBill: 'create-bill',
      BillDetail: 'bill/:billId',
      CreateGroup: 'create-group',
      GroupDetail: 'group/:groupId',
      AddFriend: 'add-friend',
      Login: 'login',
      Signup: 'signup',
    },
  },
};

export const AppNavigator = () => {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const { isLoading, user } = authContext;

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      linking={linking}
      fallback={<ActivityIndicator size="large" color={COLORS.primary} />}
      documentTitle={{
        enabled: false,
      }}
    >
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};
