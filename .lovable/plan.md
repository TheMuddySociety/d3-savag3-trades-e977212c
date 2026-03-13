

## Plan: Power Trading Suite — Batch Trading, Copy Trade Bot, Autonomous Mode & Fee-Free Access

### What We're Building

Four major upgrades to transform the platform into a passive-income trading machine:

---

### 1. Batch Trading (Buy/Sell 1-50 Tokens at Once)

**New component: `BatchTrader.tsx`** — a new tab in BotAccess alongside Sniper/DCA/Volume/Auto.

- Text area where users paste up to 50 token addresses (one per line or comma-separated)
- Set SOL amount per token (e.g., 0.1 SOL × 50 tokens = 5 SOL total)
- "Buy All" button executes swaps in parallel batches of 5 (to avoid rate limits)
- "Sell All Holdings" button dumps all current sim_holdings at once
- Uses `JupiterTransactionService.swapTokens` in live mode, `sim.simulateBuy` in paper mode
- Progress bar showing X/50 completed
- Each token validated via `isValidSolanaAddress`

### 2. Copy Trade Bot

**New component: `CopyTradeBot.tsx`** — another tab in BotAccess.

- User enters a "whale" wallet address to monitor
- **New edge function: `copy-trade`** polls the Helius Enhanced Transactions API every 10 seconds to detect new swap transactions from the target wallet
- When a swap is detected, it mirrors the trade proportionally (user sets max SOL per copy trade)
- Settings: max SOL per trade, token blacklist, auto-sell when whale sells
- In paper mode: calls `sim.simulateBuy/Sell`
- In live mode: executes via Jupiter
- Displays a live feed of copied trades with timestamps

**Edge function logic:**
- `GET https://api.helius.xyz/v0/addresses/{address}/transactions?api-key={key}&type=SWAP`
- Parse swap events to extract input/output mints and amounts
- Return new swaps since last poll timestamp

### 3. Autonomous Mode (Leave-and-Earn)

Enhance the existing **Auto Strategies** with a persistent backend execution loop:

- **New edge function: `auto-trader`** that runs on a cron schedule (every 60 seconds)
- Reads active `sim_bot_configs` from the database where `is_active = true`
- For each active config, evaluates strategy conditions using Birdeye price data
- Executes paper trades via the existing `simulateBuy/simulateSell` logic in the edge function
- Strategies now persist and run even when the user closes the browser
- Add a "🏖️ Beach Mode" toggle in AutoStrategies UI that saves config to DB and shows "Running in background"
- New strategies added:
  - **Scalper**: Buy on 5% dip, sell on 3% gain (high frequency)
  - **Whale Follow**: Auto-copies top leaderboard wallets

### 4. Fee-Free Trading Pass (0.1 SOL)

Update the `useTradingMode` context:

- Add `hasFreePass` state, checked against `access_payments` table
- When user toggles "Fee-Free Mode", prompt to pay 0.1 SOL to the platform wallet (`ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z`)
- On successful payment, record in `access_payments` with a `payment_type: 'fee_free_pass'`
- Pass `platformFeeBps: 0` to Jupiter widget when user has an active pass
- Show a badge "FEE-FREE ✨" in the header when active
- The pass is per-wallet and permanent

---

### Database Changes

1. **New table: `copy_trade_configs`**
   - `id`, `wallet_address`, `target_wallet`, `max_sol_per_trade`, `is_active`, `last_checked_tx`, `blacklisted_tokens`, `auto_sell`, `created_at`, `updated_at`

2. **Alter `access_payments`** — add `payment_type` column (text, default `'access'`) to distinguish fee-free passes from other payments

### New Edge Functions

1. **`copy-trade`** — polls Helius for target wallet swaps, returns new trades
2. **`auto-trader`** — cron-driven strategy evaluator that executes paper trades autonomously

### UI Changes

- **BotAccess tabs**: Expand from 4 to 6 tabs: Sniper | DCA | Volume | Batch | Copy | Auto
- **Header**: Show "FEE-FREE ✨" badge when pass is active
- **AutoStrategies**: Add "Beach Mode" toggle + 2 new strategies

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/dashboard/bot-tools/BatchTrader.tsx` | Create |
| `src/components/dashboard/bot-tools/CopyTradeBot.tsx` | Create |
| `src/components/dashboard/BotAccess.tsx` | Edit — add 2 new tabs |
| `src/components/dashboard/bot-tools/AutoStrategies.tsx` | Edit — add Beach Mode + new strategies |
| `src/hooks/useTradingMode.tsx` | Edit — add fee-free pass logic |
| `src/components/layout/Header.tsx` | Edit — show fee-free badge |
| `supabase/functions/copy-trade/index.ts` | Create |
| `supabase/functions/auto-trader/index.ts` | Create |
| Migration: `copy_trade_configs` table + `payment_type` column | Create |

