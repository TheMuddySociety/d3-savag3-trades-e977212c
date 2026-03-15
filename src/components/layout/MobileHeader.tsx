import { Activity, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton } from 'jupiverse-kit';
import { useTradingMode } from '@/hooks/useTradingMode';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

export function MobileHeader() {
  const { publicKey, connected, disconnect } = useWallet();
  const { hasFreePass } = useTradingMode();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('connectedWallet');
    toast({ title: "Disconnected", description: "Wallet disconnected" });
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-12 px-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            S3<span className="text-primary">BOT</span>
          </span>
          {connected && hasFreePass && (
            <Badge className="bg-accent/20 text-accent border-accent/30 text-[9px] h-4 px-1">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              FREE
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {connected && publicKey ? (
            <>
              <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-[10px] font-mono text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
                {publicKey.toString().slice(0, 4)}…{publicKey.toString().slice(-4)}
              </div>
              <Button onClick={handleDisconnect} variant="ghost" size="icon" className="h-7 w-7">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <UnifiedWalletButton />
          )}
        </div>
      </div>
    </header>
  );
}
