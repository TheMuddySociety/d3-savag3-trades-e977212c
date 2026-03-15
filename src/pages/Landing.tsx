import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Zap, Shield, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from '@solana/wallet-adapter-react';
import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { GlobeChart } from "@/components/dashboard/GlobeChart";
import { useAdminCheck } from "@/hooks/useAdminCheck";


const Landing = () => {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { isAdmin } = useAdminCheck(walletAddress);
  
  useEffect(() => {
    if (connected && publicKey) {
      if (isAdmin) {
        toast.success("Admin access granted");
        navigate('/admin');
      } else {
        toast.success("Wallet connected — Welcome");
        navigate('/dashboard');
      }
    }
  }, [connected, publicKey, isAdmin]);

  const handleLaunchApp = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">
              SAVAG3<span className="text-primary">BOT</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground hidden sm:block">
              Solana Mainnet
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-chart-green" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-5xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center py-12">
          {/* Left - Copy */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-md border border-primary/20">
                <Zap className="h-3 w-3" />
                Professional Trading Suite
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                Automated Solana
                <br />
                <span className="text-primary">Trading Bot</span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                Sniper, DCA, volume bots and AI-powered strategies. 
                Built for precision on Solana mainnet.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleLaunchApp}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md text-sm h-11 px-6 font-medium hover:bg-primary/90 transition-colors"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </button>
              <UnifiedWalletButton />
              <appkit-button size="sm" label="WalletConnect" />
            </div>

            {/* Feature pills */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { icon: <Zap className="h-3.5 w-3.5" />, label: "Buy Sniper" },
                { icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Volume Bot" },
                { icon: <Shield className="h-3.5 w-3.5" />, label: "Auto Strategies" },
              ].map((feat) => (
                <div key={feat.label} className="flex items-center gap-2 bg-secondary/50 border border-border rounded-md px-3 py-2">
                  <span className="text-primary">{feat.icon}</span>
                  <span className="text-xs text-muted-foreground">{feat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Globe */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <GlobeChart />
              <div className="absolute inset-0 rounded-full border border-primary/5" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} SAVAG3BOT</span>
          <span className="font-mono">Solana Mainnet</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
