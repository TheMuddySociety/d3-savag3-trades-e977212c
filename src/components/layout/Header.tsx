import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, LogOut, Activity, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { useTradingMode } from '@/hooks/useTradingMode';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { SettingsDialog } from '@/components/dashboard/SettingsDialog';

export function Header() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { publicKey, connected, disconnect } = useWallet();
  const { hasFreePass, buyFreePass, isPaymentPending } = useTradingMode();
  const { signOut } = useWalletAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleDisconnect = async () => {
    await signOut();
    disconnect();
    toast({
      title: "Disconnected",
      description: "Wallet disconnected successfully",
    });
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative h-8 w-8 rounded-lg bg-foreground flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-200 border border-accent/30">
              <img 
                src="/savag3bot-logo.png" 
                alt="SAVAG3BOT" 
                className="h-6 w-6 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 border border-accent/20 rounded-lg pointer-events-none"></div>
            </div>
            <span className="hidden font-bold sm:inline-block text-xl tracking-tighter text-foreground group-hover:text-accent transition-colors">
              SAVAG3 <span className="text-accent">TRADES</span>
            </span>
          </Link>
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

          {connected && publicKey && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                </span>
              </div>
              <Button 
                onClick={() => setSettingsOpen(true)}
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
              </Button>

              <Button 
                onClick={handleDisconnect}
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
              <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
            </div>
          )}
          
          {!connected && (
            <div className="flex items-center gap-2">
              <UnifiedWalletButton />
              <appkit-button size="sm" label="WalletConnect" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Full header for Landing page
export function LandingHeader() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { publicKey, connected, disconnect } = useWallet();
  const { hasFreePass, buyFreePass, isPaymentPending } = useTradingMode();
  const walletAddress = publicKey?.toBase58() || null;
  const { isAdmin } = useAdminCheck(walletAddress);
  const { signOut } = useWalletAuth();

  const handleDisconnect = async () => {
    await signOut();
    disconnect();
    toast({ title: "Disconnected", description: "Wallet disconnected" });
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative h-8 w-8 rounded-lg bg-foreground flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-200 border border-accent/30">
              <img 
                src="/savag3bot-logo.png" 
                alt="SAVAG3BOT" 
                className="h-6 w-6 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 border border-accent/20 rounded-lg pointer-events-none"></div>
            </div>
            <span className="hidden font-bold sm:inline-block text-xl tracking-tighter text-foreground group-hover:text-accent transition-colors">
              D3 SAVAG3 <span className="text-accent">TRADES</span>
            </span>
          </Link>
          <nav className="flex items-center space-x-4 text-sm font-medium">
          </nav>
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
            <div className="flex items-center gap-2">
              <UnifiedWalletButton />
              <appkit-button size="sm" label="WalletConnect" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
