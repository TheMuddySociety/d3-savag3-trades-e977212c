import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Signal {
  id: string;
  type: 'buy' | 'sell' | 'alert' | 'volume';
  token: string;
  message: string;
  timestamp: number;
  strength: 'low' | 'medium' | 'high';
  price?: number;
  change?: number;
  holders?: number;
  uniqueTraders?: number;
}

interface SignalContextType {
  signals: Signal[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);

function deriveSignalsFromTrending(trendingData: any[]): Signal[] {
  return trendingData
    .filter((t: any) => t && typeof t.price === 'number' && t.price > 0)
    .slice(0, 15)
    .map((t: any) => {
      const change = Number(t.price_change_24h || 0);
      const safeChange = isNaN(change) ? 0 : change;
      let type: Signal['type'] = 'alert';
      let message = '';
      let strength: Signal['strength'] = 'low';
 
      if (safeChange > 15) {
        type = 'buy';
        message = `Surging +${safeChange.toFixed(1)}% — breakout detected`;
        strength = 'high';
      } else if (safeChange > 5) {
        type = 'buy';
        message = `Trending up +${safeChange.toFixed(1)}% in 24h`;
        strength = 'medium';
      } else if (safeChange < -10) {
        type = 'sell';
        message = `Dropping ${safeChange.toFixed(1)}% — sell pressure`;
        strength = 'high';
      } else if (safeChange < -3) {
        type = 'sell';
        message = `Declining ${safeChange.toFixed(1)}% in 24h`;
        strength = 'medium';
      } else {
        type = 'volume';
        message = `Active trading — ${safeChange >= 0 ? '+' : ''}${safeChange.toFixed(1)}% change`;
        strength = 'low';
      }
 
      return {
        id: `signal-${t.address || t.symbol || Math.random()}-${Date.now()}`,
        type,
        token: t.symbol?.toUpperCase() || 'UNKNOWN',
        message,
        timestamp: Date.now(),
        strength,
        price: t.price,
        change: safeChange,
        holders: t.holders,
        uniqueTraders: t.unique_traders_24h,
      };
    });
}

export function SignalProvider({ children }: { children: ReactNode }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'trending' },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.data)) {
        const derived = deriveSignalsFromTrending(data.data);
        setSignals(derived);
      }
    } catch (err) {
      console.error('Market sync error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 45000); // Consolidated market sync (45s)
    return () => clearInterval(interval);
  }, [fetchSignals]);

  return (
    <SignalContext.Provider value={{ signals, loading, refresh: fetchSignals }}>
      {children}
    </SignalContext.Provider>
  );
}

export function useSignals() {
  const context = useContext(SignalContext);
  if (context === undefined) {
    throw new Error("useSignals must be used within a SignalProvider");
  }
  return context;
}
