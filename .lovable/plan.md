

## Trading Bot Audit Report

### Architecture Overview
The trading bot suite consists of 4 client-side bots (Sniper, DCA, Volume, Auto Strategies) with paper trading backed by a `sim-trading` edge function and live trading via Jupiter V6 API swaps.

---

### Critical Issues

**1. Volume Bot has NO live execution path**
`VolumeBot.tsx` always calls `sim.simulateBuy/simulateSell` even when `isLive=true` (lines 51-56). Unlike Sniper and DCA which call `JupiterTransactionService.swapTokens` in live mode, the Volume Bot silently runs paper trades while displaying "LIVE" badges. This is misleading and could cause users to think real trades are executing.

**2. Auto Strategies have NO execution logic at all**
`AutoStrategies.tsx` only saves config via `sim.saveBotConfig()`. There is no background loop, no price monitoring, no trade execution — paper or live. The strategies (Momentum, Dip Buyer, Safe Exit, New Launch Hunter) are purely cosmetic toggles.

**3. Sniper "sniping" is fake — uses random delay, not blockchain monitoring**
`BuySniper.tsx` line 72: `const delay = 2000 + Math.random() * 3000;` — the sniper just waits 2-5 seconds then buys. It doesn't monitor the blockchain for new liquidity pools, token launches, or any real sniping trigger. The "armed" state is theater.

**4. DCA Bot race condition — stale closure over `count`**
`DCABot.tsx` lines 61-88: `count` is a local variable captured in the `setInterval` closure. Because `executeDCAOrder` is async and `count` is mutated inside the closure, rapid intervals could cause duplicate executions before the previous one finishes. Should use a ref or queue.

**5. No input validation on token addresses**
None of the bots validate that `tokenAddress` is a valid Solana mint address (base58, 32-44 chars). Invalid addresses will silently fail in the edge function or Jupiter API.

**6. RLS policies are overly permissive**
All sim tables use `USING (true)` for SELECT/UPDATE/DELETE, meaning **any anonymous user can read/modify any wallet's data**. The `WITH CHECK` only validates the wallet_address format on insert/update, but doesn't bind rows to the authenticated user. Since there's no auth system, any user can query another user's sim_orders, sim_holdings, etc.

---

### Moderate Issues

**7. Leaderboard P&L calculation is wrong**
`sim-trading/index.ts` line 437: `netPnlSol` adds and subtracts `totalSolSpent` (cancels out), making it meaningless. The code then ignores it and uses `simplePnl = balance - 10` (line 439), which doesn't account for unrealized gains in holdings.

**8. No error handling on live trade failures in DCA**
`DCABot.tsx` line 74-76: If `JupiterTransactionService.swapTokens` returns null (failed), the bot stops entirely (`stopDCA()`). There's no retry logic, no partial-failure handling — one failed order kills the whole DCA sequence.

**9. Kill switch doesn't cancel in-flight transactions**
The kill switch sets state to false and clears intervals, but if a `simulateBuy` or `swapTokens` call is already in-flight, it will still complete. For live trades, this means a transaction could still land after "killing."

**10. `numWallets` and `useBundling` in Volume Bot are cosmetic**
These settings are rendered in the UI but never used in any execution logic.

---

### Plan to Fix

#### 1. Add live execution to Volume Bot
- Import `JupiterTransactionService` and add live swap calls mirroring the DCA pattern (alternating buy/sell via Jupiter)

#### 2. Implement Auto Strategies execution loop
- Create a polling loop that fetches price data and evaluates strategy conditions (momentum = price up + volume up, dip buyer = price drop >20%, safe exit = check holdings against stop-loss/take-profit thresholds)
- Execute sim or live trades when conditions are met

#### 3. Add token address validation
- Create a shared `isValidSolanaAddress(addr)` utility (base58, 32-44 chars)
- Apply to all bot inputs before arming/starting

#### 4. Fix DCA race condition
- Replace local `count` with a `useRef` to prevent stale closures
- Add a `isExecuting` guard to prevent overlapping async executions

#### 5. Fix Leaderboard P&L
- Include unrealized gains from holdings in the total P&L calculation
- Remove the dead `netPnlSol` variable

#### 6. Add retry logic for DCA live failures
- On failed order, retry once after 3 seconds before stopping

#### 7. Clean up Volume Bot cosmetic controls
- Either implement multi-wallet simulation logic or remove the `numWallets`/`useBundling` UI elements to avoid confusion

### Files to Edit
- `src/components/dashboard/bot-tools/VolumeBot.tsx` — add live execution + remove or implement cosmetic controls
- `src/components/dashboard/bot-tools/DCABot.tsx` — fix race condition, add retry
- `src/components/dashboard/bot-tools/BuySniper.tsx` — add address validation
- `src/components/dashboard/bot-tools/AutoStrategies.tsx` — add execution loop
- `supabase/functions/sim-trading/index.ts` — fix leaderboard P&L
- New: `src/utils/validateSolanaAddress.ts` — shared validation utility

