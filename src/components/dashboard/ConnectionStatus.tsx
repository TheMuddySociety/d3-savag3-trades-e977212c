import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Activity, Server } from 'lucide-react';

type HealthStatus = 'ok' | 'degraded' | 'down' | 'checking';

interface StatusDot {
  label: string;
  status: HealthStatus;
  latency?: number;
}

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const { connected } = useWallet();
  const [rpcStatus, setRpcStatus] = useState<HealthStatus>('checking');
  const [apiStatus, setApiStatus] = useState<HealthStatus>('checking');
  const [rpcLatency, setRpcLatency] = useState<number | undefined>();

  const checkHealth = useCallback(async () => {
    // RPC check
    const rpcStart = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('rpc-proxy', {
        body: { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      });
      const lat = Math.round(performance.now() - rpcStart);
      setRpcLatency(lat);
      if (error) {
        setRpcStatus('down');
      } else {
        setRpcStatus(lat > 2000 ? 'degraded' : 'ok');
      }
    } catch {
      setRpcStatus('down');
      setRpcLatency(undefined);
    }

    // API check
    try {
      const { error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'ping' },
      });
      setApiStatus(error ? 'down' : 'ok');
    } catch {
      setApiStatus('down');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const dots: StatusDot[] = [
    { label: 'Wallet', status: connected ? 'ok' : 'down' },
    { label: 'RPC', status: rpcStatus, latency: rpcLatency },
    { label: 'API', status: apiStatus },
  ];

  const statusColor = (s: HealthStatus) => {
    switch (s) {
      case 'ok': return 'bg-chart-green';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-destructive';
      case 'checking': return 'bg-muted-foreground animate-pulse';
    }
  };

  const StatusIcon = ({ status }: { status: HealthStatus }) => {
    if (status === 'ok') return <Wifi className="h-3 w-3 text-chart-green" />;
    if (status === 'degraded') return <Activity className="h-3 w-3 text-yellow-500" />;
    return <WifiOff className="h-3 w-3 text-destructive" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {dots.map((dot) => (
          <div key={dot.label} className="flex items-center gap-1">
            <div className={cn('w-1.5 h-1.5 rounded-full', statusColor(dot.status))} />
            <span className="text-[9px] font-mono text-muted-foreground">{dot.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-card/60 backdrop-blur-sm border border-border/50 rounded-lg">
      {dots.map((dot) => (
        <div key={dot.label} className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full shrink-0', statusColor(dot.status))} />
          <span className="text-[10px] font-medium text-muted-foreground">{dot.label}</span>
          {dot.latency !== undefined && dot.status !== 'down' && (
            <span className="text-[9px] font-mono text-muted-foreground/70">{dot.latency}ms</span>
          )}
        </div>
      ))}
    </div>
  );
}
