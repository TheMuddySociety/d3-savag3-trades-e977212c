import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SimWallet {
  sol_balance: number;
}

interface SimHolding {
  id: string;
  token_address: string;
  token_symbol: string;
  amount: number;
  avg_buy_price: number;
  total_invested: number;
  current_price?: number;
  current_value?: number;
  pnl_percent?: number;
}

interface SimOrder {
  id: string;
  bot_type: string;
  token_address: string;
  token_symbol: string;
  side: string;
  sol_amount: number;
  token_amount: number;
  price_at_execution: number;
  pnl_percent?: number;
  status: string;
  created_at: string;
}

interface BuyResult {
  order: SimOrder;
  execution_price: number;
  token_amount: number;
  slippage_percent: string;
  remaining_sol: number;
}

interface SellResult {
  order: SimOrder;
  execution_price: number;
  sol_received: number;
  pnl_percent: string;
  remaining_sol: number;
}

export function useSimTrading(walletAddress: string | null) {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<SimWallet | null>(null);
  const [holdings, setHoldings] = useState<SimHolding[]>([]);
  const [orders, setOrders] = useState<SimOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);

  const invoke = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!walletAddress) throw new Error('No wallet connected');
    const { data, error } = await supabase.functions.invoke('sim-trading', {
      body: { action, wallet_address: walletAddress, ...extra },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Unknown error');
    return data.data;
  }, [walletAddress]);

  const initWallet = useCallback(async () => {
    if (!walletAddress) return;
    try {
      setIsLoading(true);
      await invoke('init_wallet');
      const portfolio = await invoke('get_portfolio');
      setWallet(portfolio.wallet);
      setHoldings(portfolio.holdings);
      setTotalValue(portfolio.total_value);
      const orderData = await invoke('get_orders');
      setOrders(orderData);
    } catch (err: any) {
      console.error('Init sim wallet error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, invoke]);

  useEffect(() => {
    initWallet();
  }, [initWallet]);

  const simulateBuy = useCallback(async (
    tokenAddress: string,
    tokenSymbol: string,
    solAmount: number,
    botType: string,
    priceOverride?: number,
  ): Promise<BuyResult | null> => {
    try {
      setIsLoading(true);
      const result = await invoke('sim_buy', {
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        sol_amount: solAmount,
        bot_type: botType,
        price_override: priceOverride,
      });
      toast({
        title: `🎯 Simulated Buy: ${tokenSymbol}`,
        description: `Bought ${result.token_amount.toFixed(2)} tokens for ${solAmount} SOL (slippage: ${result.slippage_percent}%)`,
      });
      await initWallet(); // Refresh
      return result;
    } catch (err: any) {
      toast({ title: 'Sim Buy Failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [invoke, toast, initWallet]);

  const simulateSell = useCallback(async (
    tokenAddress: string,
    tokenSymbol: string,
    sellPercent: number,
    botType: string,
    priceOverride?: number,
  ): Promise<SellResult | null> => {
    try {
      setIsLoading(true);
      const result = await invoke('sim_sell', {
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        sell_percent: sellPercent,
        bot_type: botType,
        price_override: priceOverride,
      });
      const pnlEmoji = parseFloat(result.pnl_percent) >= 0 ? '📈' : '📉';
      toast({
        title: `${pnlEmoji} Simulated Sell: ${tokenSymbol}`,
        description: `Received ${result.sol_received.toFixed(4)} SOL (P&L: ${result.pnl_percent}%)`,
      });
      await initWallet();
      return result;
    } catch (err: any) {
      toast({ title: 'Sim Sell Failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [invoke, toast, initWallet]);

  const saveBotConfig = useCallback(async (botType: string, config: Record<string, unknown>, isActive: boolean) => {
    try {
      await invoke('save_bot_config', { bot_type: botType, config, is_active: isActive });
    } catch (err: any) {
      console.error('Save bot config error:', err);
    }
  }, [invoke]);

  const resetWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      await invoke('reset_wallet');
      toast({ title: '🔄 Wallet Reset', description: 'Simulation wallet reset to 10 SOL' });
      await initWallet();
    } catch (err: any) {
      toast({ title: 'Reset Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [invoke, toast, initWallet]);

  return {
    wallet,
    holdings,
    orders,
    totalValue,
    isLoading,
    simulateBuy,
    simulateSell,
    saveBotConfig,
    resetWallet,
    refreshPortfolio: initWallet,
  };
}
