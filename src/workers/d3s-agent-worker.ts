/// <reference lib="webworker" />

export type StrategyType = 'momentum' | 'dip_buy' | 'safe_exit' | 'new_launch' | 'scalper' | 'whale_follow';

export interface AgentConfig {
  activeStrategies: StrategyType[];
  walletAddress: string;
  safeExitStopLoss: number;
  safeExitTakeProfit: number;
  scalperTarget: number;
  launchMinLiquidity: number;
  launchMaxAge: number;
  launchAutoSellTimer: number;
  maxBudget: number;
}

export interface PortfolioData {
  tokens: Array<{
    mint: string;
    symbol: string;
    amount: number;
    decimals: number;
    price: number;
    value: number;
  }>;
  totalValueSol: number;
}

export interface WorkerPayload {
  type?: "new_launch";
  payload?: any;
  portfolio?: PortfolioData;
  entryPriceMap?: Record<string, number>;
  currentPeaks?: Record<string, { price: number; lastUpdated: number }>;
  config?: AgentConfig;
  marketContext?: {
    trendingDips: Array<{ mint: string; symbol: string; price: number; priceChange1h: number }>;
    newLaunches: Array<{ mint: string; symbol: string; name: string; price: number; marketCap: number; liquidity: number; ageSeconds: number }>;
  }
}

export interface EvaluationResult {
  timestamp: number;
  actions: Array<{
    type: 'buy' | 'sell';
    mint: string;
    symbol: string;
    amountToSell?: number;
    decimals?: number;
    amountToBuySOL?: number;
    reason: string;
    strategy: StrategyType;
    isEmergency?: boolean;
    autoSellTimer?: number;
  }>;
  updatedPeaks: Record<string, { price: number; lastUpdated: number }>;
  logs: string[];
}

self.onmessage = async (e: MessageEvent<WorkerPayload>) => {
  const { type, payload, portfolio, entryPriceMap, currentPeaks, config, marketContext } = e.data;
  
  if (type === "new_launch" && config?.activeStrategies.includes("new_launch")) {
    // Process instantaneous real-time pump.fun broadcast
    const launch = payload;
    if (launch.liquidity >= config.launchMinLiquidity && launch.ageSeconds <= config.launchMaxAge) {
      self.postMessage({
        timestamp: Date.now(),
        actions: [{
          type: 'buy',
          mint: launch.mint,
          symbol: launch.symbol,
          amountToBuySOL: config.maxBudget,
          reason: `⚡ Realtime Launch Snipe (${launch.ageSeconds}s old)`,
          strategy: 'new_launch',
          autoSellTimer: config.launchAutoSellTimer
        }],
        updatedPeaks: currentPeaks || {},
        logs: [`🔥🎯 REALTIME SNIPING: ${launch.symbol} (${launch.ageSeconds}s old, $${launch.liquidity.toFixed(0)} liq)`]
      } as EvaluationResult);
    }
    return;
  }

  // 10-15s Polling Tick Logic
  if (!portfolio || !config || !currentPeaks || !entryPriceMap || !marketContext) return;

  const result: EvaluationResult = {
    timestamp: Date.now(),
    actions: [],
    updatedPeaks: { ...currentPeaks },
    logs: [],
  };

  const logs: string[] = [];
  const holdings = portfolio.tokens;
  const now = Date.now();

  // 1. Update peak prices for current holdings
  for (const h of holdings) {
    if (h.price <= 0) continue;
    const currentData = result.updatedPeaks[h.mint];
    const currentPeak = currentData ? currentData.price : 0;
    
    if (h.price > currentPeak) {
      result.updatedPeaks[h.mint] = { price: h.price, lastUpdated: now };
    } else if (currentData) {
      currentData.lastUpdated = now;
    }
  }

  // 2. Garbage Collection for dead peaks (>48h untouched)
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  for (const [mint, data] of Object.entries(result.updatedPeaks)) {
    if (now - data.lastUpdated > FORTY_EIGHT_HOURS) {
      delete result.updatedPeaks[mint];
    }
  }

  // 3. Evaluate each active strategy
  for (const strategy of config.activeStrategies) {
    switch (strategy) {
      // ═══════════════════════════════════════
      // SAFE EXIT: Stop-Loss & Take-Profit
      // ═══════════════════════════════════════
      case "safe_exit": {
        for (const h of holdings) {
          const entryPrice = entryPriceMap[h.mint];
          if (!entryPrice || h.price <= 0) continue;
          const pnl = ((h.price - entryPrice) / entryPrice) * 100;

          if (pnl <= -Math.abs(config.safeExitStopLoss)) {
            logs.push(`🛡️ Stop-Loss triggered: ${h.symbol} at ${pnl.toFixed(1)}%`);
            result.actions.push({ type: 'sell', mint: h.mint, symbol: h.symbol, amountToSell: h.amount, decimals: h.decimals, reason: "Stop-Loss", strategy });
          } else if (pnl >= config.safeExitTakeProfit) {
            logs.push(`🛡️ Take-Profit triggered: ${h.symbol} at +${pnl.toFixed(1)}%`);
            result.actions.push({ type: 'sell', mint: h.mint, symbol: h.symbol, amountToSell: h.amount, decimals: h.decimals, reason: "Take-Profit", strategy });
          } else {
            logs.push(`🛡️ ${h.symbol}: P&L ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% (watching)`);
          }
        }
        break;
      }

      // ═══════════════════════════════════════
      // SCALPER: Quick profit target
      // ═══════════════════════════════════════
      case "scalper": {
        for (const h of holdings) {
          const entryPrice = entryPriceMap[h.mint];
          if (!entryPrice || h.price <= 0) continue;
          const pnl = ((h.price - entryPrice) / entryPrice) * 100;

          if (pnl >= config.scalperTarget) {
            logs.push(`⚡ Scalper triggered: ${h.symbol} at +${pnl.toFixed(1)}%`);
            result.actions.push({ type: 'sell', mint: h.mint, symbol: h.symbol, amountToSell: h.amount, decimals: h.decimals, reason: "Scalper", strategy });
          } else {
            logs.push(`⚡ ${h.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% (target: +${config.scalperTarget}%)`);
          }
        }
        break;
      }

      // ═══════════════════════════════════════
      // MOMENTUM RIDER: Trail peak, sell on dip
      // ═══════════════════════════════════════
      case "momentum": {
        if (holdings.length === 0) {
          logs.push(`📈 Momentum: No positions to monitor`);
          break;
        }
        
        for (const h of holdings) {
          if (h.price <= 0) continue;
          const peakData = result.updatedPeaks[h.mint];
          const peak = peakData ? peakData.price : h.price;
          const dropFromPeak = peak > 0 ? ((h.price - peak) / peak) * 100 : 0;
          const entryPrice = entryPriceMap[h.mint] || h.price;
          const pnlFromEntry = entryPrice > 0 ? ((h.price - entryPrice) / entryPrice) * 100 : 0;

          if (dropFromPeak <= -5 && pnlFromEntry > 0) {
            logs.push(`📈 Momentum reversal: ${h.symbol} dropped ${dropFromPeak.toFixed(1)}% from peak (P&L: +${pnlFromEntry.toFixed(1)}%)`);
            result.actions.push({ type: 'sell', mint: h.mint, symbol: h.symbol, amountToSell: h.amount, decimals: h.decimals, reason: `Momentum Sell (${dropFromPeak.toFixed(1)}% from peak)`, strategy });
          } else if (dropFromPeak <= -10) {
            logs.push(`📈 Momentum crash: ${h.symbol} dropped ${dropFromPeak.toFixed(1)}% from peak — emergency sell`);
            result.actions.push({ type: 'sell', mint: h.mint, symbol: h.symbol, amountToSell: h.amount, decimals: h.decimals, reason: `Momentum Emergency (${dropFromPeak.toFixed(1)}% crash)`, strategy, isEmergency: true });
          } else {
            logs.push(`📈 ${h.symbol}: $${h.price.toFixed(8)} | peak: $${peak.toFixed(8)} | ${dropFromPeak >= 0 ? '📈' : '📉'} ${dropFromPeak.toFixed(1)}% from peak`);
          }
        }
        break;
      }

      // ═══════════════════════════════════════
      // DIP BUYER: Buys >20% dips showing recovery
      // ═══════════════════════════════════════
      case "dip_buy": {
        const trending = marketContext.trendingDips;
        if (trending.length === 0) break;

        const dipCandidates = trending.filter(t => {
          const isDipping = t.priceChange1h <= -20;
          const isRecovering = t.priceChange1h > -25;
          const alreadyOwned = holdings.some(h => h.mint === t.mint);
          return isDipping && isRecovering && !alreadyOwned;
        });

        if (dipCandidates.length > 0) {
          const best = dipCandidates.sort((a, b) => b.priceChange1h - a.priceChange1h)[0];
          logs.push(`📉 Dip candidate: ${best.symbol} (${best.priceChange1h.toFixed(1)}% 1h)`);
          result.actions.push({ type: 'buy', mint: best.mint, symbol: best.symbol, amountToBuySOL: config.maxBudget, reason: `Dip Buy (${best.priceChange1h.toFixed(1)}% dip)`, strategy });
        }
        break;
      }

      // ═══════════════════════════════════════
      // NEW LAUNCH HUNTER (Polling Fallback)
      // ═══════════════════════════════════════
      case "new_launch": {
        const launches = marketContext.newLaunches;
        if (launches.length === 0) break;

        const snipeCandidates = launches.filter(t => {
          const isFresh = t.ageSeconds <= config.launchMaxAge;
          const hasLiquidity = t.liquidity >= config.launchMinLiquidity;
          const notOwned = !holdings.some(h => h.mint === t.mint);
          return isFresh && hasLiquidity && notOwned;
        });

        if (snipeCandidates.length > 0) {
          const target = snipeCandidates[0];
          logs.push(`🔥🎯 SNIPING: ${target.symbol} (${target.ageSeconds}s old, $${target.liquidity.toFixed(0)} liq)`);
          result.actions.push({ type: 'buy', mint: target.mint, symbol: target.symbol, amountToBuySOL: config.maxBudget, reason: `Launch Snipe (${target.ageSeconds}s old)`, strategy, autoSellTimer: config.launchAutoSellTimer });
        }
        break;
      }
    }
  }

  result.logs = logs;
  self.postMessage(result);
};
