import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, LogOut, Activity, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { useTradingMode } from '@/hooks/useTradingMode';

export function Header() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { publicKey, connected, disconnect } = useWallet();
  const { hasFreePass, buyFreePass, isPaymentPending } = useTradingMode();

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('connectedWallet');
    toast({
      title: "Disconnected",
      description: "Wallet disconnected successfully",
    });
    navigate('/');
  };

  return (
    <div className="flex items-center gap-2">
      {connected && hasFreePass && (
        <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">
          <Sparkles className="h-3 w-3 mr-1" />
          FEE-FREE ✨
        </Badge>
      )}

      {connected && !hasFreePass && (
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] h-7 text-accent hover:text-accent"
          onClick={buyFreePass}
          disabled={isPaymentPending}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          0.1 SOL = No Fees
        </Button>
      )}

      {connected && publicKey && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md">
            <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">
              {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </span>
          </div>
          <Button 
            onClick={handleDisconnect}
            variant="ghost"
            size="sm"
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      
      {!connected && (
        <UnifiedWalletButton />
      )}
    </div>
  );
}

// Full header for Landing page
export function LandingHeader() {
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { publicKey, connected, disconnect } = useWallet();
  const { hasFreePass, buyFreePass, isPaymentPending } = useTradingMode();

  const ADMIN_WALLETS = [
    "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH",
    "BQefQgbpAqPjoGKLTmAA2haZh9pEURYNefPFwsTotgem"
  ];

  useEffect(() => {
    if (connected && publicKey) {
      setIsAdmin(ADMIN_WALLETS.includes(publicKey.toString()));
      localStorage.setItem('connectedWallet', publicKey.toString());
      localStorage.setItem('walletConnected', 'true');
    } else {
      setIsAdmin(false);
    }
  }, [connected, publicKey]);

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('connectedWallet');
    toast({ title: "Disconnected", description: "Wallet disconnected" });
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container flex items-center justify-between h-14 px-4 mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              SAVAG3<span className="text-primary">BOT</span>
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            v2.0
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {connected && hasFreePass && (
            <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">
              <Sparkles className="h-3 w-3 mr-1" />
              FEE-FREE ✨
            </Badge>
          )}

          {connected && !hasFreePass && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-7 text-accent hover:text-accent"
              onClick={buyFreePass}
              disabled={isPaymentPending}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              0.1 SOL = No Fees
            </Button>
          )}

          {connected && (
            <Link to="/dashboard">
              <Button
                variant={isActive('/dashboard') ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8"
              >
                Dashboard
              </Button>
            </Link>
          )}
          
          {isAdmin && (
            <Link to="/admin">
              <Button
                variant={isActive('/admin') ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8 text-primary"
              >
                <Shield className="h-3.5 w-3.5 mr-1" />
                Admin
              </Button>
            </Link>
          )}
          
          {connected && publicKey && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md">
                <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </span>
              </div>
              <Button 
                onClick={handleDisconnect}
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          {!connected && (
            <UnifiedWalletButton />
          )}
        </div>
      </div>
    </header>
  );
}
