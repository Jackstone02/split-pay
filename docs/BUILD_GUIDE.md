# Amot App - Build Guide

This guide explains how to build an installable APK for your Amot bill-splitting app.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup (One-Time)](#initial-setup-one-time)
- [Building the APK](#building-the-apk)
- [Installing on Your Device](#installing-on-your-device)
- [Updating and Rebuilding](#updating-and-rebuilding)
- [Build Options](#build-options)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you start, make sure you have:
- Node.js installed (v16 or higher)
- npm or yarn package manager
- An Expo account (free) - sign up at https://expo.dev/signup
- Internet connection (builds run on EAS cloud servers)

---

## Initial Setup (One-Time)

You only need to do these steps once:

### 1. Install Dependencies

```bash
npm install
```

### 2. Install EAS CLI Globally

```bash
npm install -g eas-cli
```

### 3. Login to Expo

```bash
eas login
```

Enter your Expo email/username and password when prompted.

### 4. Configure EAS Build

```bash
eas build:configure
```

When prompted:
- "Would you like to automatically create an EAS project?" → Answer **Yes**

This creates an `eas.json` file and links your project to EAS.

---

## Building the APK

### For Android (APK)

Run this command to build an APK:

```bash
eas build -p android --profile preview
```

**What happens:**
1. You'll be asked "Generate a new Android Keystore?" → Answer **Yes** (first time only)
2. EAS uploads your code to cloud servers
3. The build starts (takes 10-20 minutes)
4. You'll see a URL to monitor build progress
5. When complete, you get a download link for the APK

**Example output:**
```
✔ Build completed!
Download URL: https://expo.dev/artifacts/eas/...
```

### For iOS (IPA) - Mac only

```bash
eas build -p ios --profile preview
```

Note: iOS builds require Apple Developer account enrollment ($99/year)

---

## Installing on Your Device

### Android Installation

1. **Download the APK** from the link provided after build completes
2. **Transfer to your phone** (via USB, email, cloud storage, or direct download)
3. **Enable "Install from Unknown Sources"**:
   - Go to Settings → Security → Unknown Sources
   - Or Settings → Apps → Special Access → Install Unknown Apps
4. **Tap the APK file** to install
5. **Open the app** from your app drawer

### iOS Installation

1. Download the IPA file
2. Use tools like Apple Configurator or TestFlight for installation
3. Requires device UDID to be registered in Apple Developer account

---

## Updating and Rebuilding

When you make changes to your app and want to release a new version:

### 1. Update Version Number

Edit `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",  // Increment this
    "android": {
      "versionCode": 2   // Increment this (Android only)
    },
    "ios": {
      "buildNumber": "2"  // Increment this (iOS only)
    }
  }
}
```

### 2. Build Again

```bash
eas build -p android --profile preview
```

### 3. Install New Version

- Users need to uninstall the old version first, OR
- Use the same keystore (automatic with EAS) to allow updates

---

## Build Options

### Build Profiles

Your `eas.json` has different build profiles:

- **preview** - APK for testing (what we're using)
  ```bash
  eas build -p android --profile preview
  ```

- **production** - AAB for Google Play Store
  ```bash
  eas build -p android --profile production
  ```

- **development** - Development build with debugging
  ```bash
  eas build -p android --profile development
  ```

### Local Build (Optional)

To build on your own computer instead of EAS cloud:

```bash
eas build -p android --local
```

Requirements:
- Android Studio installed
- Android SDK configured
- More complex setup

---

## Troubleshooting

### "Build failed" Error

**Check the build logs:**
```bash
eas build:list
```

Click on the failed build to see detailed logs.

**Common issues:**
- Missing dependencies: Run `npm install`
- Incorrect Node version: Use Node 16+
- Network issues: Check internet connection

### "Unable to install APK"

- Enable "Unknown Sources" in Android settings
- Make sure you have enough storage space
- Try redownloading the APK

### "EAS CLI not found"

Reinstall globally:
```bash
npm install -g eas-cli
```

### "Not logged in"

Login again:
```bash
eas login
```

Check login status:
```bash
eas whoami
```

### Build Takes Too Long

- Normal build time: 10-20 minutes
- Check build queue: https://expo.dev/accounts/[your-username]/projects/amot/builds
- Free tier may have longer queue times

---

## Useful Commands

```bash
# Check EAS login status
eas whoami

# List all builds
eas build:list

# View build details
eas build:view [BUILD_ID]

# Cancel a running build
eas build:cancel

# View project configuration
eas config

# Update EAS CLI
npm install -g eas-cli@latest
```

---

## Resources

- EAS Build Documentation: https://docs.expo.dev/build/introduction/
- Expo Forums: https://forums.expo.dev/
- EAS Dashboard: https://expo.dev/accounts/[your-username]/projects/amot
- Submit to Play Store: https://docs.expo.dev/submit/android/

---

## Quick Reference

**First time build:**
```bash
npm install
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

**Subsequent builds:**
```bash
# Update version in app.json
eas build -p android --profile preview
```

**Development testing (with Expo Go):**
```bash
npm start
# Scan QR code with Expo Go app
```

---

## Notes

- **Keystore**: EAS manages your Android keystore automatically. Keep your Expo account secure!
- **Costs**: EAS has free tier with limited builds/month. Check: https://expo.dev/pricing
- **App Store**: For Google Play Store, use production profile (creates AAB file)
- **Updates**: Consider using EAS Update for over-the-air updates without rebuilding

---

Last updated: December 26, 2025
