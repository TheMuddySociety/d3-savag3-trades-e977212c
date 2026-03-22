import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { useState } from "react";

interface WalletUserMenuProps {
  publicKey: PublicKey | null;
  onDisconnect: () => void;
}

export function WalletUserMenu({ publicKey, onDisconnect }: WalletUserMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!publicKey) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md border border-border">
        <div className="w-1.5 h-1.5 rounded-full bg-chart-green animate-pulse" />
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </span>
      </div>
      
      <Button 
        onClick={() => setSettingsOpen(true)}
        variant="ghost"
        size="sm"
        className="text-xs h-8 text-muted-foreground hover:text-foreground hidden sm:flex"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
      </Button>

      <Button 
        onClick={onDisconnect}
        variant="ghost"
        size="sm"
        className="text-xs h-8 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
      
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
