---
name: expo-development
description: Guide de developpement Expo pour SPYNNERS. Configuration, builds, et deployment.
allowed-tools: Read, Bash, Glob, Grep
---

# Expo Development Guide - SPYNNERS

## Configuration Projet

### app.json
```json
{
  "expo": {
    "name": "SPYNNERS Live",
    "slug": "spynners-dj",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0a0a"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.spynners.live",
      "buildNumber": "60",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "SPYNNERS needs microphone access for DJ recording",
        "NSCameraUsageDescription": "SPYNNERS needs camera access for photos",
        "NSLocationWhenInUseUsageDescription": "SPYNNERS uses your location for the DJ Radar",
        "NSPhotoLibraryUsageDescription": "SPYNNERS needs access to save recordings"
      }
    },
    "android": {
      "package": "com.spynners.live",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0a0a0a"
      },
      "permissions": [
        "RECORD_AUDIO",
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-localization",
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "15.0"
          },
          "android": {
            "minSdkVersion": 24,
            "compileSdkVersion": 34,
            "targetSdkVersion": 34
          }
        }
      ]
    ]
  }
}
```

### eas.json
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-id"
      }
    }
  }
}
```

## Commandes de Developpement

### Developpement Local
```bash
# Demarrer le serveur de dev
npx expo start

# Demarrer avec tunnel (utile pour devices externes)
npx expo start --tunnel

# Demarrer pour plateforme specifique
npx expo start --ios
npx expo start --android

# Nettoyer le cache Metro
npx expo start --clear
```

### Builds EAS
```bash
# Build de developpement (simulator)
eas build --platform ios --profile development

# Build preview (device reel)
eas build --platform ios --profile preview

# Build production
eas build --platform ios --profile production

# Build local (sans cloud)
eas build --platform ios --profile development --local
```

### Prebuild Natif
```bash
# Generer les dossiers natifs
npx expo prebuild

# Regenerer proprement
npx expo prebuild --clean

# Run sur device/simulator
npx expo run:ios
npx expo run:android
```

## Metro Configuration

### metro.config.js
```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optimisations
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx'];
config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
  mangle: {
    keep_classnames: true,
    keep_fnames: true,
  },
};

// Cache stable
config.cacheStores = [];

module.exports = config;
```

## Variables d'Environnement

### .env
```bash
EXPO_PUBLIC_BASE44_APP_ID=691a4d96d819355b52c063f3
EXPO_PUBLIC_BACKEND_URL=https://trackmix-6.preview.emergentagent.com
EXPO_PUBLIC_ACR_HOST=identify-eu-west-1.acrcloud.com
```

### Utilisation
```typescript
// Acces aux variables
const apiUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

// Alternative avec expo-constants
import Constants from 'expo-constants';
const appId = Constants.expoConfig?.extra?.appId;
```

## Debugging

### React DevTools
```bash
# Dans un terminal separe
npx react-devtools
```

### Flipper
```bash
# Installer Flipper depuis https://fbflipper.com/
# Puis dans l'app:
npx expo start --dev-client
```

### Logs Natifs
```bash
# iOS
npx react-native log-ios

# Android
npx react-native log-android
adb logcat *:S ReactNative:V ReactNativeJS:V
```

## Over-The-Air Updates

### Configuration EAS Update
```bash
# Configurer EAS Update
eas update:configure

# Publier une mise a jour
eas update --branch production --message "Bug fix"

# Verifier les updates
eas update:list
```

## Troubleshooting

### Problemes Courants

#### Pod Install Echoue
```bash
cd ios
pod deintegrate
pod cache clean --all
pod install
```

#### Metro Cache Corrompu
```bash
npx expo start --clear
# ou
rm -rf node_modules/.cache
watchman watch-del-all
```

#### Build iOS Echoue
```bash
# Nettoyer build Xcode
cd ios
xcodebuild clean
cd ..
npx expo prebuild --clean
```

#### Android Gradle Issues
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```
