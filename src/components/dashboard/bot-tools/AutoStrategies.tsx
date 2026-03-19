import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, TrendingUp, TrendingDown, ShieldCheck, Flame, Palmtree, Zap, Users, Wallet, Rocket, Cloud, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { JupiterUltraService } from "@/services/jupiter/ultra";
import { LiveTradeConfirmDialog } from "./LiveTradeConfirmDialog";
import { BudgetManager } from "./BudgetManager";
import { supabase } from "@/integrations/supabase/client";
import { AgentService } from "@/services/solana/agentService";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface Strategy {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  risk: "Low" | "Medium" | "High";
  enabled: boolean;
}

interface LiveHolding {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  price: number;
  value: number;
}

interface PendingTrade {
  id: string;
  token_mint: string;
  token_symbol: string;
  side: string;
  amount_raw: string;
  decimals: number;
  strategy: string;
  reason: string;
  pnl_percent: number;
  status: string;
}

const INITIAL_STRATEGIES: Strategy[] = [
  { id: "momentum", name: "Momentum Rider", description: "Sells on reversal (>5% drop from peak). Won't auto-buy — monitors existing positions.", icon: <TrendingUp className="h-4 w-4" />, risk: "Medium", enabled: false },
  { id: "dip_buy", name: "Dip Buyer", description: "Auto-buys tokens that dip >20% then recover >3% from low", icon: <TrendingDown className="h-4 w-4" />, risk: "High", enabled: false },
  { id: "safe_exit", name: "Safe Exit", description: "Auto stop-loss at -15% and trailing take-profit at +50%", icon: <ShieldCheck className="h-4 w-4" />, risk: "Low", enabled: false },
  { id: "new_launch", name: "New Launch Hunter", description: "Snipes new tokens on Pump.fun within first 30s of launch", icon: <Flame className="h-4 w-4" />, risk: "High", enabled: false },
  { id: "scalper", name: "Scalper", description: "Auto-sells positions at custom profit target", icon: <Zap className="h-4 w-4" />, risk: "Medium", enabled: false },
  { id: "whale_follow", name: "Whale Follow", description: "Auto-copies top leaderboard wallets' trades", icon: <Users className="h-4 w-4" />, risk: "Medium", enabled: false },
];

const riskColors: Record<string, string> = {
  Low: "bg-accent/20 text-accent border-accent/30",
  Medium: "bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30",
  High: "bg-destructive/20 text-destructive border-destructive/30",
};

interface Props {
  killSignal?: number;
}

// In-memory peak price tracking (updated each cycle)
const peakPrices = new Map<string, number>();

export const AutoStrategies = ({ killSignal = 0 }: Props) => {
  const { toast } = useToast();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  const [maxBudget, setMaxBudget] = useState("1.0");
  const [beachMode, setBeachMode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStrategyId, setPendingStrategyId] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [useHighPerformance, setUseHighPerformance] = useState(true);
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [isAgentHired, setIsAgentHired] = useState(false);
  const [isHiring, setIsHiring] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPollRef = useRef<NodeJS.Timeout | null>(null);

  // New Launch Hunter configurable parameters
  const [launchMinLiquidity, setLaunchMinLiquidity] = useState("100");
  const [launchMaxAge, setLaunchMaxAge] = useState("30");
  const [launchAutoSellTimer, setLaunchAutoSellTimer] = useState("0");
  const launchAutoSellTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const launchMinLiqRef = useRef(launchMinLiquidity);
  const launchMaxAgeRef = useRef(launchMaxAge);
  const launchAutoSellTimerRef = useRef(launchAutoSellTimer);
  launchMinLiqRef.current = launchMinLiquidity;
  launchMaxAgeRef.current = launchMaxAge;
  launchAutoSellTimerRef.current = launchAutoSellTimer;

  // Safe Exit configurable parameters
  const [safeExitStopLoss, setSafeExitStopLoss] = useState("15");
  const [safeExitTakeProfit, setSafeExitTakeProfit] = useState("50");
  const safeExitStopLossRef = useRef(safeExitStopLoss);
  const safeExitTakeProfitRef = useRef(safeExitTakeProfit);
  safeExitStopLossRef.current = safeExitStopLoss;
  safeExitTakeProfitRef.current = safeExitTakeProfit;

  // Scalper configurable parameters
  const [scalperTarget, setScalperTarget] = useState("3");
  const scalperTargetRef = useRef(scalperTarget);
  scalperTargetRef.current = scalperTarget;

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setStatusLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 39)]);
  }, []);

  // Kill switch
  useEffect(() => {
    if (killSignal > 0) {
      setStrategies(prev => prev.map(s => ({ ...s, enabled: false })));
      setBeachMode(false);
      setShowConfirm(false);
      setPendingStrategyId(null);
      setStatusLog([]);
      setExecutingTrade(false);
      setPendingTrades([]);
      peakPrices.clear();
      // Clear auto-sell timers
      for (const timer of launchAutoSellTimers.current.values()) clearTimeout(timer);
      launchAutoSellTimers.current.clear();
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      if (pendingPollRef.current) { clearInterval(pendingPollRef.current); pendingPollRef.current = null; }
    }
  }, [killSignal]);

  // Check agent status on mount / wallet change
  useEffect(() => {
    const checkStatus = async () => {
      if (wallet.publicKey) {
        const hired = await AgentService.isAgentHired(wallet.publicKey.toBase58());
        setIsAgentHired(hired);
      }
    };
    checkStatus();
  }, [wallet.publicKey]);

  const handleHireDan = async () => {
    if (!wallet.publicKey) return;
    setIsHiring(true);
    try {
      const signature = await AgentService.hireDan(wallet);
      setIsAgentHired(true);
      addLog(`🤝 D3MON DAN HIRED! Proxy trade authority delegated (tx: ${signature.slice(0, 8)}...)`);
      toast({
        title: "🤝 D3MON Dan Hired!",
        description: "Your personal agent is now authorized to trade on-chain 24/7.",
      });
    } catch (e: any) {
      toast({ title: "Failed to hire Dan", description: e.message, variant: "destructive" });
    } finally {
      setIsHiring(false);
    }
  };

  // Fetch live wallet holdings via edge function
  const fetchLiveHoldings = useCallback(async (): Promise<LiveHolding[]> => {
    if (!wallet.publicKey) return [];
    try {
      const { data, error } = await supabase.functions.invoke("wallet-portfolio", {
        body: { wallet_address: wallet.publicKey.toBase58() },
      });
      if (error || !data?.success) return [];
      const tokens = data.data?.tokens || [];
      return tokens.map((t: any) => ({
        mint: t.mint,
        symbol: t.symbol || t.mint.slice(0, 6),
        amount: t.amount,
        decimals: t.decimals || 6,
        price: t.price,
        value: t.value,
      }));
    } catch {
      return [];
    }
  }, [wallet.publicKey]);

  // Execute a SELL via Jupiter Ultra (token → SOL)
  const executeLiveSell = useCallback(async (
    holding: LiveHolding | { mint: string; symbol: string; amount: number; decimals: number },
    reason: string
  ): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction || executingTrade) return false;

    try {
      setExecutingTrade(true);
      addLog(`🔄 ${reason}: Selling ${holding.symbol}...`);

      const rawAmount = Math.floor(holding.amount * Math.pow(10, holding.decimals));
            const result = await JupiterUltraService.swap(
          wallet,
          holding.mint,
          SOL_MINT,
          rawAmount.toString(),
          'ExactIn',
          useHighPerformance
        );

      if (result?.status === 'Success') {
        addLog(`✅ ${reason}: Sold ${holding.amount.toFixed(4)} ${holding.symbol} — tx: ${result.signature?.slice(0, 8)}...`);
        
        // Clean up entry/peak prices
        if (wallet.publicKey) {
          await (supabase.from('auto_trade_entry_prices' as any) as any)
            .delete()
            .eq('wallet_address', wallet.publicKey.toBase58())
            .eq('token_mint', holding.mint);
        }
        peakPrices.delete(holding.mint);
        return true;
      } else {
        addLog(`❌ ${reason}: Sell failed — ${result?.error || 'Unknown error'}`);
        return false;
      }
    } catch (e: any) {
      addLog(`❌ ${reason}: ${e.message}`);
      return false;
    } finally {
      setExecutingTrade(false);
    }
  }, [wallet, executingTrade, addLog, useHighPerformance]);

  // Execute a BUY via Jupiter Ultra (SOL → token)
  const executeLiveBuy = useCallback(async (
    tokenMint: string,
    tokenSymbol: string,
    solAmount: number,
    reason: string
  ): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction || executingTrade) return false;

    try {
      setExecutingTrade(true);
      addLog(`🔄 ${reason}: Buying ${tokenSymbol} for ${solAmount} SOL...`);

      // SOL has 9 decimals
      const rawAmount = Math.floor(solAmount * 1e9).toString();

        const result = await JupiterUltraService.swap(
          wallet,
          SOL_MINT,
          tokenMint,
          rawAmount,
          'ExactIn',
          useHighPerformance
        );

      if (result?.status === 'Success') {
        addLog(`✅ ${reason}: Bought ${tokenSymbol} for ${solAmount} SOL — tx: ${result.signature?.slice(0, 8)}...`);
        
        // Record entry price for the newly bought token
        // We'll pick it up on the next scan cycle
        return true;
      } else {
        addLog(`❌ ${reason}: Buy failed — ${result?.error || 'Unknown error'}`);
        return false;
      }
    } catch (e: any) {
      addLog(`❌ ${reason}: ${e.message}`);
      return false;
    } finally {
      setExecutingTrade(false);
    }
  }, [wallet, executingTrade, addLog]);

  // Fetch trending tokens from Birdeye for dip buying
  const fetchTrendingForDips = useCallback(async (): Promise<Array<{ mint: string; symbol: string; price: number; priceChange1h: number }>> => {
    try {
      const { data, error } = await supabase.functions.invoke("token-prices", {
        body: { action: "trending" },
      });
      if (error || !data?.success) return [];
      const tokens = data.data || [];
      return tokens
        .filter((t: any) => t.address && t.price > 0 && t.priceChange1h !== undefined)
        .map((t: any) => ({
          mint: t.address,
          symbol: t.symbol || t.address.slice(0, 6),
          price: t.price,
          priceChange1h: t.priceChange1h || 0,
        }));
    } catch {
      return [];
    }
  }, []);

  // Fetch brand new Pump.fun launches for sniping
  const fetchNewLaunches = useCallback(async (): Promise<Array<{
    mint: string; symbol: string; name: string; price: number;
    marketCap: number; liquidity: number; ageSeconds: number;
  }>> => {
    try {
      const { data, error } = await supabase.functions.invoke("pumpfun-api", {
        body: { action: "new_launches", limit: 10 },
      });
      if (error) return [];
      const tokens = data?.tokens || [];
      const now = Date.now();
      return tokens
        .filter((t: any) => t.address && t.price > 0)
        .map((t: any) => ({
          mint: t.address,
          symbol: t.symbol || t.address.slice(0, 6),
          name: t.name || t.symbol || '',
          price: t.price,
          marketCap: t.marketCap || 0,
          liquidity: t.liquidity || 0,
          ageSeconds: t.pairCreatedAt ? Math.floor((now - t.pairCreatedAt) / 1000) : 999,
        }));
    } catch {
      return [];
    }
  }, []);

  // Poll for pending trades from Beach Mode
  const executePendingTrades = useCallback(async () => {
    if (!wallet.publicKey || executingTrade) return;

    try {
      const { data: pending, error } = await (supabase
        .from('pending_auto_trades' as any)
        .select('*') as any)
        .eq('wallet_address', wallet.publicKey.toBase58())
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5);

      if (error || !pending || pending.length === 0) return;

      setPendingTrades(pending as any);
      addLog(`📋 Found ${pending.length} pending Beach Mode trade(s)`);

      for (const trade of pending as PendingTrade[]) {
        if (executingTrade) break;

        let success = false;

        if (trade.side === 'sell') {
          const amount = parseInt(trade.amount_raw) / Math.pow(10, trade.decimals);
          success = await executeLiveSell(
            { mint: trade.token_mint, symbol: trade.token_symbol || trade.token_mint.slice(0, 6), amount, decimals: trade.decimals },
            `🏖️ Beach: ${trade.reason || trade.strategy}`
          );
        } else if (trade.side === 'buy') {
          // amount_raw for buy = lamports of SOL to spend
          const solAmount = parseInt(trade.amount_raw) / 1e9;
          success = await executeLiveBuy(
            trade.token_mint,
            trade.token_symbol || trade.token_mint.slice(0, 6),
            solAmount,
            `🏖️ Beach: ${trade.reason || trade.strategy}`
          );
        }

        await (supabase.from('pending_auto_trades' as any) as any)
          .update({ status: success ? 'executed' : 'failed', executed_at: new Date().toISOString() })
          .eq('id', trade.id);

        if (success) {
          toast({
            title: `🏖️ Beach Mode Trade Executed`,
            description: `${trade.reason}: ${trade.side === 'buy' ? 'Bought' : 'Sold'} ${trade.token_symbol}`,
          });
        }
      }

      const { data: remaining } = await (supabase.from('pending_auto_trades' as any).select('*') as any)
        .eq('wallet_address', wallet.publicKey!.toBase58())
        .eq('status', 'pending');
      setPendingTrades((remaining || []) as any);
    } catch (e: any) {
      console.error('executePendingTrades error:', e);
    }
  }, [wallet.publicKey, executingTrade, executeLiveSell, executeLiveBuy, addLog, toast]);

  // Start polling for pending Beach Mode trades
  useEffect(() => {
    if (!wallet.publicKey) return;
    executePendingTrades();
    pendingPollRef.current = setInterval(executePendingTrades, 30000);
    return () => { if (pendingPollRef.current) { clearInterval(pendingPollRef.current); pendingPollRef.current = null; } };
  }, [wallet.publicKey, executePendingTrades]);

  // Record entry prices to DB
  const recordEntryPrices = useCallback(async (holdings: LiveHolding[]) => {
    if (!wallet.publicKey) return;
    const walletAddr = wallet.publicKey.toBase58();
    for (const h of holdings) {
      if (h.price > 0) {
        try {
          await (supabase.from('auto_trade_entry_prices' as any) as any).upsert({
            wallet_address: walletAddr,
            token_mint: h.mint,
            entry_price: h.price,
          }, { onConflict: 'wallet_address,token_mint' });
        } catch { /* ignore */ }
      }
    }
  }, [wallet.publicKey]);

  // Update peak prices in DB for Beach Mode persistence
  const updatePeakPrices = useCallback(async (holdings: LiveHolding[]) => {
    if (!wallet.publicKey) return;
    const walletAddr = wallet.publicKey.toBase58();
    for (const h of holdings) {
      if (h.price <= 0) continue;
      const currentPeak = peakPrices.get(h.mint) || 0;
      if (h.price > currentPeak) {
        peakPrices.set(h.mint, h.price);
        try {
          await (supabase.from('auto_trade_entry_prices' as any) as any)
            .update({ peak_price: h.price })
            .eq('wallet_address', walletAddr)
            .eq('token_mint', h.mint);
        } catch { /* ignore */ }
      }
    }
  }, [wallet.publicKey]);

  const activeStrategyKey = strategies.filter(s => s.enabled).map(s => s.id).join(',');
  const strategiesRef = useRef(strategies);
  strategiesRef.current = strategies;
  const maxBudgetRef = useRef(maxBudget);
  maxBudgetRef.current = maxBudget;

  // Polling loop for active strategies
  useEffect(() => {
    if (!activeStrategyKey) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }

    const evaluateStrategies = async () => {
      const enabled = strategiesRef.current.filter(s => s.enabled);
      if (enabled.length === 0) return;

      addLog(`Scanning ${enabled.length} strategy(ies)...`);

      if (!wallet.publicKey) {
        addLog("⚠️ Wallet not connected — skipping");
        return;
      }

      const holdings = await fetchLiveHoldings();
      if (holdings.length === 0 && !enabled.some(s => s.id === 'dip_buy' || s.id === 'new_launch')) {
        addLog("No token holdings found in wallet");
        return;
      }

      if (holdings.length > 0) {
        addLog(`Found ${holdings.length} token(s) in wallet`);
      }

      // Record entry prices to DB
      await recordEntryPrices(holdings);

      // Get entry prices from DB (includes peak_price)
      const { data: entryRows } = await (supabase
        .from('auto_trade_entry_prices' as any)
        .select('*') as any)
        .eq('wallet_address', wallet.publicKey.toBase58());

      const entryPriceMap = new Map<string, number>();
      const dbPeakMap = new Map<string, number>();
      for (const ep of (entryRows || [])) {
        entryPriceMap.set((ep as any).token_mint, Number((ep as any).entry_price));
        if ((ep as any).peak_price) {
          dbPeakMap.set((ep as any).token_mint, Number((ep as any).peak_price));
        }
      }

      // Sync peak prices from DB
      for (const [mint, peak] of dbPeakMap) {
        const currentPeak = peakPrices.get(mint) || 0;
        if (peak > currentPeak) peakPrices.set(mint, peak);
      }

      // Track new tokens
      for (const h of holdings) {
        if (!entryPriceMap.has(h.mint) && h.price > 0) {
          entryPriceMap.set(h.mint, h.price);
          addLog(`📌 Tracking ${h.symbol} entry: $${h.price.toFixed(8)}`);
        }
      }

      // Update peak prices
      await updatePeakPrices(holdings);

      for (const strategy of enabled) {
        try {
          switch (strategy.id) {
            // ═══════════════════════════════════════
            // SAFE EXIT: -15% stop-loss, +50% take-profit
            // ═══════════════════════════════════════
            case "safe_exit": {
              for (const h of holdings) {
                const entryPrice = entryPriceMap.get(h.mint);
                if (!entryPrice || h.price <= 0) continue;
                const pnl = ((h.price - entryPrice) / entryPrice) * 100;

                const stopLossThreshold = -parseFloat(safeExitStopLossRef.current || "15");
                const takeProfitThreshold = parseFloat(safeExitTakeProfitRef.current || "50");

                if (pnl <= stopLossThreshold) {
                  addLog(`🛡️ Stop-Loss triggered: ${h.symbol} at ${pnl.toFixed(1)}%`);
                  await executeLiveSell(h, "Stop-Loss");
                } else if (pnl >= takeProfitThreshold) {
                  addLog(`🛡️ Take-Profit triggered: ${h.symbol} at +${pnl.toFixed(1)}%`);
                  await executeLiveSell(h, "Take-Profit");
                } else {
                  addLog(`🛡️ ${h.symbol}: P&L ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% (watching)`);
                }
              }
              break;
            }

            // ═══════════════════════════════════════
            // SCALPER: sell on +3% gain
            // ═══════════════════════════════════════
            case "scalper": {
              const scalperThreshold = parseFloat(scalperTargetRef.current || "3");
              for (const h of holdings) {
                const entryPrice = entryPriceMap.get(h.mint);
                if (!entryPrice || h.price <= 0) continue;
                const pnl = ((h.price - entryPrice) / entryPrice) * 100;

                if (pnl >= scalperThreshold) {
                  addLog(`⚡ Scalper triggered: ${h.symbol} at +${pnl.toFixed(1)}%`);
                  await executeLiveSell(h, "Scalper");
                } else {
                  addLog(`⚡ ${h.symbol}: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}% (target: +${scalperThreshold}%)`);
                }
              }
              break;
            }

            // ═══════════════════════════════════════
            // MOMENTUM RIDER: tracks peak, sells on >5% reversal from peak
            // ═══════════════════════════════════════
            case "momentum": {
              if (holdings.length === 0) {
                addLog(`📈 Momentum: No positions to monitor`);
                break;
              }
              addLog(`📈 Momentum: Scanning ${holdings.length} position(s) for reversals`);

              for (const h of holdings) {
                if (h.price <= 0) continue;

                const peak = peakPrices.get(h.mint) || h.price;
                const dropFromPeak = peak > 0 ? ((h.price - peak) / peak) * 100 : 0;
                const entryPrice = entryPriceMap.get(h.mint) || h.price;
                const pnlFromEntry = entryPrice > 0 ? ((h.price - entryPrice) / entryPrice) * 100 : 0;

                if (dropFromPeak <= -5 && pnlFromEntry > 0) {
                  // Reversal detected: price dropped >5% from peak AND we're still in profit
                  addLog(`📈 Momentum reversal: ${h.symbol} dropped ${dropFromPeak.toFixed(1)}% from peak $${peak.toFixed(8)} (P&L: +${pnlFromEntry.toFixed(1)}%)`);
                  await executeLiveSell(h, `Momentum Sell (${dropFromPeak.toFixed(1)}% from peak)`);
                } else if (dropFromPeak <= -10) {
                  // Severe reversal: sell even at a loss
                  addLog(`📈 Momentum crash: ${h.symbol} dropped ${dropFromPeak.toFixed(1)}% from peak — emergency sell`);
                  await executeLiveSell(h, `Momentum Emergency (${dropFromPeak.toFixed(1)}% crash)`);
                } else {
                  addLog(`📈 ${h.symbol}: $${h.price.toFixed(8)} | peak: $${peak.toFixed(8)} | ${dropFromPeak >= 0 ? '📈' : '📉'} ${dropFromPeak.toFixed(1)}% from peak`);
                }
              }
              break;
            }

            // ═══════════════════════════════════════
            // DIP BUYER: buys tokens that dipped >20% and are recovering >3%
            // ═══════════════════════════════════════
            case "dip_buy": {
              const budget = parseFloat(maxBudgetRef.current) || 1.0;
              addLog(`📉 Dip Buyer: Scanning market for >20% dips with recovery (budget: ${budget} SOL)`);

              try {
                const trending = await fetchTrendingForDips();
                if (trending.length === 0) {
                  addLog(`📉 No trending data available`);
                  break;
                }

                // Find tokens that dipped >20% in 1h but are showing recovery (change > -17%, meaning partial bounce)
                const dipCandidates = trending.filter(t => {
                  // Token dropped >20% in last hour
                  const isDipping = t.priceChange1h <= -20;
                  // But showing recovery (not still falling — change is less negative than -25%)
                  const isRecovering = t.priceChange1h > -25;
                  // Not already owned
                  const alreadyOwned = holdings.some(h => h.mint === t.mint);
                  return isDipping && isRecovering && !alreadyOwned;
                });

                if (dipCandidates.length === 0) {
                  addLog(`📉 No qualifying dip candidates found`);
                  break;
                }

                // Take the best candidate (smallest dip = closest to recovery)
                const best = dipCandidates.sort((a, b) => b.priceChange1h - a.priceChange1h)[0];
                
                addLog(`📉 Dip candidate: ${best.symbol} (${best.priceChange1h.toFixed(1)}% 1h) — buying ${budget} SOL`);
                await executeLiveBuy(
                  best.mint,
                  best.symbol,
                  budget,
                  `Dip Buy: ${best.symbol} (${best.priceChange1h.toFixed(1)}% dip)`
                );
              } catch (e: any) {
                addLog(`📉 Dip Buyer error: ${e.message}`);
              }
              break;
            }

            // ═══════════════════════════════════════
            // NEW LAUNCH HUNTER: snipes new Pump.fun tokens
            // ═══════════════════════════════════════
            case "new_launch": {
              const budget = parseFloat(maxBudgetRef.current) || 1.0;
              const minLiq = parseFloat(launchMinLiqRef.current) || 100;
              const maxAge = parseInt(launchMaxAgeRef.current) || 30;
              const autoSellSec = parseInt(launchAutoSellTimerRef.current) || 0;
              addLog(`🔥 Launch Hunter: Scanning (budget: ${budget} SOL, liq≥$${minLiq}, age≤${maxAge}s${autoSellSec > 0 ? `, auto-sell: ${autoSellSec}s` : ''})`);

              try {
                const launches = await fetchNewLaunches();
                if (launches.length === 0) {
                  addLog(`🔥 No new launches detected`);
                  break;
                }

                const snipeCandidates = launches.filter(t => {
                  const isFresh = t.ageSeconds <= maxAge;
                  const hasLiquidity = t.liquidity >= minLiq;
                  const notOwned = !holdings.some(h => h.mint === t.mint);
                  return isFresh && hasLiquidity && notOwned;
                });

                if (snipeCandidates.length === 0) {
                  const newest = launches[0];
                  addLog(`🔥 Newest: ${newest.symbol} (${newest.ageSeconds}s old, $${newest.liquidity.toFixed(0)} liq) — waiting for ≤${maxAge}s & ≥$${minLiq}`);
                  break;
                }

                const target = snipeCandidates[0];
                addLog(`🔥🎯 SNIPING: ${target.symbol} (${target.name}) — ${target.ageSeconds}s old, $${target.liquidity.toFixed(0)} liq, ${budget} SOL`);
                
                const success = await executeLiveBuy(
                  target.mint,
                  target.symbol,
                  budget,
                  `🔥 Launch Snipe: ${target.symbol} (${target.ageSeconds}s old)`
                );

                if (success) {
                  addLog(`🔥✅ Sniped ${target.symbol} for ${budget} SOL!`);
                  
                  // D3MON Dan's autonomous execution log
                  if (autoSellSec > 0 && !launchAutoSellTimers.current.has(target.mint)) {
                    addLog(`⏱️ Auto-sell timer set: ${target.symbol} in ${autoSellSec}s`);
                    const timer = setTimeout(async () => {
                      launchAutoSellTimers.current.delete(target.mint);
                      addLog(`⏱️ Auto-sell timer fired for ${target.symbol} — fetching position...`);
                      const currentHoldings = await fetchLiveHoldings();
                      const position = currentHoldings.find(h => h.mint === target.mint);
                      if (position && position.amount > 0) {
                        await executeLiveSell(position, `⏱️ Auto-Sell Timer (${autoSellSec}s)`);
                      } else {
                        addLog(`⏱️ ${target.symbol} no longer in wallet — skipping auto-sell`);
                      }
                    }, autoSellSec * 1000);
                    launchAutoSellTimers.current.set(target.mint, timer);
                  }
                }
              } catch (e: any) {
                addLog(`🔥 Launch Hunter error: ${e.message}`);
              }
              break;
            }

            case "whale_follow": {
              addLog(`🐋 Whale Follow: Monitoring top wallets`);
              break;
            }
            default:
              addLog(`🔍 ${strategy.name}: Active`);
          }
        } catch (e: any) {
          addLog(`❌ ${strategy.name}: ${e.message}`);
        }
      }
    };

    evaluateStrategies();
    // Use 10s interval when New Launch Hunter is active (needs speed), 15s otherwise
    const hasLaunchHunter = strategiesRef.current.some(s => s.id === 'new_launch' && s.enabled);
    pollingRef.current = setInterval(evaluateStrategies, hasLaunchHunter ? 10000 : 15000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [activeStrategyKey, wallet.publicKey, fetchLiveHoldings, executeLiveSell, executeLiveBuy, addLog, recordEntryPrices, updatePeakPrices, fetchTrendingForDips, fetchNewLaunches]);
  const saveBotConfig = useCallback(async (botType: string, config: Record<string, unknown>, isActive: boolean) => {
    if (!wallet.publicKey) return;
    const walletAddr = wallet.publicKey.toBase58();
    try {
      const { data: existing } = await (supabase.from('sim_bot_configs' as any).select('id') as any)
        .eq('wallet_address', walletAddr)
        .eq('bot_type', botType)
        .maybeSingle();
      if (existing) {
        await (supabase.from('sim_bot_configs' as any) as any)
          .update({ config, is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await (supabase.from('sim_bot_configs' as any) as any)
          .insert({ wallet_address: walletAddr, bot_type: botType, config, is_active: isActive });
      }
    } catch (err: any) {
      console.error('Save bot config error:', err);
    }
  }, [wallet.publicKey]);

  const proceedToggle = (id: string) => {
    setStrategies((prev) => {
      const updated = prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s);
      const target = updated.find(s => s.id === id);
      const activeIds = updated.filter(s => s.enabled).map(s => s.id);

      saveBotConfig('auto', {
        strategies: activeIds,
        maxBudget: parseFloat(maxBudget),
        beachMode,
        launchMinLiquidity: parseFloat(launchMinLiquidity),
        launchMaxAge: parseInt(launchMaxAge),
        launchAutoSellTimer: parseInt(launchAutoSellTimer),
        safeExitStopLoss: parseFloat(safeExitStopLoss),
        safeExitTakeProfit: parseFloat(safeExitTakeProfit),
        scalperTarget: parseFloat(scalperTarget),
      }, activeIds.length > 0);

      setTimeout(() => {
        if (target) {
          if (target.enabled) {
            addLog(`✅ ${target.name} activated`);
            toast({ title: `${target.name} Enabled`, description: `LIVE: ${target.description}` });
          } else {
            addLog(`⏹️ ${target.name} deactivated`);
            toast({ title: `${target.name} Disabled`, description: "Deactivated" });
          }
        }
      }, 0);

      return updated;
    });
  };

  const toggleStrategy = (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;
    
    if (!wallet.publicKey) {
      toast({ title: "Wallet not connected", description: "Connect your wallet to use auto strategies", variant: "destructive" });
      return;
    }
    
    if (strategy.enabled) { proceedToggle(id); return; }
    setPendingStrategyId(id);
    setShowConfirm(true);
  };

  const handleBeachMode = (checked: boolean) => {
    setBeachMode(checked);
    const activeIds = strategies.filter(s => s.enabled).map(s => s.id);
    saveBotConfig('auto', {
      strategies: activeIds,
      maxBudget: parseFloat(maxBudget),
      beachMode: checked,
      launchMinLiquidity: parseFloat(launchMinLiquidity),
      launchMaxAge: parseInt(launchMaxAge),
      launchAutoSellTimer: parseInt(launchAutoSellTimer),
      safeExitStopLoss: parseFloat(safeExitStopLoss),
      safeExitTakeProfit: parseFloat(safeExitTakeProfit),
      scalperTarget: parseFloat(scalperTarget),
    }, activeIds.length > 0);
    toast({
      title: checked ? "🏖️ Beach Mode ON" : "Beach Mode OFF",
      description: checked
        ? "Auto-trader will scan your real wallet every minute & queue trades for execution"
        : "Background execution disabled",
    });
  };

  const activeCount = strategies.filter((s) => s.enabled).length;
  const pendingStrategy = strategies.find(s => s.id === pendingStrategyId);

  return (
    <div className="space-y-4">
      <LiveTradeConfirmDialog
        open={showConfirm}
        onConfirm={() => { setShowConfirm(false); if (pendingStrategyId) { proceedToggle(pendingStrategyId); setPendingStrategyId(null); } }}
        onCancel={() => { setShowConfirm(false); setPendingStrategyId(null); }}
        action={`Auto Strategy: ${pendingStrategy?.name || "Unknown"}`}
        tokenSymbol="All matching tokens"
        solAmount={parseFloat(maxBudget)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold text-foreground">D3MON DAN'S WAR ROOM</span>
        </div>
        <div className="flex items-center gap-1">
          {executingTrade && (
            <Badge className="bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30 animate-pulse">
              Executing...
            </Badge>
          )}
          {activeCount > 0 && (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 animate-pulse">
              {activeCount} active (LIVE)
            </Badge>
          )}
        </div>
      </div>

      <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isAgentHired ? 'bg-chart-green animate-pulse' : 'bg-muted'}`} />
            <span className="text-sm font-bold tracking-tight">
              AGENT STATUS: {isAgentHired ? 'HIRED & ACTIVE' : 'NOT HIRED'}
            </span>
          </div>
          {!isAgentHired && (
            <Button 
              size="sm" 
              className="h-7 text-[10px] bg-accent hover:bg-accent/80 text-foreground font-bold"
              onClick={handleHireDan}
              disabled={isHiring}
            >
              {isHiring ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Users className="h-3 w-3 mr-1" />}
              HIRE D3MON DAN
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-accent" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold">24/7 Cloud Execution (Beach Mode)</Label>
                <div className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border border-primary/20">
                  <Cloud className="w-2.5 h-2.5" />
                  CLOUD
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Dan trades for you even when you're offline</p>
            </div>
          </div>
          <Switch checked={beachMode} onCheckedChange={handleBeachMode} />
        </div>
      </div>

      {beachMode && activeCount > 0 && (
        <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
          <p className="text-[11px] text-accent font-medium flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            D3MON DAN PROTECTED: {activeCount} strategies active 24/7 in the cloud.
          </p>
        </div>
      )}

      {/* Pending Beach Mode Trades */}
      {pendingTrades.length > 0 && (
        <div className="p-2 rounded-lg bg-[hsl(var(--fun-yellow))]/10 border border-[hsl(var(--fun-yellow))]/30">
          <p className="text-[11px] text-[hsl(var(--fun-yellow))] font-medium mb-1">
            📋 {pendingTrades.length} pending Beach Mode trade(s) — executing now...
          </p>
          {pendingTrades.map(t => (
            <p key={t.id} className="text-[10px] text-muted-foreground font-mono">
              {t.side === 'buy' ? '🟢' : '🔴'} {t.token_symbol}: {t.reason} ({t.pnl_percent?.toFixed(1)}%)
            </p>
          ))}
        </div>
      )}

      {/* High Performance Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">High Performance</span>
            <p className="text-[10px] text-muted-foreground">Staked connections + Helius Sender</p>
          </div>
        </div>
        <Switch 
          checked={useHighPerformance}
          onCheckedChange={setUseHighPerformance}
          disabled={activeCount > 0}
        />
      </div>

      {/* Budget Management */}
      <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Trading Budget</span>
        </div>
        <BudgetManager />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Max budget per trade (SOL)</Label>
        <Input type="number" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} className="bg-muted/30 border-border text-sm mt-1" min="0.1" step="0.1" />
      </div>

      <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
        <p className="text-[11px] text-destructive font-medium">⚠️ LIVE MODE — All strategies execute real trades via Jupiter Ultra (gasless). Momentum sells on reversal, Dip Buyer auto-buys dips. Beach Mode queues trades server-side.</p>
      </div>

      {/* Status Log */}
      {statusLog.length > 0 && (
        <div className="p-2 rounded-lg bg-muted/20 border border-border max-h-48 overflow-y-auto">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Activity Log</p>
          {statusLog.map((log, i) => (
            <p key={i} className={`text-[10px] font-mono leading-tight ${
              log.includes('✅') || log.includes('Sold') || log.includes('Bought') ? 'text-accent' :
              log.includes('❌') ? 'text-destructive' :
              log.includes('🔄') || log.includes('🏖️') ? 'text-[hsl(var(--fun-yellow))]' :
              log.includes('📈') || log.includes('📉') ? 'text-primary' :
              'text-muted-foreground'
            }`}>{log}</p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {strategies.map((strategy) => (
          <div key={strategy.id} className={`p-3 rounded-lg border transition-all ${strategy.enabled ? "bg-destructive/5 border-destructive/30" : "bg-muted/10 border-border"}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={strategy.enabled ? "text-destructive" : "text-muted-foreground"}>{strategy.icon}</span>
                <span className="text-sm font-medium text-foreground">{strategy.name}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskColors[strategy.risk]}`}>{strategy.risk}</Badge>
                {(strategy.id === "safe_exit" || strategy.id === "scalper" || strategy.id === "momentum") && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent border-accent/30">
                    Auto-Sell
                  </Badge>
                )}
                {(strategy.id === "dip_buy" || strategy.id === "new_launch") && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                    Auto-Buy
                  </Badge>
                )}
              </div>
              <Switch 
                checked={strategy.enabled} 
                onCheckedChange={() => toggleStrategy(strategy.id)} 
                disabled={executingTrade}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-6">{strategy.description}</p>

            {/* Safe Exit configurable parameters */}
            {strategy.id === "safe_exit" && (
              <div className="mt-2 pl-6 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Stop-Loss %</Label>
                    <Input
                      type="number"
                      value={safeExitStopLoss}
                      onChange={(e) => setSafeExitStopLoss(e.target.value)}
                      className="bg-muted/30 border-border text-xs h-7 mt-0.5"
                      min="1"
                      max="100"
                      step="1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Take-Profit %</Label>
                    <Input
                      type="number"
                      value={safeExitTakeProfit}
                      onChange={(e) => setSafeExitTakeProfit(e.target.value)}
                      className="bg-muted/30 border-border text-xs h-7 mt-0.5"
                      min="1"
                      max="1000"
                      step="5"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Auto-sells on -{safeExitStopLoss}% loss or +{safeExitTakeProfit}% gain
                </p>
              </div>
            )}

            {/* Scalper configurable parameters */}
            {strategy.id === "scalper" && (
              <div className="mt-2 pl-6 space-y-2">
                <div className="grid grid-cols-1 gap-2 max-w-[140px]">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Profit Target %</Label>
                    <Input
                      type="number"
                      value={scalperTarget}
                      onChange={(e) => setScalperTarget(e.target.value)}
                      className="bg-muted/30 border-border text-xs h-7 mt-0.5"
                      min="0.5"
                      max="100"
                      step="0.5"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Auto-sells on +{scalperTarget}% gain
                </p>
              </div>
            )}

            {/* New Launch Hunter configurable parameters */}
            {strategy.id === "new_launch" && (
              <div className="mt-2 pl-6 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Min Liquidity ($)</Label>
                    <Input
                      type="number"
                      value={launchMinLiquidity}
                      onChange={(e) => setLaunchMinLiquidity(e.target.value)}
                      className="bg-muted/30 border-border text-xs h-7 mt-0.5"
                      min="0"
                      step="50"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Max Age (sec)</Label>
                    <Input
                      type="number"
                      value={launchMaxAge}
                      onChange={(e) => setLaunchMaxAge(e.target.value)}
                      className="bg-muted/30 border-border text-xs h-7 mt-0.5"
                      min="5"
                      step="5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Auto-Sell (sec)</Label>
                    <Input
                      type="number"
                      value={launchAutoSellTimer}
                      onChange={(e) => setLaunchAutoSellTimer(e.target.value)}
                      className="bg-muted/30 border-border text-xs h-7 mt-0.5"
                      min="0"
                      step="10"
                      placeholder="0 = off"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {parseInt(launchAutoSellTimer) > 0
                    ? `⏱️ Auto-sells ${launchAutoSellTimer}s after each snipe`
                    : "Auto-sell disabled — relies on other strategies to exit"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
