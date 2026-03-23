/**
 * Platform-wide configuration constants
 */

function getDefaultRpcUrl(): string {
  // Check for user-configured custom RPC
  try {
    const saved = localStorage.getItem("custom_api_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.useCustomRpc && parsed.customRpc) {
        return parsed.customRpc;
      }
    }
  } catch {}

  // Default to public Solana RPC
  return "https://api.mainnet-beta.solana.com";
}

export const PLATFORM_CONFIG = {
  /**
   * The public key of the platform-governed wallet used for bot trades and deposits.
   */
  WALLET_ADDRESS: "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z",
  
  /**
   * RPC URL for Solana connection — uses user's custom RPC if configured
   */
  get RPC_URL() {
    return getDefaultRpcUrl();
  },
  
  /**
   * USDC Mint Address on Solana
   */
  USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",

  /**
   * SOL Mint Address (Native Wrapped)
   */
  SOL_MINT: "So11111111111111111111111111111111111111112",

  /**
   * Jupiter API base URL — uses QuickNode Metis if configured, else public v6
   */
  get JUPITER_API_BASE() {
    try {
      const saved = localStorage.getItem("custom_api_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.useCustomJupiter && parsed.jupiterApiKey) {
          return "https://quote-api.jup.ag/v6";
        }
      }
    } catch {}
    return "https://quote-api.jup.ag/v6";
  },
};

