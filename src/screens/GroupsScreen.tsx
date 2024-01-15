// src/screens/GroupsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import ApiService from '../ApiService';

interface Group {
	id: number;
	name: string;
	members: number;
}

const GroupsScreen: React.FC = () => {
  	const [groups, setGroups] = useState<Group[]>([]);

  	useEffect(() => {
		const fetchGroups = async () => {
			try {
				const groupsData = await ApiService.getGroups();
				setGroups(groupsData);
			} catch (error) {
				// Handle error
			}
		};

    	fetchGroups();
	}, []);

	return (
		<View style={styles.container}>
			<Text style={styles.heading}>Overall, you are owed PHP0.00</Text>
			<FlatList
				data={groups}
				keyExtractor={(item) => item.id.toString()}
				renderItem={({ item }) => (
					<View style={styles.groupContainer}>
						<Text style={styles.groupName}>{item.name}</Text>
						<Text>Members: {item.members}</Text>
					</View>
				)}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
	},
	heading: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 16,
	},
	groupContainer: {
		width: '100%', // Make the item full-width
		backgroundColor: '#e0e0e0',
		padding: 16,
		marginBottom: 16,
		borderRadius: 8,
	},
	groupName: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 8,
	},
});

export default GroupsScreen;
