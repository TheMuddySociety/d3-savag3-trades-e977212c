

## Bot Tools — Auto Trading Budget System

### Overview
Add a comprehensive budget management system where traders deposit SOL or USDC into a platform wallet, set spending limits on their connected wallet, and optionally lock funds via escrow — all tracked in the database. The bot trades against these budgets in the background.

### Database Changes

**New table: `auto_trade_budgets`**
- `id` (uuid, PK)
- `wallet_address` (text, not null) — user's wallet
- `currency` (text, not null) — `'SOL'` or `'USDC'`
- `deposit_amount` (numeric, default 0) — total deposited to platform wallet
- `spent_amount` (numeric, default 0) — consumed by trades
- `remaining_amount` (numeric, default 0) — available for trading
- `spending_limit` (numeric, nullable) — max the bot can spend per trade from connected wallet
- `escrow_amount` (numeric, default 0) — locked in escrow (future)
- `escrow_tx` (text, nullable) — escrow transaction signature
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

RLS: Public insert/select/update with wallet_address validation (same pattern as other tables).

### Frontend Changes (AutoStrategies.tsx)

1. **Budget Setup Panel** — new section above strategies:
   - Currency selector (SOL / USDC toggle)
   - Three budget method tabs: Deposit, Spending Limit, Escrow
   - **Deposit tab**: Input amount + "Deposit" button that sends SOL/USDC to the platform wallet (`ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z`), records it in `auto_trade_budgets`
   - **Spending Limit tab**: Input max budget, saved to database — bot checks limit before each trade
   - **Escrow tab**: Placeholder UI marked "Coming Soon"
   - Display remaining budget, total deposited, total spent as a summary bar

2. **Budget Enforcement** — strategies check `remaining_amount` or `spending_limit` before executing trades. If budget exhausted, strategy pauses and logs a warning.

3. **Budget Summary Card** — compact display showing:
   - Currency icon + remaining balance
   - Progress bar (spent vs total)
   - "Top Up" and "Withdraw" buttons

### Edge Function Changes (auto-trader/index.ts)

- Before executing any trade, query `auto_trade_budgets` for the wallet
- Check if `remaining_amount >= trade cost` (for deposit mode) or if trade is within `spending_limit`
- After each trade, update `spent_amount` and `remaining_amount`
- Skip wallets with zero budget and log accordingly

### USDC Support

- USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- For USDC deposits, use SPL token transfer instead of SOL system transfer
- Jupiter Ultra already supports USDC swaps

### Flow

```text
User connects wallet
  → Selects currency (SOL/USDC)
  → Chooses budget method:
      Deposit → sends funds to platform wallet → recorded in DB
      Spending Limit → sets max per trade → saved in DB
      Escrow → "Coming Soon"
  → Enables strategies
  → Bot checks budget before each trade
  → Budget decrements on each execution
  → User sees real-time remaining balance
```

### Files to Create/Edit
- **Create**: DB migration for `auto_trade_budgets` table
- **Edit**: `src/components/dashboard/bot-tools/AutoStrategies.tsx` — add budget panel UI + deposit/limit logic
- **Edit**: `supabase/functions/auto-trader/index.ts` — add budget checks before trades
- **Edit**: `src/hooks/useTradingMode.tsx` — add USDC transfer support for deposits

