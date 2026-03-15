

## Plan: Full API Audit, Moonshot Integration, and Trade History Fix

### Issues Found

**1. Missing LiveTradeHistory component**
The `LiveTradeHistory.tsx` file referenced in BotAccess doesn't exist (search returned no matches). The "Trades" tab was planned but never created. Need to create this component with the P&L dashboard.

**2. BotAccess missing Trades tab**
The current BotAccess only has 6 tabs (Sniper, DCA, Vol, Batch, Copy, Auto). The 7th "Trades" tab with LiveTradeHistory was never wired in.

**3. LaunchpadService uses mock data for Raydium and Jupiter**
`getMockRaydiumTokens` and `getMockJupiterTokens` return random fake data. These need to be replaced with real DexScreener API calls.

**4. No Moonshot integration**
Moonshot (DEX Screener's launchpad) trending and new launches are not tracked. Need to add Moonshot as a data source.

**5. Jupiter Price API v3 response parsing may be wrong**
The `token-prices` edge function uses `JUPITER_PRICE_API = 'https://api.jup.ag/price/v3'` but parses response as `result[mint].usdPrice`. Need to verify this matches the v3 response format (v3 returns `{ [mint]: { usdPrice } }` which looks correct).

**6. Bullme API `mapBullmeToMemeTokens` uses wrong field names**
In `LaunchpadService`, it references `token.price`, `token.fdv`, `token.volume24h`, `token.change24h`, `token.holders` -- but `BullmeToken` interface has `marketCap`, `tradeVolume24h`, `totalSupply`, `tradeCount` etc. This causes all Bullme-sourced tokens in "New Launches" to show random/zero data.

### Implementation Plan

**Step 1: Fix BullmeToken field mapping in LaunchpadService**
- Map `marketCap` correctly (not `fdv`)
- Map `tradeVolume24h` (not `volume24h`)
- Derive price from `marketCap / totalSupply`
- Derive change from buy/sell volume ratio
- Use `tradeCount` for holders estimate

**Step 2: Replace mock Raydium/Jupiter with real DexScreener data**
- `getMockRaydiumTokens` → fetch from `https://api.dexscreener.com/latest/dex/search?q=raydium` filtered to Solana/Raydium pairs
- `getMockJupiterTokens` → fetch from DexScreener filtered to Jupiter pairs
- Add error handling with empty array fallback

**Step 3: Add Moonshot as a launchpad source**
- Add Moonshot to `LAUNCHPADS` config array
- Fetch Moonshot tokens via DexScreener: `https://api.dexscreener.com/token-profiles/latest/v1` filtered for Moonshot-originated tokens, or search for `moonshot` pairs
- Also add Moonshot to the `getAllTokens` aggregation
- Add Moonshot as a data source option in the TopMemecoins toggle (alongside Trending and New Launches)

**Step 4: Create LiveTradeHistory component with P&L dashboard**
- Create `src/components/dashboard/bot-tools/LiveTradeHistory.tsx`
- Fetch from `live_trades` table filtered by `wallet_address`
- Display 4 stat cards: Total P&L, Win Rate, Avg Trade Size, Total Trades
- Display trade list with Solscan links, timestamps, status badges
- Add 7th "Trades" tab to BotAccess

**Step 5: Wire trade logging in JupiterUltraService**
- After successful swap in `ultra.ts`, insert a record into `live_trades` table
- Log input/output mints, amounts, USD values, tx signature, bot type

**Step 6: Verify wallet portfolio API**
- The `wallet-portfolio` edge function looks correct (Helius + Jupiter + Birdeye + CoinGecko fallbacks)
- Ensure the PortfolioTracker component correctly displays token list with P&L per holding

### Technical Details

- Moonshot tokens can be identified on DexScreener by `dexId === "moonshot"` or by checking token profiles
- DexScreener endpoints used: `/tokens/v1/solana/{addresses}`, `/latest/dex/search`, `/token-boosts/top/v1`
- All edge function calls go through the existing `token-prices` edge function
- Trade logging uses the existing `live_trades` table schema
- No database migrations needed

### Files to Create/Edit
- **Create**: `src/components/dashboard/bot-tools/LiveTradeHistory.tsx`
- **Edit**: `src/services/launchpads/LaunchpadService.ts` (fix mappings, add Moonshot, replace mocks)
- **Edit**: `src/components/dashboard/BotAccess.tsx` (add Trades tab)
- **Edit**: `src/services/jupiter/ultra.ts` (add trade logging)
- **Edit**: `src/components/dashboard/TopMemecoins.tsx` (add Moonshot data source toggle)
- **Edit**: `supabase/functions/token-prices/index.ts` (add moonshot_trending action)

