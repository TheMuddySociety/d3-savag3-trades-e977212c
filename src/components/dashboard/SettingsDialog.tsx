import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Zap, Info } from "lucide-react";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [slippage, setSlippage] = useState(1.0);
  const [priorityFee, setPriorityFee] = useState(0.001);
  const [mevProtection, setMevProtection] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("trading_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSlippage(parsed.slippage || 1.0);
        setPriorityFee(parsed.priorityFee || 0.001);
        setMevProtection(parsed.mevProtection !== false);
        setAutoApprove(!!parsed.autoApprove);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, [open]);

  const handleSave = () => {
    const settings = { slippage, priorityFee, mevProtection, autoApprove };
    localStorage.setItem("trading_settings", JSON.stringify(settings));
    toast.success("Settings saved successfully");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Trading Settings
          </DialogTitle>
          <DialogDescription>
            Configure your global trading preferences for Pump.Fun tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
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
              onValueChange={(v) => setSlippage(v[0])}
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

          {/* MEV Protection */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-solana" />
                Anti-MEV (Jito)
              </Label>
              <p className="text-[10px] text-muted-foreground">Protects against sandwich attacks</p>
            </div>
            <Switch
              checked={mevProtection}
              onCheckedChange={setMevProtection}
            />
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
