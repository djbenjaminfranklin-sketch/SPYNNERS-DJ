---
name: native-ios-integration
description: Integration native iOS pour React Native/Expo
globs: ["**/ios/**/*", "**/*.swift", "**/*.m"]
---

# Integration Native iOS - SPYNNERS

## EAS Build Configuration

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
        "resourceClass": "m1-medium"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m1-large"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "email@example.com",
        "ascAppId": "123456789"
      }
    }
  }
}
```

### app.json iOS Config
```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.spynners.app",
      "buildNumber": "60",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "SPYNNERS a besoin du micro pour enregistrer vos sets DJ",
        "UIBackgroundModes": ["audio", "fetch", "remote-notification"],
        "ITSAppUsesNonExemptEncryption": false
      },
      "entitlements": {
        "com.apple.developer.associated-domains": [
          "applinks:spynners.app"
        ]
      },
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
```

## Modules Natifs Custom

### Bridge Swift vers React Native
```swift
// ios/SpynnersModule.swift
import Foundation
import React

@objc(SpynnersModule)
class SpynnersModule: NSObject {

  @objc
  func constantsToExport() -> [String: Any] {
    return [
      "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
      "buildNumber": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
    ]
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func getAudioSession(_ resolve: @escaping RCTPromiseResolveBlock,
                       reject: @escaping RCTPromiseRejectBlock) {
    do {
      let session = AVAudioSession.sharedInstance()
      resolve([
        "category": session.category.rawValue,
        "sampleRate": session.sampleRate,
        "outputLatency": session.outputLatency
      ])
    } catch {
      reject("ERROR", "Could not get audio session", error)
    }
  }
}
```

### Header Bridge
```objc
// ios/SpynnersModule.m
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SpynnersModule, NSObject)

RCT_EXTERN_METHOD(getAudioSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
```

### Usage TypeScript
```typescript
// src/native/SpynnersModule.ts
import { NativeModules, Platform } from 'react-native';

const { SpynnersModule } = NativeModules;

interface AudioSessionInfo {
  category: string;
  sampleRate: number;
  outputLatency: number;
}

export async function getAudioSession(): Promise<AudioSessionInfo | null> {
  if (Platform.OS !== 'ios') return null;
  return SpynnersModule.getAudioSession();
}

export const APP_VERSION = SpynnersModule?.appVersion ?? '1.0.0';
export const BUILD_NUMBER = SpynnersModule?.buildNumber ?? '1';
```

## Config Plugins Expo

### Plugin Custom
```javascript
// plugins/withAudioConfig.js
const { withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withAudioConfig(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIBackgroundModes = [
      ...(config.modResults.UIBackgroundModes || []),
      'audio',
    ];
    return config;
  });

  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.associated-domains'] = [
      'applinks:spynners.app',
    ];
    return config;
  });

  return config;
};
```

### Usage dans app.json
```json
{
  "expo": {
    "plugins": [
      "./plugins/withAudioConfig.js",
      [
        "expo-av",
        {
          "microphonePermission": "SPYNNERS a besoin du micro pour enregistrer vos sets DJ"
        }
      ],
      [
        "react-native-track-player",
        {
          "capabilities": ["play", "pause", "skipToNext", "skipToPrevious", "seekTo"]
        }
      ]
    ]
  }
}
```

## Commandes Build

```bash
# Dev client avec simulateur
eas build --platform ios --profile development

# Preview pour TestFlight interne
eas build --platform ios --profile preview

# Production pour App Store
eas build --platform ios --profile production

# Build local (necessite Xcode)
npx expo prebuild --clean
npx expo run:ios --device

# Submit vers App Store
eas submit --platform ios --profile production
```

## Debugging Natif

```bash
# Ouvrir dans Xcode
open ios/SpynnersLive.xcworkspace

# Logs simulateur
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "Spynners"'

# Profiler
instruments -t "Time Profiler" -D output.trace
```

## Checklist Release iOS

- [ ] Increment buildNumber dans app.json
- [ ] Verifier les permissions Info.plist
- [ ] Tester sur device physique
- [ ] Screenshots App Store a jour
- [ ] Release notes preparees
- [ ] Certificats et provisioning valides
