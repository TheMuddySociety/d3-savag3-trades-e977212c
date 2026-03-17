

## Plan: Remove Sim Trading, Make Bot Tools Fully Live

### Overview
Strip out all simulation/paper trading logic from Bot Tools so every bot executes real trades via Jupiter. The `useSimTrading` hook, `SimPortfolio`, `TradeHistory` (sim), and all `sim.simulateBuy`/`sim.simulateSell` fallback paths will be removed. The `isLive` prop becomes unnecessary since everything is always live.

### Changes

**1. BotAccess.tsx — Remove sim imports and state**
- Remove `useSimTrading` import and `sim` variable
- Remove `SimPortfolio` and `TradeHistory` imports
- Remove `useTradingMode` import (already always live)
- Remove the `showHistory` state and sim history view block
- Stop passing `sim` and `isLive` props to bot components
- Keep `killSignal` prop

**2. Each bot component (BuySniper, DCABot, VolumeBot, BatchTrader, CopyTradeBot, AutoStrategies) — Remove sim fallback paths**
- Remove `sim` from Props interface
- Remove all `else` branches that call `sim.simulateBuy` / `sim.simulateSell`
- Remove `isLive` from Props (always live now)
- Replace `sim.isLoading` with local `isLoading` state where needed
- Remove conditional `isLive` checks — always execute via Jupiter Ultra / JupiterTransactionService
- Remove paper-mode labels like `"(Paper)"` from buttons
- Always show the LIVE warning banner
- Always show the `LiveTradeConfirmDialog` before executing
- Require wallet connection for all actions

**3. DCABot interval labels** — Remove `"(sim)"` from interval option labels

**4. Files to delete (optional cleanup)**
- `src/components/dashboard/bot-tools/SimPortfolio.tsx` — no longer used
- `src/components/dashboard/bot-tools/TradeHistory.tsx` — sim-only history, replaced by `LiveTradeHistory`
- `src/hooks/useSimTrading.ts` — entire hook no longer needed

**5. Keep unchanged**
- `LiveTradeHistory` tab (real trade logs)
- `ProfitSimulator` tab (AI analysis tool, not trading)
- `AutoStrategies` — already uses Jupiter Ultra for live trades; remove sim fallback paths
- `useTradingMode` context — keep for `hasFreePass` / payment logic, just remove paper mode references

### Technical Notes
- `sim.isLoading` is used as a button disabled state in several components. Each component will manage its own `isLoading` state via `useState`.
- The `BatchTrader` sell-all feature currently relies on `sim.holdings` to know what to sell. This will need to be replaced with a wallet portfolio fetch (e.g., from the existing `useWalletPortfolio` hook or Helius DAS).
- The `CopyTradeBot` also references `sim.holdings` for sell mirroring — same approach, use real wallet holdings.

