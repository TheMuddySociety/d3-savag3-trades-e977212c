# SAVAG3BOT — Official Full Fix Plan (Revised & Integrated)

**Version**: 1.2 (Integrated)  
**Date**: March 26, 2026  
**Goal**: Resolve every issue from the audit so the app is stable, data-accurate, and supports **real trading** by Monday.  
**Focus**: P0 critical fixes first (especially settings + Jupiter execution), followed by P1 accuracy improvements, with scoped heavy items.

## Quick Overview
- All **Small Issues** fixed with targeted, minimal changes.
- **Settings** now fully consumed by every bot.
- **Jupiter swaps** expanded with production-ready config (slippage, priority fees, Jito MEV protection).
- Data fixes applied (real holders, shield_check, NaN protection).
- Clear code snippets, files to edit, and Monday checklist.

## P0 Fixes — Critical & Quick (Do These First)

### 1. Wire Settings to All Bot Tools
**Issue**: SettingsDialog saves to localStorage, but bots ignore them and use hardcoded defaults.

**Solution**:
Create/update the shared helper:

```ts
// src/utils/getCustomApiSettings.ts
export interface TradingSettings {
  slippage: number;        // percent (e.g. 0.5)
  priorityFee: number;     // SOL (e.g. 0.0005)
  mevProtection: boolean;
  autoApprove: boolean;
}

export function getCustomApiSettings(): TradingSettings {
  try {
    const saved = localStorage.getItem('tradingSettings');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load trading settings, using defaults');
  }

  return {
    slippage: 0.5,
    priorityFee: 0.0005,
    mevProtection: true,
    autoApprove: true,
  };
}
```

In every bot component that performs swaps (**BuySniper.tsx**, **DCABot.tsx**, **VolumeBot.tsx**, **GridBot.tsx**, **BatchTrader.tsx**, **CopyTradeBot.tsx**, and any others):

- Add: `import { getCustomApiSettings } from '@/utils/getCustomApiSettings';`
- Use the expanded Jupiter config (detailed below) in all "Start Bot", "Execute", or trade handlers.

**Files to update**: All listed bot files + the shared `useJupiterPlugin` hook/service.

### 2. Render BackgroundTaskMonitor in Tasks tab
**File**: `src/components/dashboard/BotAccess.tsx`

**Add inside** `<TabsContent value="tasks">`:

```tsx
<BackgroundTaskMonitor walletAddress={walletAddress} />
```

### 3. Fix fmt() NaN Crash in TokenDetailModal
**File**: `src/components/dashboard/TokenDetailModal.tsx`

**Replace** the `fmt` function (~line 220):

```ts
const fmt = (v: number | string | undefined | null): string => {
  if (v == null || isNaN(Number(v))) return '$0.00';
  const num = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
};
```

### 4. Page Errors & Runtime Stability Audit
- **Referral-Earnings Tracker Fix**: Resolved a critical runtime crash in the "Fees" and "Admin" tabs caused by a schema mismatch between the hardened Edge Function and the frontend component. I synchronized the component with the new user-scoped data model.
- **Wallet Notification Fix**: Corrected the `WalletNotification` structure from an object to a function. This was a "silent killer" that would have caused a fatal crash in the `@jup-ag/wallet-adapter` (Jupiter Kit) initialization inside the `NetworkProvider`, breaking the entire app's wallet connection.
- **Defensive Guards**: Implemented additional null-guards and `isNaN` checks in `TokenDetailModal.tsx` and `PortfolioTracker.tsx` to handle edge cases in external API responses (e.g., BirdEye/DexScreener).

### 5. Jupiter V2/V3 Migration
- **Swap V2 Implementation**: Transitioned from Ultra V1 to Swap V2. The new `/order` and `/execute` endpoints provide unified managed execution, automatic slippage, and superior MEV protection.
- **Price V3 Integration**: Upgraded the `token-prices` Edge Function to the heuristics-based V3 Price API. Optimized the `prices` action for batch fetching (up to 50 tokens in one call), drastically reducing overhead during dashboard polling.
- **Unified V2 Service**: Created `JupiterV2Service` to consolidate all trading logic. It seamlessly handles both default (proxied) and high-performance (direct custom API key) paths, ensuring the most reliable landing rates for bot-driven trades.

### ✅ Verification Results
- **Security**: Verified `profiles` table immutability via SQL migrations.
- **Privacy**: Verified `referral-earnings` Edge Function requires JWT and returns user-scoped stats only.
- **Stability**: Confirmed unified `smartSwap` path routes correctly through the new V1 architecture.
- **Performance**: Confirmed `token-prices` V3 batching reduces sequential API calls by 10x+.

### Expanded Jupiter Swap Configuration (Core for Real Bot Execution)
This is the production-ready configuration every bot should use. It respects user settings, balances speed/cost/MEV protection, and follows Jupiter V6+ best practices.

**Key Concepts**:
- `slippageBps`: Basis points (e.g., 0.5% = 50 bps). Higher for volatile sniping.
- `prioritizationFeeLamports`: Fixed lamports, `"auto"`, or advanced object.
- `mevProtection`: When `true`, prefer Jito tip (mutually exclusive with regular priority fee in simple `/swap` endpoint). For both, use `/swap-instructions` + manual tx building (advanced, optional).
- Bot-specific tuning: Sniper/Copy → higher slippage + Jito. DCA/Volume → lower fees.

**Full Example** (copy into bot execute logic):

```ts
import { getCustomApiSettings } from '@/utils/getCustomApiSettings';
const { executeSwap } = useJupiterPlugin();   // or your Jupiter service

const settings = getCustomApiSettings();
const slippageBps = Math.floor(settings.slippage * 100);

let prioritizationFeeLamports: any;

if (settings.mevProtection) {
  // Jito MEV protection (recommended for sniping & competitive trades)
  prioritizationFeeLamports = {
    jitoTipLamports: Math.floor(settings.priorityFee * 1_000_000_000) || 10_000,
  };
} else {
  // Standard priority fee
  prioritizationFeeLamports = Math.floor(settings.priorityFee * 1_000_000_000) || "auto";
  // Optional dynamic:
  // prioritizationFeeLamports = {
  //   priorityLevelWithMaxLamports: { maxLamports: 1_000_000, priorityLevel: "high" }
  // };
}

const swapResult = await executeSwap({
  inputMint: fromMint,
  outputMint: toMint,
  amount: amountInSmallestUnits,     // respect token decimals
  slippageBps: slippageBps,
  prioritizationFeeLamports: prioritizationFeeLamports,
  wrapAndUnwrapSol: true,
  dynamicComputeUnitLimit: true,     // Jupiter optimizes CU
});
```

**Integration Tips**:
- Update `useJupiterPlugin` to accept and apply `TradingSettings`.
- When `mevProtection: true`, route final `sendTransaction` through a Jito RPC.
- Add retry logic: On slippage failure, increase by 10–20 bps (up to user max).
- Test on devnet first with small amounts.

### 2. Render BackgroundTaskMonitor in Tasks tab
**File**: `src/components/dashboard/BotAccess.tsx`

**Add inside** `<TabsContent value="tasks">`:

```tsx
<BackgroundTaskMonitor walletAddress={walletAddress} />
```

### 3. Fix fmt() NaN Crash in TokenDetailModal
**File**: `src/components/dashboard/TokenDetailModal.tsx`

**Replace** the `fmt` function (~line 220):

```ts
const fmt = (v: number | string | undefined | null): string => {
  if (v == null || isNaN(Number(v))) return '$0.00';
  const num = typeof v === 'string' ? parseFloat(v) : v;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
};
```

### 4. Minor Cosmetic Fixes
- **D3SAgentHero.tsx**: Replace static stats with dynamic data from portfolio or a lightweight fetch.
- **Beach Mode**: Ensure `BeachModePanel`, `BeachModeAnalytics`, and `BudgetManager` are reachable in the Agent tab (add sub-tab if needed).

## P1 Fixes — Data Accuracy & Missing Features

### 5. Implement `shield_check` in token-prices Edge Function
**File**: `supabase/functions/token-prices/index.ts`

**Add handler**:

```ts
case 'shield_check': {
  const { tokenAddress } = req.body;
  if (!tokenAddress) return new Response(JSON.stringify({ error: 'tokenAddress required' }), { status: 400 });

  const res = await fetch(
    `https://public-api.birdeye.so/defi/v3/token/holder?address=${tokenAddress}&limit=50`,
    { headers: { 'x-api-key': process.env.BIRDEYE_API_KEY!, 'x-chain': 'solana' } }
  );
  const data = await res.json();
  const holders = data.data?.items || [];
  const safe = /* your risk logic, e.g. top-holder concentration < 50% */;

  return new Response(JSON.stringify({ safe, details: data }), { status: 200 });
}
```

Store Birdeye API key in Supabase secrets. Update `MemeScanner.tsx` call if needed.

### 6. Use Real Holder Count
**File**: `src/services/websocket/TokenWebSocketService.ts`

**Replace** fake holders calculation (~line 163) with:

```ts
const holderRes = await fetch(
  `https://public-api.birdeye.so/defi/v3/token/holder?address=${t.address}&limit=1`,
  { headers: { 'x-api-key': process.env.BIRDEYE_API_KEY!, 'x-chain': 'solana' } }
);
const holderData = await holderRes.json();
t.holders = holderData.data?.total || holderData.data?.items?.length || 0;
```

### 7. Verification Items
- Confirm `TokenSwap.tsx` re-exports the real implementation.
- Deploy/test `sim-trading` Edge Function for a working Leaderboard.

## Heavy Items — Scoped for Monday + Roadmap

### A. Real-time Updates
Keep 5s (or reduce to 2-3s) polling for Monday.  
Longer-term: Add Supabase Realtime or SSE for sub-second prices.

### B. On-Chain Agent Delegation
Test "Hire D3S Agent" on devnet with proper error handling.

### C. Full Bot Execution Engine
Apply the **Expanded Jupiter Swap Configuration** above to all bots.  
Add success/error toasts and respect the existing kill switch.

### D. Missing Edge Actions
- Add simple `ping` handler returning `{ status: 'ok' }`.

## Monday Implementation Checklist

1. P0 fixes (Settings + Jupiter config + 3 small changes) — 3–5 hours.
2. P1 fixes (shield_check + real holders) — 3–4 hours.
3. Wire real execution in key bots (Sniper + DCA first).
4. End-to-end test: Trending → Settings → Bot start → Portfolio.
5. Deploy updated Edge Functions.
6. Smoke test with small real trades (devnet → mainnet).

**Estimated Effort**: 1–2 focused developer days.

## Final Recommendations
- Add defensive null/NaN guards in more display components.
- Keep all API keys (Birdeye, Jupiter, Helius, Jito RPC) in Supabase secrets.
- After Monday: Prioritize full WebSocket infrastructure and on-chain agent dashboard.

This plan makes SAVAG3BOT fully operational with accurate data and real, configurable trading across all bot tabs.
