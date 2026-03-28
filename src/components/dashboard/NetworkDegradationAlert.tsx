import { useState, useEffect } from 'react';
import { AlertCircle, Zap, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NetworkDegradationAlert() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check for degradation state (set by ConnectionStatus or RPC Proxy)
    const checkStatus = () => {
      const status = localStorage.getItem('solana_network_status');
      if (status === 'degraded' && !isDismissed) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [isDismissed]);

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed top-16 left-0 right-0 z-50 animate-in fade-in slide-in-from-top-4 duration-300",
      "p-4 flex items-center justify-center pointer-events-none"
    )}>
      <div className={cn(
        "max-w-2xl w-full bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 rounded-xl",
        "p-3 flex items-center gap-3 shadow-2xl shadow-yellow-500/10 pointer-events-auto"
      )}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/20 text-yellow-500">
          <AlertCircle className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-yellow-500 flex items-center gap-2 uppercase tracking-wider">
            Solana Network Degraded
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1">
            Congestion detected. Transactions may fail. Increase Jito Tips for faster execution.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            size="sm" 
            variant="ghost"
            className="h-8 text-[11px] border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20"
            onClick={() => {
              // Open Settings Dialog via Custom Event or Global State
              window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'trading' } }));
            }}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Performance Boost
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
