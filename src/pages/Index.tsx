import { useState, useEffect } from "react";
import { TopMemecoins } from "@/components/dashboard/TopMemecoins";
import { TokenSwap } from "@/components/dashboard/TokenSwap";
import { BotAccess } from "@/components/dashboard/BotAccess";
import { MiniChart } from "@/components/dashboard/MiniChart";
import { LiveSignalFeed } from "@/components/dashboard/LiveSignalFeed";
import { AIToolsAgents } from "@/components/dashboard/AIToolsAgents";
import { JupiterAIChat } from "@/components/dashboard/JupiterAIChat";
import { PriceAlerts } from "@/components/dashboard/PriceAlerts";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { PortfolioTracker } from "@/components/dashboard/PortfolioTracker";
import { GlobeChart } from "@/components/dashboard/GlobeChart";
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWallet } from "@solana/wallet-adapter-react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Layout components
import { DesktopSidebar, DesktopPanel } from "@/components/layout/DesktopSidebar";
import { MobileBottomNav, MobileTab } from "@/components/layout/MobileBottomNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Header } from "@/components/layout/Header";

const ADMIN_WALLETS = [
  "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH",
  "BQefQgbpAqPjoGKLTmAA2haZh9pEURYNefPFwsTotgem"
];

// ─── MOBILE LAYOUT ────────────────────────────────────────
function MobileDashboard() {
  const [activeTab, setActiveTab] = useState<MobileTab>('trade');
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader />
      <div className="pt-12 pb-20 px-3 space-y-3">
        {activeTab === 'trade' && (
          <>
            <TokenSwap />
            <MiniChart title="SOL/USD" />
            <PortfolioTracker />
          </>
        )}
        {activeTab === 'tokens' && (
          <>
            <TopMemecoins />
            <Leaderboard />
            <MemeScanner />
          </>
        )}
        {activeTab === 'bots' && (
          <>
            <BotAccess />
            <AIToolsAgents />
          </>
        )}
        {activeTab === 'alerts' && (
          <>
            <PriceAlerts walletAddress={walletAddress} />
            <LiveSignalFeed />
          </>
        )}
        {activeTab === 'chat' && (
          <JupiterAIChat />
        )}
      </div>
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

// ─── DESKTOP LAYOUT ───────────────────────────────────────
function DesktopDashboard() {
  const [activePanel, setActivePanel] = useState<DesktopPanel>('tokens');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const isAdmin = publicKey ? ADMIN_WALLETS.includes(publicKey.toBase58()) : false;

  const sidebarWidth = sidebarCollapsed ? 56 : 200;

  // Main content panel (left/center - takes most space)
  const renderMainPanel = () => {
    switch (activePanel) {
      case 'swap':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TokenSwap />
              <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-center">
                <GlobeChart />
              </div>
            </div>
            <PortfolioTracker />
          </div>
        );
      case 'portfolio':
        return (
          <div className="space-y-4">
            <PortfolioTracker />
            <MiniChart title="SOL/USD" />
            <Leaderboard />
          </div>
        );
      case 'tokens':
        return (
          <div className="space-y-4">
            <TopMemecoins />
            <Leaderboard />
          </div>
        );
      case 'signals':
        return (
          <div className="space-y-4">
            <LiveSignalFeed />
            <MemeScanner />
          </div>
        );
      case 'bots':
        return (
          <div className="space-y-4">
            <BotAccess />
            <AIToolsAgents />
          </div>
        );
      case 'alerts':
        return (
          <div className="space-y-4">
            <PriceAlerts walletAddress={walletAddress} />
            <LiveSignalFeed />
          </div>
        );
      case 'chat':
        return <JupiterAIChat />;
      default:
        return <TopMemecoins />;
    }
  };

  // Right sidebar widgets — context-dependent
  const renderRightPanel = () => {
    switch (activePanel) {
      case 'swap':
      case 'portfolio':
        return (
          <>
            <PriceAlerts walletAddress={walletAddress} />
            <LiveSignalFeed />
          </>
        );
      case 'tokens':
        return (
          <>
            <MiniChart title="SOL/USD" />
            <TokenSwap />
            <MemeScanner />
          </>
        );
      case 'signals':
        return (
          <>
            <MiniChart title="SOL/USD" />
            <PriceAlerts walletAddress={walletAddress} />
          </>
        );
      case 'bots':
        return (
          <>
            <MiniChart title="SOL/USD" />
            <PriceAlerts walletAddress={walletAddress} />
          </>
        );
      case 'alerts':
        return (
          <>
            <MiniChart title="SOL/USD" />
            <MemeScanner />
          </>
        );
      case 'chat':
        return (
          <>
            <MiniChart title="SOL/USD" />
            <LiveSignalFeed />
            <PriceAlerts walletAddress={walletAddress} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isAdmin={isAdmin}
      />

      {/* Top bar */}
      <div
        className="fixed top-0 right-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 transition-all duration-300"
        style={{ left: sidebarWidth }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground tracking-tight capitalize">
            {activePanel}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            LIVE
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <Header />
      </div>

      {/* Main content area */}
      <div
        className="pt-14 transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="flex h-[calc(100vh-56px)]">
          {/* Main panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {renderMainPanel()}
          </div>

          {/* Right sidebar widgets */}
          <div className="w-[340px] shrink-0 border-l border-border overflow-y-auto p-4 space-y-4 bg-card/30">
            {renderRightPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INDEX ─────────────────────────────────────────────────
const Index = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileDashboard /> : <DesktopDashboard />;
};

export default Index;
