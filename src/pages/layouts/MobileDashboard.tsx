import { useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopMemecoins } from "@/components/dashboard/market/TopMemecoins";
import { TokenSwap } from "@/components/dashboard/TokenSwap";
import { BotAccess } from "@/components/dashboard/BotAccess";
import { MiniChart } from "@/components/dashboard/portfolio/MiniChart";
import { LiveSignalFeed } from "@/components/dashboard/market/LiveSignalFeed";
import { AIToolsAgents } from "@/components/dashboard/AIToolsAgents";
import { JupiterAIChat } from "@/components/dashboard/JupiterAIChat";
import { PriceAlerts } from "@/components/dashboard/alerts/PriceAlerts";
import { Leaderboard } from "@/components/dashboard/market/Leaderboard";
import { PortfolioTracker } from "@/components/dashboard/portfolio/PortfolioTracker";
import { MemeScanner } from "@/components/dashboard/market/MemeScanner";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MobileBottomNav, MobileTab } from "@/components/layout/MobileBottomNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { NetworkDegradationAlert } from "@/components/dashboard/NetworkDegradationAlert";
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
const MOBILE_TABS: MobileTab[] = ['trade', 'tokens', 'bots', 'alerts', 'chat'];

export function MobileDashboard() {
  const [activeTab, setActiveTab] = useState<MobileTab>('trade');
  const [refreshKey, setRefreshKey] = useState(0);
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  const handleRefresh = useCallback(async () => {
    setRefreshKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const { containerRef, pullDistance, refreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // ─── Swipe gesture handling ──────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;

    setActiveTab((current) => {
      const idx = MOBILE_TABS.indexOf(current);
      if (dx < 0 && idx < MOBILE_TABS.length - 1) return MOBILE_TABS[idx + 1];
      if (dx > 0 && idx > 0) return MOBILE_TABS[idx - 1];
      return current;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <NetworkDegradationAlert />
      <MobileHeader />
      <div
        ref={containerRef}
        className="pt-14 pb-[72px] overflow-y-auto"
        style={{ height: '100vh' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <PullIndicator pullDistance={pullDistance} refreshing={refreshing} progress={progress} />
        <div className="px-3 space-y-2.5">
          <ConnectionStatus />
          
          {/* ACTIVE TAB CONTENT */}
          {activeTab === 'trade' && (
            <div className="space-y-2.5 mb-1 animate-in fade-in duration-300">
              <TokenSwap key={`swap-${refreshKey}`} />
              <MiniChart title="SOL/USD" key={`chart-${refreshKey}`} />
              <PortfolioTracker key={`portfolio-${refreshKey}`} />
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab !== 'trade' && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-2.5"
              >
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
            )}
          </AnimatePresence>
        </div>
      </div>
      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
