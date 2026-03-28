/**
 * Jupiter Swap Configuration Utility
 * 
 * Reads user trading settings from localStorage (set by SettingsDialog)
 * and builds Jupiter V6+ swap configuration objects with proper
 * MEV protection (Jito) vs regular priority fee handling.
 */

const TRADING_SETTINGS_KEY = "tradingSettings";
const API_SETTINGS_KEY = "custom_api_settings";

// ── Types ──────────────────────────────────────────────────────────

export interface TradingSettings {
  slippage: number;         // percent (e.g. 0.5 = 0.5%)
  priorityFee: number;      // SOL (e.g. 0.0005)
  mevProtection: boolean;
  jitoEnabled: boolean;
  jitoTipSOL: number;
  jitoBlockEngine: string;
  autoApprove: boolean;
  jupiterApiKey?: string;
  useCustomJupiter?: boolean;
}

export interface ApiSettings {
  customRpc?: string;
  heliusApiKey?: string;
  jupiterApiKey?: string;
  useCustomRpc?: boolean;
  useCustomHelius?: boolean;
  useCustomJupiter?: boolean;
}

export interface JupiterSwapConfig {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  prioritizationFeeLamports: number | { jitoTipLamports: number } | { priorityLevelWithMaxLamports: { maxLamports: number; priorityLevel: string } } | "auto";
  wrapAndUnwrapSol: boolean;
  dynamicComputeUnitLimit: boolean;
}

// ── Default Values ─────────────────────────────────────────────────

const DEFAULT_TRADING_SETTINGS: TradingSettings = {
  slippage: 1.0,
  priorityFee: 0.001,
  mevProtection: true,
  jitoEnabled: true,
  jitoTipSOL: 0.001,
  jitoBlockEngine: "mainnet.block-engine.jito.wtf",
  autoApprove: false,
  useCustomJupiter: false,
};

// ── Getters ────────────────────────────────────────────────────────

export function getCustomApiSettings(): TradingSettings {
  try {
    const saved = localStorage.getItem(TRADING_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        slippage: parsed.slippage ?? DEFAULT_TRADING_SETTINGS.slippage,
        priorityFee: parsed.priorityFee ?? DEFAULT_TRADING_SETTINGS.priorityFee,
        mevProtection: parsed.mevProtection !== false,
        jitoEnabled: parsed.jitoEnabled !== false,
        jitoTipSOL: parsed.jitoTipSOL ?? DEFAULT_TRADING_SETTINGS.jitoTipSOL,
        jitoBlockEngine: parsed.jitoBlockEngine || DEFAULT_TRADING_SETTINGS.jitoBlockEngine,
        autoApprove: !!parsed.autoApprove,
        jupiterApiKey: parsed.jupiterApiKey,
        useCustomJupiter: !!parsed.useCustomJupiter,
      };
    }
  } catch (e) {
    console.warn("[JupiterConfig] Failed to load trading settings, using defaults:", e);
  }
  return { ...DEFAULT_TRADING_SETTINGS };
}

export function getApiSettings(): ApiSettings | null {
  try {
    const saved = localStorage.getItem(API_SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Silently fall back
  }
  return null;
}

// ── Jupiter Swap Config Builder ────────────────────────────────────

/**
 * Builds a complete Jupiter V6 swap config object from user settings.
 * 
 * Key behavior (Jupiter V6+ 2026):
 * - When mevProtection=true → uses Jito tip (jitoTipLamports)
 * - When mevProtection=false → uses regular priority fee (lamports or "auto")
 * - These are MUTUALLY EXCLUSIVE in the simple /swap endpoint.
 *   To use both, switch to /swap-instructions + manual TX building.
 */
export function buildJupiterSwapConfig(
  inputMint: string,
  outputMint: string,
  amount: number,
  overrides?: Partial<TradingSettings>,
): JupiterSwapConfig {
  const settings = getCustomApiSettings();
  const merged = { ...settings, ...overrides };

  // Convert percent to basis points (0.5% → 50 bps)
  const slippageBps = Math.max(1, Math.floor(merged.slippage * 100));

  // Convert SOL to lamports
  const feeLamports = Math.floor(merged.priorityFee * 1_000_000_000);

  let prioritizationFeeLamports: JupiterSwapConfig["prioritizationFeeLamports"];

  if (merged.jitoEnabled) {
    // Specialized Jito MEV tip
    const jitoTipLamports = Math.floor(merged.jitoTipSOL * 1e9);
    prioritizationFeeLamports = {
      jitoTipLamports: jitoTipLamports || 1_000_000, // Default 0.001 SOL if 0
    };
  } else if (merged.mevProtection) {
    // Legacy MEV protection using regular priority fee as tip
    prioritizationFeeLamports = {
      jitoTipLamports: feeLamports || 10_000,
    };
  } else {
    // Regular priority fee mode
    prioritizationFeeLamports = feeLamports || "auto";
  }

  return {
    inputMint,
    outputMint,
    amount,
    slippageBps,
    prioritizationFeeLamports,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  };
}

/**
 * Convenience: get a human-readable summary of current swap settings
 * for display in bot confirmation dialogs
 */
export function getSwapSettingsSummary(): string {
  const s = getCustomApiSettings();
  const parts = [
    `Slippage: ${s.slippage}%`,
    `Priority: ${s.priorityFee} SOL`,
    s.mevProtection ? "🛡️ MEV Protected (Jito)" : "⚡ Standard RPC",
  ];
  return parts.join(" • ");
}
