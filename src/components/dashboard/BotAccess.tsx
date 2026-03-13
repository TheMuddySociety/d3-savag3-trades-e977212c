import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bot, Clock, Crosshair, BarChart3, Brain, Wallet, RotateCcw, History, Zap, OctagonX, Layers, Eye } from "lucide-react";
import { DCABot } from "./bot-tools/DCABot";
import { BuySniper } from "./bot-tools/BuySniper";
import { VolumeBot } from "./bot-tools/VolumeBot";
import { AutoStrategies } from "./bot-tools/AutoStrategies";
import { BatchTrader } from "./bot-tools/BatchTrader";
import { CopyTradeBot } from "./bot-tools/CopyTradeBot";
import { SimPortfolio } from "./bot-tools/SimPortfolio";
import { TradeHistory } from "./bot-tools/TradeHistory";
import { useSimTrading } from "@/hooks/useSimTrading";
import { useTradingMode } from "@/hooks/useTradingMode";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";

export const BotAccess = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const sim = useSimTrading(walletAddress);
  const { isLive, hasPaid, isPaymentPending, isCheckingPayment, toggleMode, payAccessFee } = useTradingMode();
  const { toast } = useToast();
  const [showHistory, setShowHistory] = useState(false);
  const [killSignal, setKillSignal] = useState(0);

  const handleLiveToggle = () => {
    toggleMode();
  };

  const handleKillAll = useCallback(() => {
    setKillSignal(prev => prev + 1);
    toast({ title: "🛑 All Bots Stopped", description: "Kill switch activated — all bots disarmed and stopped" });
  }, [toast]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm">Bot Trading Tools</CardTitle>
          <Badge
            variant="outline"
            className={`text-[10px] ml-auto ${
              isLive
                ? "bg-destructive/20 text-destructive border-destructive/30"
                : "bg-[hsl(var(--fun-yellow))]/20 text-[hsl(var(--fun-yellow))] border-[hsl(var(--fun-yellow))]/30"
            }`}
          >
            {isLive ? "🔴 LIVE" : "PAPER"}
          </Badge>
        </div>

        {walletAddress && (
          <div className="flex items-center justify-between mt-2 p-2 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center gap-2">
              <Zap className={`h-3.5 w-3.5 ${isLive ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <span className="text-xs font-medium text-foreground">Go Live</span>
              </div>
            </div>
            <Switch
              checked={isLive}
              onCheckedChange={handleLiveToggle}
              disabled={isPaymentPending || !walletAddress}
            />
          </div>
        )}

        {walletAddress && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleKillAll}
          >
            <OctagonX className="h-3.5 w-3.5 mr-1.5" />
            Kill All Bots
          </Button>
        )}

        {walletAddress && sim.wallet && (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5 text-xs">
              <Wallet className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{isLive ? "Wallet:" : "Sim Balance:"}</span>
              {!isLive && (
                <span className="font-mono text-foreground font-medium">
                  {sim.wallet.sol_balance.toFixed(4)} SOL
                </span>
              )}
              {isLive && (
                <span className="font-mono text-foreground font-medium">Connected</span>
              )}
            </div>
            {!isLive && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowHistory(!showHistory)} title="Trade History">
                  <History className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={sim.resetWallet} title="Reset to 10 SOL">
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {showHistory && !isLive ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Trade History</span>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setShowHistory(false)}>
                Back to Tools
              </Button>
            </div>
            <TradeHistory orders={sim.orders} />
            {sim.holdings.length > 0 && <SimPortfolio holdings={sim.holdings} />}
          </div>
        ) : (
          <Tabs defaultValue="sniper" className="w-full">
            <TabsList className="w-full grid grid-cols-6 bg-muted/30 h-8 mb-3">
              <TabsTrigger value="sniper" className="text-[10px] gap-0.5 data-[state=active]:bg-primary/20 px-1">
                <Crosshair className="h-3 w-3" />
                <span className="hidden sm:inline">Sniper</span>
              </TabsTrigger>
              <TabsTrigger value="dca" className="text-[10px] gap-0.5 data-[state=active]:bg-accent/20 px-1">
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">DCA</span>
              </TabsTrigger>
              <TabsTrigger value="volume" className="text-[10px] gap-0.5 data-[state=active]:bg-accent/20 px-1">
                <BarChart3 className="h-3 w-3" />
                <span className="hidden sm:inline">Vol</span>
              </TabsTrigger>
              <TabsTrigger value="batch" className="text-[10px] gap-0.5 data-[state=active]:bg-primary/20 px-1">
                <Layers className="h-3 w-3" />
                <span className="hidden sm:inline">Batch</span>
              </TabsTrigger>
              <TabsTrigger value="copy" className="text-[10px] gap-0.5 data-[state=active]:bg-[hsl(var(--fun-purple))]/20 px-1">
                <Eye className="h-3 w-3" />
                <span className="hidden sm:inline">Copy</span>
              </TabsTrigger>
              <TabsTrigger value="auto" className="text-[10px] gap-0.5 data-[state=active]:bg-primary/20 px-1">
                <Brain className="h-3 w-3" />
                <span className="hidden sm:inline">Auto</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sniper" className="mt-0">
              <BuySniper sim={sim} isLive={isLive} killSignal={killSignal} />
            </TabsContent>
            <TabsContent value="dca" className="mt-0">
              <DCABot sim={sim} isLive={isLive} killSignal={killSignal} />
            </TabsContent>
            <TabsContent value="volume" className="mt-0">
              <VolumeBot sim={sim} isLive={isLive} killSignal={killSignal} />
            </TabsContent>
            <TabsContent value="batch" className="mt-0">
              <BatchTrader sim={sim} isLive={isLive} killSignal={killSignal} />
            </TabsContent>
            <TabsContent value="copy" className="mt-0">
              <CopyTradeBot sim={sim} isLive={isLive} killSignal={killSignal} />
            </TabsContent>
            <TabsContent value="auto" className="mt-0">
              <AutoStrategies sim={sim} isLive={isLive} killSignal={killSignal} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
