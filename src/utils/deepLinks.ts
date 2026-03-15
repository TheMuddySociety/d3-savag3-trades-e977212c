import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Initialize deep link handling for native mobile apps.
 * Phantom/Solflare redirect back via savag3bot:// scheme after signing.
 * 
 * Call this once in your app entry point (e.g., main.tsx or App.tsx).
 */
export function initDeepLinks() {
  if (!Capacitor.isNativePlatform()) return;

  // Handle app opened via deep link
  CapApp.addListener("appUrlOpen", ({ url }) => {
    console.log("[DeepLink] Opened with URL:", url);

    try {
      const parsed = new URL(url);

      // Handle wallet redirect callbacks
      // Phantom uses: savag3bot://onConnect, savag3bot://onSignAndSendTransaction, etc.
      // Solflare uses similar patterns
      if (parsed.protocol === "savag3bot:") {
        const params = new URLSearchParams(parsed.search || parsed.hash?.slice(1));

        // If there's an errorCode, the user rejected
        const errorCode = params.get("errorCode");
        if (errorCode) {
          console.warn("[DeepLink] Wallet returned error:", errorCode, params.get("errorMessage"));
          window.dispatchEvent(
            new CustomEvent("walletDeepLinkError", {
              detail: { errorCode, errorMessage: params.get("errorMessage") },
            })
          );
          return;
        }

        // Dispatch success event with all params for wallet adapters to handle
        window.dispatchEvent(
          new CustomEvent("walletDeepLinkSuccess", {
            detail: {
              path: parsed.hostname || parsed.pathname,
              params: Object.fromEntries(params.entries()),
              rawUrl: url,
            },
          })
        );
      }
    } catch (err) {
      console.error("[DeepLink] Failed to parse URL:", url, err);
    }
  });

  // Handle app restored from background (state restore)
  CapApp.addListener("appRestoredResult", (data) => {
    console.log("[DeepLink] App restored:", data);
  });
}

/**
 * Returns the deep link redirect URI for wallet connections.
 * Use this when constructing Phantom/Solflare connect URLs.
 */
export function getWalletRedirectUri(action: string = "callback"): string {
  if (Capacitor.isNativePlatform()) {
    return `savag3bot://${action}`;
  }
  // Web fallback — current page URL
  return window.location.href;
}
