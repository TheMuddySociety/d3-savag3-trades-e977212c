import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

// Layout components
import { DesktopSidebar, DesktopPanel } from "@/components/layout/DesktopSidebar";
import { MobileBottomNav, MobileTab } from "@/components/layout/MobileBottomNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Header } from "@/components/layout/Header";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { Loader2 } from "lucide-react";

// ─── PULL INDICATOR ───────────────────────────────────────
function PullIndicator({ pullDistance, refreshing, progress }: { pullDistance: number; refreshing: boolean; progress: number }) {
  if (pullDistance <= 0 && !refreshing) return null;
  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
      style={{ height: pullDistance }}
    >
      <div className="flex flex-col items-center gap-1">
        <Loader2
          className={`h-5 w-5 text-primary transition-transform ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)`, opacity: Math.max(0.3, progress) }}
        />
        <span className="text-[10px] text-muted-foreground font-medium">
          {refreshing ? 'Refreshing…' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}

// ─── MOBILE LAYOUT ────────────────────────────────────────
function MobileDashboard() {
  const [activeTab, setActiveTab] = useState<MobileTab>('trade');
  const [refreshKey, setRefreshKey] = useState(0);
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  const handleRefresh = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    // Allow children to re-fetch
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const { containerRef, pullDistance, refreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader />
      <div
        ref={containerRef}
        className="pt-14 pb-[72px] overflow-y-auto"
        style={{ height: '100vh' }}
      >
        <PullIndicator pullDistance={pullDistance} refreshing={refreshing} progress={progress} />
        <div className="px-3 space-y-2.5">
          <ConnectionStatus />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-2.5"
            >
              {activeTab === 'trade' && (
                <>
                  <TokenSwap key={`swap-${refreshKey}`} />
                  <MiniChart title="SOL/USD" key={`chart-${refreshKey}`} />
                  <PortfolioTracker key={`portfolio-${refreshKey}`} />
                </>
              )}
              {activeTab === 'tokens' && (
                <>
                  <TopMemecoins key={`meme-${refreshKey}`} />
                  <Leaderboard key={`leader-${refreshKey}`} />
                  <MemeScanner key={`scanner-${refreshKey}`} />
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
                  <PriceAlerts walletAddress={walletAddress} key={`alerts-${refreshKey}`} />
                  <LiveSignalFeed key={`signals-${refreshKey}`} />
                </>
              )}
              {activeTab === 'chat' && (
                <JupiterAIChat />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
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
  const { isAdmin } = useAdminCheck(walletAddress);

  const sidebarWidth = sidebarCollapsed ? 56 : 200;

  const renderMainPanel = () => {
    switch (activePanel) {
      case 'swap':
        return (
          <div className="space-y-4">
            <TokenSwap />
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
        className="fixed top-0 right-0 z-30 h-14 bg-background/95 backdrop-blur-md border-b border-accent/20 flex items-center justify-between px-4 transition-all duration-300 shadow-[0_1px_10px_rgba(239,68,68,0.05)]"
        style={{ left: sidebarWidth }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground tracking-tight capitalize">
            {activePanel}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            LIVE
          </span>
          <ConnectionStatus compact />
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

          {/* Right sidebar widgets — hidden below lg */}
          <div className="hidden lg:block w-[340px] shrink-0 border-l border-border overflow-y-auto p-4 space-y-4 bg-card/30">
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
