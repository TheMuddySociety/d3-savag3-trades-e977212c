

## Audit: Mock Data Removal

After scanning the codebase, here are the components still using fake/mocked/random data instead of real data, and the plan to fix each.

### Issues Found

**1. MiniChart.tsx — Fake sparkline data**
The SOL/USD chart generates random sparkline points using `Math.random()` around the current price instead of fetching real historical price data. The price and 24h change are real (from `token-prices`), but the chart line is fabricated.

**Fix**: Fetch real SOL price history from the `token-prices` edge function (action: `price_history` for SOL mint) and render actual data points.

**2. TokenDetailModal.tsx — Mock fallback generators**
Contains `generateMockPriceHistory()`, `generateMockHolders()`, and `generateMockTrades()` functions. Currently the code tries live data first and sets empty arrays on failure, but these mock generators are still present as dead code.

**Fix**: Remove the three `generateMock*` functions entirely. The live data path already works and shows empty states on failure — no mock fallback needed.

**3. ProfitSimulator.tsx — Fake AI predictions**
The "AI Trading" mode uses `Math.random()` to generate fake profit predictions, confidence scores, and randomly sliced trading signal labels. There is no actual AI analysis.

**Fix**: Replace the fake calculation with a real AI call using Lovable AI (e.g. `gemini-2.5-flash`) to analyze the token's on-chain metrics (price, volume, change24h, market cap) and return a structured prediction with reasoning.

**4. Jupiter quotes.ts — Simulated quote fallback**
When the Jupiter API fails, it returns a fake quote with random `outAmount` and `priceImpact` values, labeled "(Simulated)".

**Fix**: Remove the simulated fallback and return `null` on failure instead. The caller should handle null by showing an error message rather than displaying fake numbers.

**5. PumpFun TokenTable.tsx — Random sparkline charts**
The `MiniChart` component generates random SVG polyline points for each token row. These charts have no relation to actual price movement.

**Fix**: This is a lightweight decorative element. Replace with a directional indicator (up/down arrow or colored bar) based on the token's actual `change24h` value, since historical per-token price data isn't readily available for pump.fun tokens.

**6. PumpFunService.ts — Random change24h fallback**
When `change24h` is `NaN`, it falls back to `Math.random() * 20 - 10` (random number between -10% and +10%).

**Fix**: Default to `0` instead of a random value when the real change can't be calculated.

### Files to Edit

| File | Change |
|------|--------|
| `src/components/dashboard/MiniChart.tsx` | Fetch real SOL price history via `token-prices` edge function |
| `src/components/dashboard/TokenDetailModal.tsx` | Delete 3 `generateMock*` functions (dead code cleanup) |
| `src/components/dashboard/ProfitSimulator.tsx` | Replace fake AI calc with real Lovable AI call |
| `src/services/jupiter/quotes.ts` | Remove simulated quote fallback, return `null` on failure |
| `src/components/dashboard/pumpfun/TokenTable.tsx` | Replace random sparkline with direction indicator based on real data |
| `src/services/pumpfun/PumpFunService.ts` | Change `Math.random()` fallback to `0` for missing change24h |

### Not Mocked (Confirmed Real)
- Leaderboard — fetches from `sim-trading` edge function
- LiveSignalFeed — derives signals from real trending data
- PerformanceMetrics — fetches from `token-prices` market_stats
- BlockchainAnalytics — fetches real BONK trades and market stats
- Portfolio Tracker — uses Helius RPC for real on-chain data
- GlobeChart — decorative visualization (static trading node positions are fine)

