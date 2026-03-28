import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Shield, Zap, Info, Globe, Key, Eye, EyeOff, Server, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "tradingSettings";

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}


export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  // ── Trading Settings ──
  const [slippage, setSlippage] = useState(1.0);
  const [priorityFee, setPriorityFee] = useState(0.001);
  const [mevProtection, setMevProtection] = useState(true);
  const [jitoEnabled, setJitoEnabled] = useState(true);
  const [jitoTipSOL, setJitoTipSOL] = useState(0.001);
  const [jitoBlockEngine, setJitoBlockEngine] = useState("mainnet.block-engine.jito.wtf");
  const [autoApprove, setAutoApprove] = useState(false);

  // ── API / RPC Settings ──
  const [customRpc, setCustomRpc] = useState("");
  const [heliusApiKey, setHeliusApiKey] = useState("");
  const [jupiterApiKey, setJupiterApiKey] = useState("");
  const [useCustomRpc, setUseCustomRpc] = useState(false);
  const [useCustomHelius, setUseCustomHelius] = useState(false);
  const [useCustomJupiter, setUseCustomJupiter] = useState(false);
  const [showHeliusKey, setShowHeliusKey] = useState(false);
  const [showJupiterKey, setShowJupiterKey] = useState(false);
  const [testingRpc, setTestingRpc] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<"idle" | "ok" | "fail">("idle");

  // Listen for external open requests (e.g. from Network Alerts)
  useEffect(() => {
    const handleOpenSettings = (e: any) => {
      setOpen(true);
    };
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  // Load settings
  useEffect(() => {
    if (!open) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSlippage(parsed.slippage || 1.0);
        setPriorityFee(parsed.priorityFee || 0.001);
        setMevProtection(parsed.mevProtection !== false);
        setJitoEnabled(parsed.jitoEnabled !== false);
        setJitoTipSOL(parsed.jitoTipSOL || 0.001);
        setJitoBlockEngine(parsed.jitoBlockEngine || "mainnet.block-engine.jito.wtf");
        setAutoApprove(!!parsed.autoApprove);
        
        // Load API settings from the same merged key
        setCustomRpc(parsed.customRpc || "");
        setHeliusApiKey(parsed.heliusApiKey || "");
        setJupiterApiKey(parsed.jupiterApiKey || "");
        setUseCustomRpc(!!parsed.useCustomRpc);
        setUseCustomHelius(!!parsed.useCustomHelius);
        setUseCustomJupiter(!!parsed.useCustomJupiter);
      } catch {}
    } else {
      // Fallback for legacy split keys
      const apiSaved = localStorage.getItem("custom_api_settings");
      if (apiSaved) {
        try {
          const parsed = JSON.parse(apiSaved);
          setCustomRpc(parsed.customRpc || "");
          setHeliusApiKey(parsed.heliusApiKey || "");
          setJupiterApiKey(parsed.jupiterApiKey || "");
          setUseCustomRpc(!!parsed.useCustomRpc);
          setUseCustomHelius(!!parsed.useCustomHelius);
          setUseCustomJupiter(!!parsed.useCustomJupiter);
        } catch {}
      }
    }
    setRpcStatus("idle");
  }, [open]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
      slippage, 
      priorityFee, 
      mevProtection, 
      jitoEnabled,
      jitoTipSOL,
      jitoBlockEngine,
      autoApprove,
      customRpc: customRpc.trim(),
      heliusApiKey: heliusApiKey.trim(),
      jupiterApiKey: jupiterApiKey.trim(),
      useCustomRpc,
      useCustomHelius,
      useCustomJupiter,
    }));
    toast.success("Settings saved — API changes take effect on next request");
    onOpenChange(false);
  };

  const testRpc = async () => {
    if (!customRpc.trim()) {
      toast.error("Enter an RPC URL first");
      return;
    }
    setTestingRpc(true);
    setRpcStatus("idle");
    try {
      const resp = await fetch(customRpc.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      const data = await resp.json();
      if (data.result === "ok" || data.result) {
        setRpcStatus("ok");
        toast.success("RPC connection successful ✓");
      } else {
        setRpcStatus("fail");
        toast.error("RPC responded but health check failed");
      }
    } catch (e) {
      setRpcStatus("fail");
      toast.error("Failed to connect to RPC endpoint");
    } finally {
      setTestingRpc(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure trading preferences and custom API endpoints.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="trading" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="trading" className="text-xs gap-1.5">
              <Zap className="h-3 w-3" /> Trading
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs gap-1.5">
              <Key className="h-3 w-3" /> API & RPC
            </TabsTrigger>
          </TabsList>

          {/* ── Trading Tab ── */}
          <TabsContent value="trading" className="space-y-4 pt-2">
            {/* Slippage */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="slippage" className="text-sm font-medium">Slippage Tolerance</Label>
                <span className="text-xs font-mono text-primary">{slippage}%</span>
              </div>
              <Slider
                id="slippage"
                min={0.1}
                max={15}
                step={0.1}
                value={[slippage]}
                onValueChange={(v) => setSlippage(v?.[0] || 1.0)}
                className="py-2"
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Higher slippage avoids failed transactions on volatile tokens.
              </p>
            </div>

            {/* Priority Fee */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="priority-fee" className="text-sm font-medium">Priority Fee (SOL)</Label>
                <Zap className="h-3 w-3 text-yellow-500" />
              </div>
              <Input
                id="priority-fee"
                type="number"
                value={priorityFee}
                onChange={(e) => setPriorityFee(parseFloat(e.target.value))}
                className="h-8 font-mono"
              />
            </div>

            {/* Jito Bundle Support */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-solana" />
                  Jito MEV Bundles
                </Label>
                <p className="text-[10px] text-muted-foreground">Submit via block-engine for 0% sandwich risk</p>
              </div>
              <Switch
                checked={jitoEnabled}
                onCheckedChange={setJitoEnabled}
              />
            </div>

            {jitoEnabled && (
              <div className="grid gap-3 p-3 rounded-lg border border-primary/10 bg-primary/5">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Jito Tip (SOL)</Label>
                    <span className="text-xs font-mono text-primary">{jitoTipSOL} SOL</span>
                  </div>
                  <Input 
                    type="number" 
                    step="0.001" 
                    min="0.0001"
                    value={jitoTipSOL}
                    onChange={(e) => setJitoTipSOL(parseFloat(e.target.value))}
                    className="h-8 text-xs bg-background/50"
                  />
                  <p className="text-[9px] text-muted-foreground">Miner tip to guarantee inclusion in the next block.</p>
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-semibold">Block Engine</Label>
                  <Select value={jitoBlockEngine} onValueChange={setJitoBlockEngine}>
                    <SelectTrigger className="h-8 text-xs bg-background/50">
                      <SelectValue placeholder="Select Engine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mainnet.block-engine.jito.wtf">Global (Default)</SelectItem>
                      <SelectItem value="amsterdam.mainnet.block-engine.jito.wtf">Amsterdam</SelectItem>
                      <SelectItem value="frankfurt.mainnet.block-engine.jito.wtf">Frankfurt</SelectItem>
                      <SelectItem value="ny.mainnet.block-engine.jito.wtf">New York</SelectItem>
                      <SelectItem value="tokyo.mainnet.block-engine.jito.wtf">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Auto-Approve */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Auto-Approve Trades</Label>
                <p className="text-[10px] text-muted-foreground">Skip confirmation for faster execution</p>
              </div>
              <Switch
                checked={autoApprove}
                onCheckedChange={setAutoApprove}
              />
            </div>
          </TabsContent>

          {/* ── API & RPC Tab ── */}
          <TabsContent value="api" className="space-y-4 pt-2">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Use your own API keys and RPC for better rate limits and performance. Keys are stored locally in your browser only — never sent to our servers.
            </p>

            {/* Custom RPC */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Server className="h-3 w-3 text-primary" />
                  Custom Solana RPC
                </Label>
                <Switch
                  checked={useCustomRpc}
                  onCheckedChange={setUseCustomRpc}
                />
              </div>
              {useCustomRpc && (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="https://mainnet.helius-rpc.com/?api-key=..."
                      value={customRpc}
                      onChange={(e) => { setCustomRpc(e.target.value); setRpcStatus("idle"); }}
                      className="h-7 text-[10px] font-mono flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={testRpc}
                      disabled={testingRpc}
                    >
                      {testingRpc ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       rpcStatus === "ok" ? <CheckCircle className="h-3 w-3 text-green-500" /> :
                       rpcStatus === "fail" ? <XCircle className="h-3 w-3 text-red-500" /> :
                       "Test"}
                    </Button>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    Recommended: Helius, QuickNode, or Triton
                  </p>
                </div>
              )}
            </div>

            {/* Helius API Key */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-accent" />
                  Helius API Key
                </Label>
                <Switch
                  checked={useCustomHelius}
                  onCheckedChange={setUseCustomHelius}
                />
              </div>
              {useCustomHelius && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Input
                      placeholder="Your Helius API key..."
                      type={showHeliusKey ? "text" : "password"}
                      value={heliusApiKey}
                      onChange={(e) => setHeliusApiKey(e.target.value)}
                      className="h-7 text-[10px] font-mono pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowHeliusKey(!showHeliusKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showHeliusKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    Used for DAS API, token metadata, and transaction parsing. Get one at{" "}
                    <a href="https://dev.helius.xyz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dev.helius.xyz</a>
                  </p>
                </div>
              )}
            </div>

            {/* Jupiter API Key */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  Jupiter API Key
                </Label>
                <Switch
                  checked={useCustomJupiter}
                  onCheckedChange={setUseCustomJupiter}
                />
              </div>
              {useCustomJupiter && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Input
                      placeholder="Your Jupiter API key..."
                      type={showJupiterKey ? "text" : "password"}
                      value={jupiterApiKey}
                      onChange={(e) => setJupiterApiKey(e.target.value)}
                      className="h-7 text-[10px] font-mono pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowJupiterKey(!showJupiterKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showJupiterKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    For Jupiter Ultra swaps and Studio API. Get one at{" "}
                    <a href="https://station.jup.ag/docs/apis/landing" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">station.jup.ag</a>
                  </p>
                </div>
              )}
            </div>

            {/* Security Note */}
            <div className="p-2 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-[9px] text-accent flex items-center gap-1.5">
                <Shield className="h-3 w-3 shrink-0" />
                Keys are stored in your browser's localStorage only. They are never sent to SAVAG3BOT servers.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
