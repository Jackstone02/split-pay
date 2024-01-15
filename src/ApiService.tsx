// src/ApiService.ts
import axios from 'axios';

const BASE_URL = ' http://192.168.1.3:19000'; // Assuming your API server is running locally on this port

const ApiService = {
	getGroups: async () => {
		try {
			// const response = await axios.get(`${BASE_URL}/groups.json`);
			// return response.data.groups;
			const group = [
				{
					"id": 1,
					"name": "Tech Enthusiasts",
					"members": 120
				},
				{
					"id": 2,
					"name": "Fitness Buddies",
					"members": 80
				},
				{
					"id": 3,
					"name": "Book Club",
					"members": 45
				},
				{
					"id": 4,
					"name": "Travel Lovers",
					"members": 60
				}
			];

			return group;

		} catch (error) {
			console.error('Error fetching groups:', error);
			throw error;
		}
	},
	getFriends: async () => {
		try {
			// const response = await axios.get(`${BASE_URL}/friends.json`);
			// return response.data.friends;
			const friends = [
				{
					"id": 1,
					"name": "John Doe",
					"username": "john_doe",
					"status": "Online",
					"imageUrl": "https://icons.veryicon.com/png/o/education-technology/test-website-linear-icon/user-147.png"
				},
				{
					"id": 2,
					"name": "Jane Smith",
					"username": "jane_smith",
					"status": "Offline",
					"imageUrl": "https://icons.veryicon.com/png/o/education-technology/test-website-linear-icon/user-147.png"
				}
			];

			return friends;

		} catch (error) {
			console.error('Error fetching friends:', error);
			throw error;
		}
	}
};

export default ApiService;
