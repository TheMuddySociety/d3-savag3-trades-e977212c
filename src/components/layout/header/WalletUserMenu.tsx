import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { LogOut, Settings as SettingsIcon, ChevronDown, Globe } from "lucide-react";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { useState } from "react";
import { useNetwork, SolanaNetwork } from "@/hooks/useNetwork";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WalletUserMenuProps {
  publicKey: PublicKey | null;
  onDisconnect: () => void;
}

export function WalletUserMenu({ publicKey, onDisconnect }: WalletUserMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { network, setNetwork } = useNetwork();

  const getNetworkColor = (net: SolanaNetwork) => {
    switch (net) {
      case 'devnet': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'testnet': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-accent/10 text-accent border-accent/20';
    }
  };

  const getNetworkLabel = (net: SolanaNetwork) => {
    switch (net) {
      case 'mainnet-beta': return 'Mainnet';
      case 'devnet': return 'Devnet';
      case 'testnet': return 'Testnet';
      default: return net;
    }
  };

  if (!publicKey) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Network Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("h-7 px-2.5 gap-1.5 text-[10px] font-bold uppercase tracking-wider", getNetworkColor(network))}>
            <Globe className="h-3 w-3" />
            {getNetworkLabel(network)}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 bg-[#0A0A0A] border-white/5">
          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-widest font-mono">Select Network</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/5" />
          <DropdownMenuItem 
            onClick={() => setNetwork('mainnet-beta')}
            className={cn("text-xs cursor-pointer", network === 'mainnet-beta' && "bg-accent/10 text-accent")}
          >
            Mainnet-Beta
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setNetwork('devnet')}
            className={cn("text-xs cursor-pointer", network === 'devnet' && "bg-amber-500/10 text-amber-500")}
          >
            Devnet
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setNetwork('testnet')}
            className={cn("text-xs cursor-pointer", network === 'testnet' && "bg-blue-500/10 text-blue-500")}
          >
            Testnet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-md border border-border h-8">
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", network === 'mainnet-beta' ? 'bg-chart-green' : 'bg-current')} />
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </span>
      </div>
      
      <Button 
        onClick={() => setSettingsOpen(true)}
        variant="ghost"
        size="sm"
        className="text-xs h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden sm:flex"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
      </Button>

      <Button 
        onClick={onDisconnect}
        variant="ghost"
        size="sm"
        className="text-xs h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
      
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
