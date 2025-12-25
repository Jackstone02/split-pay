# Amot - Bill Splitting App

A modern, mobile-first React Native app for splitting bills among friends and groups with ease. Amot makes it simple to manage shared expenses and track who owes whom.

## Features

✨ **Core Features**
- 🔐 Full authentication system (signup/login)
- 💰 Create and manage bills
- 👥 Add multiple participants
- 📊 4 different splitting methods:
  - **Equal Split**: Divide equally among all participants
  - **Custom Amounts**: Manually specify amounts for each person
  - **Percentage Split**: Assign percentages (must total 100%)
  - **Item-Based**: Assign specific items to participants
- 💳 Track payment status (who paid, who still owes)
- 📈 View summary of total owed and owing
- 📱 Responsive, modern UI with intuitive navigation

## Tech Stack

- **Framework**: React Native + Expo
- **Language**: TypeScript
- **State Management**: React Context API
- **Navigation**: React Navigation v6
- **UI Components**: React Native Paper
- **Storage**: AsyncStorage (mock data persistence)
- **Icons**: Material Community Icons

## Prerequisites

Before getting started, make sure you have the following installed:

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Expo CLI** (optional but recommended) - Install via:
  ```bash
  npm install -g expo-cli
  ```
- **Expo Go App** - Download from [App Store](https://apps.apple.com/app/expo-go/id982107779) or [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Installation

### 1. Clone or Navigate to Project

```bash
cd amot
```

### 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

> **Note**: The `--legacy-peer-deps` flag is required due to peer dependency compatibility between Expo 51 and @expo/webpack-config. This is a temporary solution until all packages update their peer dependency constraints.

Or if you're using yarn:

```bash
yarn install
```

### 3. Start the Development Server

```bash
npm start
```

or with yarn:

```bash
yarn start
```

This will start the Expo development server and display a QR code in your terminal.

## Running the App

### On Your Phone (Recommended)

1. **Using Expo Go**:
   - Install Expo Go on your iOS or Android device
   - Scan the QR code shown in your terminal
   - The app will load on your device

2. **Manual Setup**:
   - Follow the on-screen instructions after running `npm start`
   - Press `i` for iOS (macOS only) or `a` for Android

### On an Emulator/Simulator

**For Android:**
```bash
npm run android
```

**For iOS (macOS only):**
```bash
npm run ios
```

### On Web (Limited functionality)
```bash
npm run web
```

## Demo Credentials

The app comes with pre-populated demo accounts for testing:

| Email | Password |
|-------|----------|
| john@example.com | any 6+ chars |
| jane@example.com | any 6+ chars |
| mike@example.com | any 6+ chars |
| sarah@example.com | any 6+ chars |

You can also create a new account using the signup screen.

## Project Structure

```
amot/
├── App.tsx                          # Entry point
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── app.json                         # Expo config
├── babel.config.js                  # Babel config
└── src/
    ├── navigation/
    │   └── AppNavigator.tsx        # Navigation structure
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.tsx      # Login screen
    │   │   └── SignupScreen.tsx     # Signup screen
    │   ├── bills/
    │   │   ├── DashboardScreen.tsx  # Main dashboard
    │   │   ├── CreateBillScreen.tsx # Create bill form
    │   │   └── BillDetailScreen.tsx # Bill details & payments
    │   └── profile/
    │       └── ProfileScreen.tsx    # User profile & stats
    ├── components/                  # Reusable components
    ├── context/
    │   ├── AuthContext.tsx          # Auth state management
    │   └── BillContext.tsx          # Bill state management
    ├── services/
    │   └── mockApi.ts              # Mock API endpoints
    ├── utils/
    │   ├── calculations.ts          # Split calculations
    │   └── storage.ts              # AsyncStorage utilities
    ├── types/
    │   └── index.ts                # TypeScript types
    └── constants/
        └── theme.ts                # Colors & styling
```

## Key Screens

### 1. **Login Screen** (`LoginScreen.tsx`)
- Email and password input
- Demo credentials display
- Link to signup
- Error handling and validation

### 2. **Signup Screen** (`SignupScreen.tsx`)
- Full name, email, and password fields
- Password confirmation
- Email validation and duplicate checking
- Secure password requirements (6+ characters)

### 3. **Dashboard Screen** (`DashboardScreen.tsx`)
- View all your bills
- Summary cards showing:
  - Total owed (money you paid for others)
  - Total owing (money you still owe)
  - Current balance
- Pull-to-refresh functionality
- Quick access to create new bill (FAB button)

### 4. **Create Bill Screen** (`CreateBillScreen.tsx`)
- Bill title and amount input
- Add participants from your contacts
- Choose split method
- Custom amount/percentage input based on method
- Real-time validation of amounts/percentages

### 5. **Bill Detail Screen** (`BillDetailScreen.tsx`)
- View complete bill information
- See how the bill was split
- Track payment status
- Mark payments as paid/unpaid
- Delete bills you created
- View participant details

### 6. **Profile Screen** (`ProfileScreen.tsx`)
- View user information
- See financial summary:
  - Total owed and owing
  - Amount settled
  - Current balance
- Account settings
- Logout functionality

## API Endpoints (Mock)

The app uses mock APIs stored in `src/services/mockApi.ts`. All data persists locally using AsyncStorage.

### Authentication
- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login existing user
- `POST /auth/logout` - Logout

### Users
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `GET /users/search?q=query` - Search users

### Bills
- `GET /bills` - Get all bills
- `POST /bills` - Create new bill
- `GET /bills/:id` - Get bill details
- `PUT /bills/:id` - Update bill
- `DELETE /bills/:id` - Delete bill

### Payments
- `PUT /bills/:id/payments/:index` - Mark payment as paid/unpaid
- `GET /users/:id/summary` - Get user financial summary

## Split Calculation Examples

### Equal Split
**Total: $120 | Participants: 3 (You, John, Jane)**
- You: $40
- John: $40
- Jane: $40

### Custom Split
**Total: $120 | You pay, then distribute:**
- You: $0
- John: $50
- Jane: $70

### Percentage Split
**Total: $120 | Distribution by percentage:**
- You: 50% = $60
- John: 30% = $36
- Jane: 20% = $24

### Item-Based Split
**Items:**
- Pizza: $30 (You, John, Jane) = $10 each
- Beer: $30 (You, John) = $15 each
- Dessert: $60 (John, Jane) = $30 each
**Results:**
- You: $25
- John: $55
- Jane: $40

## Data Storage

All data is stored locally on your device using AsyncStorage:
- User accounts
- Bills and transactions
- Payment history
- Auth tokens

Data persists even after closing the app. To clear all data, use the "Clear All Data" option in the Profile screen.

## Troubleshooting

### Issue: "Cannot find module" error
**Solution**: Make sure all dependencies are installed:
```bash
npm install
```

### Issue: QR code not scanning
**Solution**:
- Make sure your phone and computer are on the same network
- Try closing Expo Go and scanning again
- Try running `npm start` with `--tunnel` flag:
  ```bash
  npm start -- --tunnel
  ```

### Issue: App crashes on startup
**Solution**:
- Clear your Expo cache: `npm start -- --clear`
- Delete `node_modules` and reinstall:
  ```bash
  rm -rf node_modules
  npm install
  npm start
  ```

### Issue: AsyncStorage not persisting data
**Solution**:
- The app creates mock data on first launch
- If data still doesn't persist, try:
  ```bash
  npm start -- --clear
  ```

### Issue: npm install fails with "ERESOLVE could not resolve"
**Solution**:
- This is due to peer dependency conflicts between Expo 51 and @expo/webpack-config
- Use the `--legacy-peer-deps` flag during installation:
  ```bash
  npm install --legacy-peer-deps
  ```
- If you still get errors, clear npm cache first:
  ```bash
  npm cache clean --force
  rm -rf node_modules package-lock.json
  npm install --legacy-peer-deps
  ```

## Contributing

This is a demo/learning project. Feel free to fork and modify for your own use.

## Future Enhancements

- 🗂️ Bill categories
- 📲 Push notifications for payments
- 🌍 Support for multiple currencies
- 👥 Group management
- 💬 Comments on bills
- 📊 Analytics and charts
- 🔄 Real backend integration (Firebase, Supabase, etc.)
- 📧 Email reminders
- 🖼️ Image attachments
- 🌙 Dark mode

## License

This project is open source and available for personal and educational use.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the code comments for additional context
3. Check the React Native and Expo documentation

---

**Built with ❤️ using React Native and Expo**

Happy bill splitting! 💰
