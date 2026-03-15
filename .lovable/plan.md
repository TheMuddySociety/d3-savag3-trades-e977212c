

# Plan: Remove Phantom QR, DNS Note, Generate Assets & Logo

## Step 1 — Remove Phantom Connect SDK

Remove all `@phantom/react-sdk` references:

- **`src/App.tsx`**: Remove `PhantomProvider` wrapper and its import. Keep all other providers intact.
- **`src/pages/Landing.tsx`**: Remove `PhantomQRConnect` import and usage (line 83).
- **`src/components/layout/MobileHeader.tsx`**: Remove `PhantomQRConnect` import and usage (line 54).
- **`src/components/wallet/PhantomQRConnect.tsx`**: Delete this file.
- **`package.json`**: Remove `@phantom/react-sdk` dependency.

Jupiter's `UnifiedWalletButton` remains the sole wallet connection method.

## Step 2 — Phantom Domain Verification (User Action)

This requires adding a DNS TXT record on your domain. Since `memebot-profit-finder.lovable.app` is a Lovable subdomain, **you cannot add TXT records to it** — DNS for `*.lovable.app` is managed by Lovable. You have two options:

1. **Use a custom domain** — connect your own domain to the Lovable project, then add the TXT record there.
2. **Use the published URL as-is** — Phantom may accept just the origin URL in their allowed origins without the TXT challenge if it's already added (which it is).

No code changes needed for this step.

## Step 3 — Generate Splash Screen & App Icon

Create a backend function that uses Lovable AI image generation (`google/gemini-3.1-flash-image-preview`) to produce:

- A **1024x1024 app icon** — the savag3bot beast head logo on a `#0A0A0B` background, suitable for Android adaptive icons and iOS App Store.
- A **2732x2732 splash screen** — centered savag3bot logo on `#0A0A0B` background.

These will be generated via an edge function, displayed in-app for download, and the user can then place them in `resources/` for `cordova-res`.

## Step 4 — Generate "D3 SAVAG3 Ai" Logo & Dark Banner

Using the same AI image generation approach, create:

- A **clean "D3 SAVAG3 Ai" logo** — black/red/white/dark grey color palette, professional style matching the existing beast head branding. Square format for Phantom dashboard and general use.
- A **dark banner** — wide format (e.g. 1500x500), same color palette, suitable for social/branding use.

Both assets will be generated and stored in file storage for download.

## Implementation Approach for Steps 3 & 4

Create a single edge function `generate-brand-assets` that:
1. Accepts a prompt parameter (icon/splash/logo/banner)
2. Calls Lovable AI with the image generation model
3. Uploads the resulting base64 image to storage
4. Returns the public URL

Create a simple admin-accessible page/dialog to trigger generation and download the assets.

## File Summary

| File | Action |
|------|--------|
| `src/App.tsx` | Remove PhantomProvider wrapper |
| `src/pages/Landing.tsx` | Remove PhantomQRConnect |
| `src/components/layout/MobileHeader.tsx` | Remove PhantomQRConnect |
| `src/components/wallet/PhantomQRConnect.tsx` | Delete |
| `package.json` | Remove `@phantom/react-sdk` |
| `supabase/functions/generate-brand-assets/index.ts` | New — AI image generation |
| `src/components/admin/BrandAssetGenerator.tsx` | New — UI to generate & download assets |
| `src/pages/Admin.tsx` | Add BrandAssetGenerator section |

