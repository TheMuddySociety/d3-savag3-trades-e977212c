{{QR Code is for Jupite Mobile NOT Phantom Wallet.

# Plan: Mobile Wallet QR Code, Splash Screen & App Icons

## Overview

Three additions to the native mobile build: (1) Phantom Connect SDK for QR-code-based wallet connections on mobile, (2) Capacitor splash screen plugin configuration, and (3) app icon assets and configuration.

---

## 1. Phantom Connect SDK with QR Code Support

The user provided their Phantom Developer App ID (`f3e1137b-609c-4f5e-91d7-c76a3e4f9f7d`). The `@phantom/react-sdk` will be added as an alternative connection method that provides QR code scanning for mobile users who have Phantom on a different device.

**Changes:**

- Install `@phantom/react-sdk`
- Wrap the app with `PhantomProvider` (inside existing providers in `App.tsx`), configured with the App ID and `savag3bot` deep link scheme
- Create a `PhantomQRConnect` component that shows a "Connect via QR" button using Phantom's modal — this gives mobile users a scannable QR code
- Add the QR connect option to the Landing page and MobileHeader as a secondary connection method alongside the existing Jupiter `UnifiedWalletButton`
- Add `savag3bot://auth/callback` to the Phantom dashboard redirect URLs (user action)

## 2. Splash Screen Configuration

**Changes:**

- Install `@capacitor/splash-screen`
- Update `capacitor.config.json` with splash screen plugin settings (auto-hide delay, fade duration, background color matching the dark theme `#0A0A0B`)
- Create `resources/` directory documentation with required asset specs:
  - Android: `splash.png` (2732×2732 centered logo on dark background)
  - iOS: storyboard-based splash (Capacitor default)
- Add a guide section to `DEEP_LINKING_SETUP.md` for generating splash assets with `cordova-res` or manually

## 3. App Icon Configuration

**Changes:**

- Update `capacitor.config.json` with proper app display name "SAVAG3BOT"
- Document required icon assets in `DEEP_LINKING_SETUP.md`:
  - Android: `resources/android/icon/` — adaptive icons (foreground + background layers)
  - iOS: `resources/ios/icon/` — 1024×1024 App Store icon
- Provide a `cordova-res` command to auto-generate all sizes from a single `resources/icon.png` (1024×1024) source file
- The existing `public/savag3bot-logo.png` can be used as the source icon

## 4. File Summary


| File                                         | Action                                               |
| -------------------------------------------- | ---------------------------------------------------- |
| `package.json`                               | Add `@phantom/react-sdk`, `@capacitor/splash-screen` |
| `src/App.tsx`                                | Wrap with `PhantomProvider`                          |
| `src/components/wallet/PhantomQRConnect.tsx` | New — QR connect button component                    |
| `src/pages/Landing.tsx`                      | Add QR connect option                                |
| `src/components/layout/MobileHeader.tsx`     | Add QR connect option                                |
| `capacitor.config.json`                      | Add SplashScreen plugin config, update appName       |
| `DEEP_LINKING_SETUP.md`                      | Add splash screen & icon generation instructions     |


## 5. User Actions Required After Implementation

- Add `savag3bot://auth/callback` to Phantom dashboard redirect URLs
- Run `npm install && npx cap sync` after pulling
- Place a 1024×1024 icon source at `resources/icon.png` and run `npx cordova-res` to generate all platform sizes
- Place a 2732×2732 splash source at `resources/splash.png` and run `npx cordova-res`