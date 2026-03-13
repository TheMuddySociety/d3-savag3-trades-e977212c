import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Shield, LogOut, Activity } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const ADMIN_WALLETS = [
  "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH",
  "BQefQgbpAqPjoGKLTmAA2haZh9pEURYNefPFwsTotgem"
];

export function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { publicKey, connected, disconnect } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toString();
      setIsAdmin(ADMIN_WALLETS.includes(walletAddress));
      localStorage.setItem('connectedWallet', walletAddress);
      localStorage.setItem('walletConnected', 'true');
    } else {
      setIsAdmin(false);
    }
  }, [connected, publicKey]);

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
            <WalletMultiButton className="!bg-primary !text-primary-foreground !rounded-md !text-xs !h-8 !px-4" />
          )}
        </div>
      </div>
    </header>
  );
}
