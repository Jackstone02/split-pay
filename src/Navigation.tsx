// src/Navigation.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import GroupsScreen from './screens/GroupsScreen';
import FriendsScreen from './screens/FriendsScreen';
import AccountScreen from './screens/AccountScreen';

const Tab = createBottomTabNavigator();

const Navigation: React.FC = () => {
	return (
		<NavigationContainer>
			<Tab.Navigator
				screenOptions={({ route }) => ({
					tabBarIcon: ({ color, size }) => {
						let iconName;

						switch (route.name) {
							case 'Home':
								iconName = 'home';
								break;
							case 'Groups':
								iconName = 'group';
								break;
							case 'Friends':
								iconName = 'people';
								break;
							case 'Account':
								iconName = 'account-circle';
								break;
							default:
								iconName = 'error';
						}

						return <MaterialIcons name={iconName} size={size} color={color} />;
					},
					})}
			>
				<Tab.Screen name="Home" component={HomeScreen} />
				<Tab.Screen name="Groups" component={GroupsScreen} />
				<Tab.Screen name="Friends" component={FriendsScreen} />
				<Tab.Screen name="Account" component={AccountScreen} />
			</Tab.Navigator>
		</NavigationContainer>
	);
};

export default Navigation;
