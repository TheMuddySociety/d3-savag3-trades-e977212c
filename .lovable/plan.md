

## Audit: Mocked Items + Jupiter MCP Integration

### Mocked/Fake Data Found

Here is a complete audit of all mocked, hardcoded, or simulated data in the app:

| # | Component | What's Mocked | Severity |
|---|-----------|---------------|----------|
| 1 | **PerformanceMetrics** | Uses `mockPerformanceData` and `mockPortfolioData` from `mock-data.ts` — hardcoded Jan-Dec chart values, static "$2.7B volume", "1,256 new tokens", "243% ROI", "38.5% success rate" | High |
| 2 | **MiniChart** (sidebar) | `generateMockData()` creates random sine-wave data. Hardcoded `SOL/USD = $67.4` and `MEME INDEX = 234.8` values passed from Index.tsx | High |
| 3 | **LiveSignalFeed** | Entirely fake — `generateSignal()` creates random buy/sell/alert/volume signals from a hardcoded token list every 3-8 seconds | High |
| 4 | **MemeScanner** | Scan results are 100% random (`Math.random()` determines safe/risky, flags are random). No actual contract analysis | High |
| 5 | **LaunchCalendar** | `UPCOMING_LAUNCHES` array with hardcoded 2023 dates for fake tokens ("DogeMoon", "SafeFrog", "MoonCat", "RocketDoge") | High |
| 6 | **BlockchainAnalytics** | "On-Chain Insights" section has hardcoded text bullets. Stats "24h New Tokens: 127" and "Avg. Initial Liquidity: $23.4K" are static | Medium |
| 7 | **TokenDetailModal** | Falls back to `generateMockPriceHistory`, `generateMockHolders`, `generateMockTrades` when API fails | Low (fallback) |
| 8 | **useMemecoins** | Fallback mock data (CATTTT, RMC tokens) when Bullme API fails | Low (fallback) |
| 9 | **GlobeChart** | Static trading node positions — decorative, acceptable | None |
| 10 | **mock-data.ts** | Entire file of mock memecoins, performance, and portfolio data | Source file |

### Plan

#### Part 1: Replace Mocked Components with Real Jupiter API Data

**1. MiniChart — Real SOL/USD Price**
- Create a backend function (or use existing `token-prices`) to call Jupiter Price API (`GET /price/v3?ids=So11111111111111111111111111111111111111112`) for real SOL price
- Fetch 24h price history for the sparkline chart
- Replace the hardcoded `$67.4` and `12.3%` with live data
- Remove `MEME INDEX` card or replace with real aggregate metric

**2. PerformanceMetrics — Real Market Data**
- Replace `mockPerformanceData` / `mockPortfolioData` with data from Jupiter Tokens V2 API for aggregate market volume
- Fetch real Solana memecoin market stats via the existing `token-prices` edge function
- Replace hardcoded stats ($2.7B, 1,256, 243%, 38.5%) with computed values from API data

**3. LiveSignalFeed — Real On-Chain Signals**
- Replace random signal generator with real data from the Birdeye/Helius APIs already configured in `token-prices` edge function
- Use volume spikes, large trades, and price movements from real token data as signal sources
- Keep the UI structure but populate with actual detected events

**4. MemeScanner — Real Token Safety Analysis**
- Use Jupiter's Shield API (`GET /ultra/v1/shield?mints={mint}`) for real token security checks (freeze authority, mint authority, low organic activity)
- Use Helius token info (already in `token-prices`) for holder count, age, liquidity
- Replace random flags with actual on-chain analysis results

**5. LaunchCalendar — Remove or Replace**
- Remove the hardcoded 2023 fake launches
- Replace with recently created tokens from Bullme API (already integrated) or PumpFun launchpad data

**6. BlockchainAnalytics Insights — Dynamic Stats**
- Replace hardcoded insight bullets and stats with data fetched from existing APIs
- Compute "24h New Tokens" and "Avg. Initial Liquidity" from Bullme/Birdeye data

**7. Clean Up**
- Delete `src/lib/mock-data.ts` after all references are removed
- Remove fallback mock generators from `TokenDetailModal` (show error state instead)
- Remove fallback mock data from `useMemecoins` (show error toast only)

#### Part 2: Jupiter MCP Integration

The Jupiter MCP endpoint (`https://dev.jup.ag/mcp`) is designed for AI editors (Claude, Cursor, etc.) — it's not a runtime API for your app. It provides documentation lookup for developers.

What we **can** do is integrate Jupiter's actual APIs more deeply into the app:

- **Add a `jupiter-api` edge function** that proxies Jupiter Ultra, Price V3, Tokens V2, Shield, and Portfolio APIs
- Use this to power all the real-time data replacements above
- Add Jupiter Portfolio API (`GET /portfolio/v1/positions?wallet={address}`) to enhance the PortfolioTracker with real wallet positions when connected

#### Technical Approach
- Expand the existing `token-prices` edge function to handle new actions: `sol_price`, `market_stats`, `shield_check`, `recent_launches`
- Jupiter Price API is free (no API key needed for basic use); Shield API needs the free key from portal.jup.ag
- Components will call the edge function via Supabase, keeping API keys server-side

This is a large effort touching 8+ components and the backend. Shall I proceed?

