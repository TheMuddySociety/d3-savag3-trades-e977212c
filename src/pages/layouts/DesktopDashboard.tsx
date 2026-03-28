import { useState } from "react";
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
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { DesktopSidebar, DesktopPanel } from "@/components/layout/DesktopSidebar";
import { Header } from "@/components/layout/Header";
import { NetworkDegradationAlert } from "@/components/dashboard/NetworkDegradationAlert";

export function DesktopDashboard() {
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
          <div className="space-y-4 animate-in fade-in duration-300">
            <TokenSwap />
            <PortfolioTracker />
          </div>
        );
      case 'portfolio':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <PortfolioTracker />
            <MiniChart title="SOL/USD" />
            <Leaderboard />
          </div>
        );
      case 'tokens':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <TopMemecoins />
            <Leaderboard />
          </div>
        );
      case 'signals':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <LiveSignalFeed />
            <MemeScanner />
          </div>
        );
      case 'bots':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <BotAccess />
            <AIToolsAgents />
          </div>
        );
      case 'alerts':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <PriceAlerts walletAddress={walletAddress} />
            <LiveSignalFeed />
          </div>
        );
      case 'chat':
        return <JupiterAIChat />;
      default:
        return null;
    }
  };

  const renderRightPanel = () => {
    switch (activePanel) {
      case 'swap':
      case 'portfolio':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <PriceAlerts walletAddress={walletAddress} />
            <LiveSignalFeed />
          </div>
        );
      case 'tokens':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <MiniChart title="SOL/USD" />
            <TokenSwap />
            <MemeScanner />
          </div>
        );
      case 'signals':
      case 'bots':
      case 'alerts':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <MiniChart title="SOL/USD" />
            {activePanel === 'signals' || activePanel === 'bots' ? (
              <PriceAlerts walletAddress={walletAddress} />
            ) : (
              <MemeScanner />
            )}
          </div>
        );
      case 'chat':
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <MiniChart title="SOL/USD" />
            <LiveSignalFeed />
            <PriceAlerts walletAddress={walletAddress} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NetworkDegradationAlert />
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
