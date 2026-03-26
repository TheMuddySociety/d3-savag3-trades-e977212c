import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Clock, Crosshair, BarChart3, Brain, Wallet, OctagonX, Layers, Eye, List, TrendingUp, Rocket, Coins, Flame, History, Palmtree } from "lucide-react";
import { D3SAgentHero } from "./bot-tools/D3SAgentHero";
import { DCABot } from "./bot-tools/DCABot";
import { BuySniper } from "./bot-tools/BuySniper";
import { VolumeBot } from "./bot-tools/VolumeBot";
import { AutoStrategies } from "./bot-tools/AutoStrategies";
import { BatchTrader } from "./bot-tools/BatchTrader";
import { CopyTradeBot } from "./bot-tools/CopyTradeBot";
import { LiveTradeHistory } from "./bot-tools/LiveTradeHistory";
import { GridBot } from "./bot-tools/GridBot";
import { TokenLaunchWizard } from "./bot-tools/TokenLaunchWizard";
import { FeeDashboard } from "./bot-tools/FeeDashboard";
import { ReferralEarningsTracker } from "../admin/ReferralEarningsTracker";
import { ProfitSimulator } from "./analytics/ProfitSimulator";
import { BackgroundTaskMonitor } from './background/BackgroundTaskMonitor';
import { BeachModePanel } from './bot-tools/BeachModePanel';
import { AgentService } from "@/services/solana/agentService";
import { backgroundTaskService } from "@/services/d3mon/BackgroundTaskService";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";

export const BotAccess = () => {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const walletAddress = publicKey?.toBase58() || null;
  const { toast } = useToast();
  const [killSignal, setKillSignal] = useState(0);
  const [activeTab, setActiveTab] = useState("agent");
  const [isAgentHired, setIsAgentHired] = useState(false);
  const [isHiring, setIsHiring] = useState(false);

  // Check on-chain agent status
  useEffect(() => {
    const checkAgentStatus = async () => {
      if (walletAddress) {
        const hired = await AgentService.isAgentHired(walletAddress);
        setIsAgentHired(hired);
      }
    };
    checkAgentStatus();
  }, [walletAddress]);

  const handleActivateAgent = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to hire D3S Agent.",
        variant: "destructive"
      });
      return;
    }

    setIsHiring(true);
    try {
      await AgentService.activateAgent(wallet);
      setIsAgentHired(true);
      toast({
        title: "🤝 D3S Agent Activated!",
        description: "Your autonomous agent is now authorized to trade on-chain 24/7.",
      });
    } catch (error) {
      console.error("Failed to activate agent:", error);
      toast({
        title: "Activation Failed",
        description: error instanceof Error ? error.message : "Failed to activate D3S Agent.",
        variant: "destructive",
      });
    } finally {
      setIsHiring(false);
    }
  }, [wallet, walletAddress, toast]);

  // Listen for navigation events from AI Tools cards
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    window.addEventListener("navigate-bot-tab", handler);
    return () => window.removeEventListener("navigate-bot-tab", handler);
  }, []);

  const handleKillAll = useCallback(() => {
    setKillSignal(prev => prev + 1);
    toast({ title: "🛑 All Bots Stopped", description: "Kill switch activated — all bots disarmed and stopped" });
  }, [toast]);

  return (
    <Card className="w-full border-border/40 bg-card/40 backdrop-blur-md shadow-xl" data-bot-tools>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm">Bot Trading Tools</CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] ml-auto bg-destructive/20 text-destructive border-destructive/30"
          >
            🔴 LIVE
          </Badge>
        </div>

        {walletAddress && (
          <Button
            variant="glass"
            size="sm"
            className="w-full mt-2 h-7 text-[10px] font-bold border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 hover:text-destructive transition-all duration-300 rounded-md"
            onClick={handleKillAll}
          >
            <OctagonX className="h-3 w-3 mr-1.5" />
            DISARM ALL BOTS (GLOBAL KILL SWITCH)
          </Button>
        )}

        {walletAddress && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5 text-xs">
              <Wallet className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Wallet:</span>
              <span className="font-mono text-foreground font-medium">Connected</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto snap-x bg-black/40 border border-border/40 h-9 mb-3 gap-0.5 no-scrollbar p-1 rounded-lg backdrop-blur-md">
            <TabsTrigger value="agent" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Flame className="h-3 w-3" />
              <span className="hidden sm:inline">D3S AGENT</span>
            </TabsTrigger>
            <TabsTrigger value="sniper" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Crosshair className="h-3 w-3" />
              <span className="hidden sm:inline">Sniper</span>
            </TabsTrigger>
            <TabsTrigger value="dca" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Clock className="h-3 w-3" />
              <span className="hidden sm:inline">DCA</span>
            </TabsTrigger>
            <TabsTrigger value="volume" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">Vol</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Layers className="h-3 w-3" />
              <span className="hidden sm:inline">Batch</span>
            </TabsTrigger>
            <TabsTrigger value="grid" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Bot className="h-3 w-3" />
              <span className="hidden sm:inline">Grid</span>
            </TabsTrigger>
            <TabsTrigger value="copy" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">Copy</span>
            </TabsTrigger>
            <TabsTrigger value="auto" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Brain className="h-3 w-3" />
              <span className="hidden sm:inline">Auto</span>
            </TabsTrigger>
            <TabsTrigger value="profit" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <TrendingUp className="h-3 w-3" />
              <span className="hidden sm:inline">Profit</span>
            </TabsTrigger>
            <TabsTrigger value="launch" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Rocket className="h-3 w-3" />
              <span className="hidden sm:inline">Launch</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <History className="h-3 w-3" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <Coins className="h-3 w-3" />
              <span className="hidden sm:inline">Fees</span>
            </TabsTrigger>
            <TabsTrigger value="trades" className="text-[10px] gap-1 transition-all duration-300 data-[state=active]:glass-accent data-[state=active]:text-accent px-3 shrink-0 snap-start rounded-md">
              <List className="h-3 w-3" />
              <span className="hidden sm:inline">Trades</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agent" className="mt-0">
            <D3SAgentHero onHire={handleActivateAgent} isHired={isAgentHired} isHiring={isHiring} />
            <div className="mt-4">
              <BeachModePanel />
            </div>
          </TabsContent>
          <TabsContent value="sniper" className="mt-0">
            <BuySniper killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="dca" className="mt-0">
            <DCABot killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="volume" className="mt-0">
            <VolumeBot killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="batch" className="mt-0">
            <BatchTrader killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="grid" className="mt-0">
            <GridBot killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="copy" className="mt-0">
            <CopyTradeBot killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="auto" className="mt-0">
            <AutoStrategies killSignal={killSignal} />
          </TabsContent>
          <TabsContent value="profit" className="mt-0">
            <ProfitSimulator />
          </TabsContent>
          <TabsContent value="launch" className="mt-0">
            <TokenLaunchWizard />
          </TabsContent>
          <TabsContent value="tasks" className="mt-0">
            <BackgroundTaskMonitor walletAddress={walletAddress} />
          </TabsContent>
          <TabsContent value="fees" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <ReferralEarningsTracker />
              <Card className="border-border/40 bg-card/20 backdrop-blur-md shadow-lg overflow-hidden">
                <CardHeader className="pb-2 border-b border-border/10 bg-accent/5">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-accent" />
                    <CardTitle className="text-sm font-bold">Jupiter Studio LP Fees</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <FeeDashboard />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="trades" className="mt-0">
            <LiveTradeHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
