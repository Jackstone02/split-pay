// src/screens/FriendsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Contacts from 'react-native-contacts'; // Import the library
import ApiService from '../ApiService';

interface Friend {
	id: number;
	name: string;
	username: string;
	status: string;
	imageUrl: string; // Assuming each friend has an image URL
}

const FriendsScreen: React.FC = () => {
	const [friends, setFriends] = useState<Friend[]>([]);

	useEffect(() => {
		const fetchFriends = async () => {
			try {
				const friendsData = await ApiService.getFriends();
				setFriends(friendsData);
			} catch (error) {
				// Handle error
			}
		};

		fetchFriends();
	}, []);

	const handleAddFriend = async () => {
		try {
			const newFriend = await selectContact();
			if (newFriend) {
				setFriends((prevFriends) => [...prevFriends, newFriend]);
			}
		} catch (error) {
			// Handle error
		}
	};

	// Function to open contacts picker
	const selectContact = async (): Promise<Friend | null> => {
		return new Promise((resolve, reject) => {
			Contacts.getAll()
			.then((contacts) => {
				// Process contacts and allow the user to select one
				// For simplicity, just pick the first contact in this example
				const selectedContact = contacts[0];
				if (selectedContact) {
					const newFriend: Friend = {
						id: friends.length + 1,
						name: `${selectedContact.givenName} ${selectedContact.familyName}`,
						username: selectedContact.emailAddresses[0]?.email || '',
						status: 'Online', // Default status
						imageUrl: selectedContact.thumbnailPath || '', // Image URL, assuming the contact has an image
					};
					resolve(newFriend);
				} else {
					// If no contact is available
					resolve(null);
				}
			})
			.catch((error) => {
				reject(error);
			});
		});
	};


	return (
		<View style={styles.container}>
			<Text style={styles.heading}>Friends Screen</Text>
			<TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
				<Text style={styles.addButtonText}>Add Friend</Text>
			</TouchableOpacity>
			<FlatList
				data={friends}
				keyExtractor={(item) => item.id.toString()}
				renderItem={({ item }) => (
					<View style={styles.friendContainer}>
						<Image source={{ uri: item.imageUrl }} style={styles.friendImage} />
						<View style={styles.friendTextContainer}>
							<Text style={styles.friendName}>{item.name}</Text>
							<Text>{item.username}</Text>
							<Text>Status: {item.status}</Text>
						</View>
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
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 16,
	},
	addButton: {
		backgroundColor: '#4CAF50',
		padding: 10,
		borderRadius: 8,
		marginBottom: 16,
	},
	addButtonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: 'bold',
	},
	friendContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		backgroundColor: '#e0e0e0',
		padding: 16,
		marginBottom: 16,
		borderRadius: 8,
	},
	friendImage: {
		width: 50,
		height: 50,
		borderRadius: 25, // Assuming a circular profile picture
		marginRight: 16,
	},
	friendTextContainer: {
		flex: 1,
	},
	friendName: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 8,
	},
});

export default FriendsScreen;
