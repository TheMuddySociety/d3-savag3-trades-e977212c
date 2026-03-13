
import { TopMemecoins } from "@/components/dashboard/TopMemecoins";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { TokenSwap } from "@/components/dashboard/TokenSwap";
import { BotAccess } from "@/components/dashboard/BotAccess";
import { MiniChart } from "@/components/dashboard/MiniChart";
import { LiveSignalFeed } from "@/components/dashboard/LiveSignalFeed";
import { AIToolsAgents } from "@/components/dashboard/AIToolsAgents";
import { PriceAlerts } from "@/components/dashboard/PriceAlerts";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { PortfolioTracker } from "@/components/dashboard/PortfolioTracker";
import { GlobeChart } from "@/components/dashboard/GlobeChart";
import { Header } from "@/components/layout/Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWallet } from "@solana/wallet-adapter-react";
import { Activity } from "lucide-react";

const Index = () => {
  const isMobile = useIsMobile();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-14">
        <div className="max-w-7xl mx-auto px-3 py-4 space-y-4">
          {/* Top Status Bar */}
          <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground tracking-tight">
                SAVAG3<span className="text-primary">BOT</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                DASHBOARD
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Main Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TokenSwap />
                <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center">
                  <GlobeChart />
                </div>
              </div>
              <PortfolioTracker />
              <TopMemecoins />
              <Leaderboard />
              <AIToolsAgents />
            </div>
            
            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              <MiniChart title="SOL/USD" />
              <PriceAlerts walletAddress={walletAddress} />
              <BotAccess />
              <LiveSignalFeed />
              <MemeScanner />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
