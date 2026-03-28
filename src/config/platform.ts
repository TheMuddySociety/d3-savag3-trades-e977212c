/**
 * Platform-wide configuration constants
 */

function getDefaultRpcUrl(): string {
  // 1. Check for environment variable (Vite or Deno)
  const envUrl = (typeof process !== 'undefined' && process.env?.CUSTOM_SOLANA_RPC_URL) || 
                 (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CUSTOM_SOLANA_RPC_URL);
  
  if (envUrl) return envUrl;

  // 2. Check for user-configured custom RPC in localStorage (Browser only)
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem("custom_api_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.useCustomRpc && parsed.customRpc) {
          return parsed.customRpc;
        }
      }
    }
  } catch {}

  // 3. Default to public Solana RPC
  return "https://api.mainnet-beta.solana.com";
}

export const PLATFORM_CONFIG = {
  /**
   * The public key of the platform-governed wallet used for bot trades and deposits.
   */
  WALLET_ADDRESS: "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z",
  
  /**
   * Jupiter Referral Account for platform fees
   */
  REFERRAL_ACCOUNT: "89MakU1zuaQKBrtFXXMgGxf8nKZ9Pbq52KtUwgNhCiBS",
  
  /**
   * Jupiter V6 API base URL — can be overridden via CUSTOM_JUPITER_RPC_URL
   */
  get JUPITER_V6_API_URL() {
    const envUrl = (typeof process !== 'undefined' && process.env?.CUSTOM_JUPITER_RPC_URL) || 
                   (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CUSTOM_JUPITER_RPC_URL) ||
                   (typeof Deno !== 'undefined' && Deno.env.get("CUSTOM_JUPITER_RPC_URL"));
    return envUrl || "https://quote-api.jup.ag/v6";
  },

  /**
   * Jupiter V2 Swap API URL — can be overridden via CUSTOM_JUPITER_SWAP_URL
   */
  get JUPITER_V2_API_URL() {
    const envUrl = (typeof process !== 'undefined' && process.env?.CUSTOM_JUPITER_SWAP_URL) || 
                   (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CUSTOM_JUPITER_SWAP_URL) ||
                   (typeof Deno !== 'undefined' && Deno.env.get("CUSTOM_JUPITER_SWAP_URL"));
    return envUrl || "https://api.jup.ag/swap/v2";
  },

  /**
   * Jupiter Ultra API URL — can be overridden via CUSTOM_JUPITER_ULTRA_URL
   */
  get JUPITER_ULTRA_API_URL() {
    const envUrl = (typeof process !== 'undefined' && process.env?.CUSTOM_JUPITER_ULTRA_URL) || 
                   (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CUSTOM_JUPITER_ULTRA_URL) ||
                   (typeof Deno !== 'undefined' && Deno.env.get("CUSTOM_JUPITER_ULTRA_URL"));
    return envUrl || "https://api.jup.ag/ultra/v1";
  },

  /**
   * RPC URL for Solana connection — uses environment variable or user's custom RPC if configured
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
   * Jupiter API base URL — uses QuickNode Metis if configured, else public v6 (Legacy compatibility)
   */
  get JUPITER_API_BASE() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem("custom_api_settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.useCustomJupiter && parsed.jupiterApiKey) {
            return "https://quote-api.jup.ag/v6";
          }
        }
      }
    } catch {}
    return "https://quote-api.jup.ag/v6";
  },
};


