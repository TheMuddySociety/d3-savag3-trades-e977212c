# Native App Setup Guide

## 1. Deep Linking (Wallet Redirects)

After running `npx cap add android`, you need to add the deep link intent filter.

### Android — `android/app/src/main/AndroidManifest.xml`

Inside the `<activity>` tag for `MainActivity`, add this intent filter:

```xml
<!-- Deep link for wallet redirects (Phantom, Solflare) -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="savag3bot" />
</intent-filter>
```

The full `<activity>` section should look like:

```xml
<activity
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
    android:name=".MainActivity"
    android:label="@string/title_activity_main"
    android:theme="@style/AppTheme.NoActionBar"
    android:launchMode="singleTask"
    android:exported="true">

    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- Deep link for wallet redirects -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="savag3bot" />
    </intent-filter>
</activity>
```

> **Important**: Set `android:launchMode="singleTask"` so deep links reopen the existing app instance instead of creating a new one.

### iOS — `ios/App/App/Info.plist`

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>app.lovable.4df7c074d81a42c29a725460ace25b53</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>savag3bot</string>
        </array>
    </dict>
</array>
```

### Testing Deep Links

```bash
# Android
adb shell am start -a android.intent.action.VIEW -d "savag3bot://callback?test=1"

# iOS
xcrun simctl openurl booted "savag3bot://callback?test=1"
```

---

## 2. Splash Screen

The splash screen is configured in `capacitor.config.json` with a dark background (#0A0A0B) matching the app theme.

### Generate Splash Assets

1. Place a **2732×2732** splash image at `resources/splash.png` (centered logo on `#0A0A0B` background)
2. Run:
   ```bash
   npx cordova-res --splash-only --copy
   ```

This generates all required sizes for Android (`drawable-*`) and iOS (storyboard assets).

### Manual Placement (Alternative)

- **Android**: Place splash images in `android/app/src/main/res/drawable-*/splash.png`
  - `drawable-land-hdpi`: 800×480
  - `drawable-land-mdpi`: 480×320
  - `drawable-land-xhdpi`: 1280×720
  - `drawable-land-xxhdpi`: 1600×960
  - `drawable-land-xxxhdpi`: 1920×1280
  - `drawable-port-hdpi`: 480×800
  - `drawable-port-mdpi`: 320×480
  - `drawable-port-xhdpi`: 720×1280
  - `drawable-port-xxhdpi`: 960×1600
  - `drawable-port-xxxhdpi`: 1280×1920
- **iOS**: Capacitor uses a storyboard-based splash by default

---

## 3. App Icons

### Generate Icon Assets

1. Place a **1024×1024** icon at `resources/icon.png` (the existing `public/savag3bot-logo.png` can be used as source)
2. Run:
   ```bash
   npx cordova-res --icon-only --copy
   ```

This generates all platform-specific icon sizes.

### Manual Placement

- **Android** (Adaptive Icons):
  - `android/app/src/main/res/mipmap-*/ic_launcher.png`
  - `android/app/src/main/res/mipmap-*/ic_launcher_round.png`
  - `android/app/src/main/res/mipmap-*/ic_launcher_foreground.png`
  - Background: Set in `android/app/src/main/res/values/ic_launcher_background.xml` to `#0A0A0B`
- **iOS**:
  - `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (1024×1024 for App Store)

### Android Adaptive Icon Background

Edit `android/app/src/main/res/values/ic_launcher_background.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A0A0B</color>
</resources>
```

---

## 4. Phantom Wallet Setup

Add `savag3bot://auth/callback` to your Phantom Developer Dashboard redirect URLs:
1. Go to [Phantom Developer Dashboard](https://developer.phantom.app)
2. Select your app (ID: `f3e1137b-609c-4f5e-91d7-c76a3e4f9f7d`)
3. Add `savag3bot://auth/callback` under **Redirect URLs**

---

## 5. Build & Deploy

```bash
# Install dependencies
npm install

# Build the web app
npm run build

# Sync to native platforms
npx cap sync

# Run on device/emulator
npx cap run android   # Requires Android Studio
npx cap run ios       # Requires Xcode (Mac only)
```

> **Production**: Remove the `server.url` from `capacitor.config.json` before building a release APK/IPA to bundle the web app locally.
