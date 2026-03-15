# Android Deep Linking Setup

After running `npx cap add android`, you need to add the deep link intent filter.

## Edit `android/app/src/main/AndroidManifest.xml`

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

## For iOS

Edit `ios/App/App/Info.plist` and add:

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

## Testing

On Android, test the deep link with:
```bash
adb shell am start -a android.intent.action.VIEW -d "savag3bot://callback?test=1"
```

On iOS, test with:
```bash
xcrun simctl openurl booted "savag3bot://callback?test=1"
```
