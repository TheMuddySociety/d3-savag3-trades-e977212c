/**
 * Platform-wide configuration constants
 */

export const PLATFORM_CONFIG = {
  /**
   * The public key of the platform-governed wallet used for bot trades and deposits.
   */
  WALLET_ADDRESS: "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z",
  
  /**
   * Default RPC URL for Solana connection
   * Uses Reown Blockchain API if PROJECT_ID is available, falls back to public RPC
   */
  RPC_URL: import.meta.env.VITE_REOWN_PROJECT_ID 
    ? `https://rpc.walletconnect.org/v1/?chainId=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp&projectId=${import.meta.env.VITE_REOWN_PROJECT_ID}`
    : "https://api.mainnet-beta.solana.com",
  
  /**
   * USDC Mint Address on Solana
   */
  USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",

  /**
   * SOL Mint Address (Native Wrapped)
   */
  SOL_MINT: "So11111111111111111111111111111111111111112",
};
