import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { useState } from "react";
import { useNetwork } from "@/hooks/useNetwork";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WalletUserMenuProps {
  publicKey: PublicKey | null;
  onDisconnect: () => void;
}

export function WalletUserMenu({ publicKey, onDisconnect }: WalletUserMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { network } = useNetwork();

  const getNetworkColor = (net: string) => {
    switch (net) {
      case 'devnet': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'testnet': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-accent/10 text-accent border-accent/20';
    }
  };

  if (!publicKey) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Network Badge */}
      <Badge variant="outline" className={cn("text-[10px] h-6 px-2 font-bold uppercase tracking-wider hidden md:flex", getNetworkColor(network))}>
        {network === 'mainnet-beta' ? 'Mainnet' : network}
      </Badge>

      <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md border border-border">
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", network === 'mainnet-beta' ? 'bg-chart-green' : 'bg-current')} />
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
