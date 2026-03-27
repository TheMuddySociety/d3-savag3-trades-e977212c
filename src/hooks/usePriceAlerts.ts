import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface PriceAlert {
  id: string;
  wallet_address: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  target_price: number;
  direction: 'above' | 'below';
  current_price_at_creation: number;
  triggered: boolean;
  triggered_at: string | null;
  created_at: string;
}

// Simple alert sound using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.7);
  } catch {
    // Audio not supported
  }
}

export function usePriceAlerts(walletAddress: string | null) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch alerts for this wallet
  const fetchAlerts = useCallback(async () => {
    if (!walletAddress) { setAlerts([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAlerts(data as unknown as PriceAlert[]);
    }
    setLoading(false);
  }, [walletAddress]);

  // Create alert
  const createAlert = useCallback(async (params: {
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    targetPrice: number;
    direction: 'above' | 'below';
    currentPrice: number;
  }) => {
    if (!walletAddress) {
      toast({ title: 'Connect wallet', description: 'Please connect your wallet to set alerts.', variant: 'destructive' });
      return null;
    }

    const { data, error } = await supabase
      .from('price_alerts')
      .insert({
        wallet_address: walletAddress,
        token_address: params.tokenAddress,
        token_symbol: params.tokenSymbol,
        token_name: params.tokenName,
        target_price: params.targetPrice,
        direction: params.direction,
        current_price_at_creation: params.currentPrice,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Failed to create alert', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({
      title: '🔔 Alert Created',
      description: `You'll be notified when ${params.tokenSymbol} goes ${params.direction} $${params.targetPrice}`,
    });

    await fetchAlerts();
    return data;
  }, [walletAddress, fetchAlerts]);

  // Delete alert
  const deleteAlert = useCallback(async (alertId: string) => {
    await supabase.from('price_alerts').delete().eq('id', alertId as any);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  // Check alerts against current prices
  const checkAlerts = useCallback(async () => {
    const active = alerts.filter(a => !a.triggered);
    if (active.length === 0) return;

    const addresses = [...new Set(active.map(a => a.token_address))];

    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'prices', addresses },
      });

      if (error || !data?.success) return;

      const prices = data.data as Record<string, { value: number }>;
      const triggeredIds: string[] = [];

      for (const alert of active) {
        const priceInfo = prices[alert.token_address];
        if (!priceInfo) continue;

        const currentPrice = priceInfo.value;
        const shouldTrigger =
          (alert.direction === 'above' && currentPrice >= alert.target_price) ||
          (alert.direction === 'below' && currentPrice <= alert.target_price);

        if (shouldTrigger) {
          triggeredIds.push(alert.id);

          // Play sound
          playAlertSound();

          // Show toast
          toast({
            title: `🚨 Price Alert: ${alert.token_symbol}`,
            description: `${alert.token_symbol} is now $${currentPrice.toPrecision(4)} — ${alert.direction === 'above' ? 'above' : 'below'} your target of $${alert.target_price}`,
          });
        }
      }

      if (triggeredIds.length > 0) {
        // Mark as triggered in DB
        for (const id of triggeredIds) {
          await supabase
            .from('price_alerts')
            .update({ triggered: true, triggered_at: new Date().toISOString() } as any)
            .eq('id', id as any);
        }
        await fetchAlerts();
      }
    } catch {
      // Silently fail price checks
    }
  }, [alerts, fetchAlerts]);

  // Fetch on mount and wallet change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Periodic alert checking (every 10 seconds)
  useEffect(() => {
    if (alerts.filter(a => !a.triggered).length === 0) return;

    checkAlerts(); // check immediately
    checkIntervalRef.current = setInterval(checkAlerts, 10000);
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkAlerts]);

  return {
    alerts,
    activeAlerts: alerts.filter(a => !a.triggered),
    triggeredAlerts: alerts.filter(a => a.triggered),
    loading,
    createAlert,
    deleteAlert,
    fetchAlerts,
  };
}
