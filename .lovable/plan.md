

## Fix: Coin Data Not Showing Real-Time Values

### Root Cause Analysis

The APIs **are** returning live data (SOL at $89.81, trending tokens with real prices). The problems are:

1. **Trending token field mapping is broken** — CoinGecko returns `price_change_24h`, `market_cap` (as string "$477M"), `volume_24h` (as string), and `logo`, but `TokenWebSocketService.fetchTrendingTokens()` maps using Birdeye field names (`price24hChangePercent`, `marketcap`, `volume24hUSD`, `logoURI`). Result: all trending tokens show **$0 market cap, $0 volume, 0% change**.

2. **Trending token addresses are CoinGecko slugs** (e.g. "pudgy-penguins", "bitcoin") instead of Solana mint addresses. Clicking for details passes these slugs to Helius/Jupiter which returns empty data.

3. **useMemecoins hardcodes change24h** — lines use `7.8` or `-1.3` instead of computing from Bullme buy/sell volume data.

4. **Price history generates fake variance** — `fetchPriceHistory` in the edge function creates synthetic sine-wave points around the current price instead of fetching actual historical data.

5. **BlockchainAnalytics transactions are still mock** — calls `SolanaService.getRecentMemeTransactions()` which returns `Array(limit).fill(0).map(...)` with fake data.

### Plan

#### 1. Fix Trending Token Mapping (`TokenWebSocketService.ts`)
- Map CoinGecko fields correctly: `price_change_24h` → `change24h`, `logo` → `logoUrl`, parse `market_cap`/`volume_24h` strings to numbers
- Use CoinGecko's `item.platforms.solana` field for actual Solana mint addresses when available

#### 2. Fix useMemecoins Change Calculation (`useMemecoins.ts`)
- Replace hardcoded `7.8`/`-1.3` with actual percentage derived from Bullme `buyVolume24h` and `sellVolume24h` data: `((buyVol - sellVol) / (buyVol + sellVol)) * 100`

#### 3. Fix Price History (`token-prices` edge function)
- Use Birdeye or DexScreener historical price endpoint instead of generating fake sine-wave points
- Fallback: use Jupiter Price v3 with time-series if available

#### 4. Replace Mock Transactions in BlockchainAnalytics
- Remove call to `SolanaService.getRecentMemeTransactions()` 
- Use the existing `token_trades` action from the edge function with a real popular token address instead

#### 5. Clean up SolanaService mock methods
- Remove `getRecentMemeTransactions` mock, `getTokenLiquidity` mock, `startPriceMonitoring` mock, and `getAIPricePrediction` mock

### Files to Edit
- `src/services/websocket/TokenWebSocketService.ts` — fix CoinGecko field mapping
- `src/hooks/useMemecoins.ts` — fix change24h calculation
- `supabase/functions/token-prices/index.ts` — fix price history
- `src/components/dashboard/BlockchainAnalytics.tsx` — remove mock transactions
- `src/services/SolanaService.ts` — clean up mock methods

