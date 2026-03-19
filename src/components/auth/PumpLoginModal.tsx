
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppKit } from "@reown/appkit/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronRight, Mail, Wallet, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface PumpLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PumpLoginModal({ open, onOpenChange }: PumpLoginModalProps) {
  const { open: openAppKit } = useAppKit();
  const { wallets, select } = useWallet();

  // Filter for most popular wallets to show prominently
  const popularWallets = wallets.filter(w => 
    ["Phantom", "Solflare"].includes(w.adapter.name)
  );

  const handleSocialLogin = async () => {
    onOpenChange(false);
    await openAppKit({ view: 'Connect' });
  };

  const handleWalletSelect = (walletName: any) => {
    select(walletName);
    onOpenChange(false);
  };

  const handleMoreWallets = async () => {
    onOpenChange(false);
    await openAppKit({ view: 'AllWallets' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-[#1a1b1e] border-white/10 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-0 flex flex-col items-center">
          <DialogTitle className="text-xl font-bold text-white mb-6">Connect or create wallet</DialogTitle>
          
          {/* Central Pill Icon */}
          <div className="relative w-20 h-20 mb-8 group">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/30 transition-all duration-500" />
            <div className="relative w-full h-full flex items-center justify-center transform rotate-[-45deg]">
              <div className="w-12 h-6 bg-white rounded-l-full" />
              <div className="w-12 h-6 bg-primary rounded-r-full shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-8 space-y-3">
          {/* Main Social/Email Button */}
          <Button
            onClick={handleSocialLogin}
            variant="outline"
            className="w-full h-14 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-white flex items-center justify-between px-4 group rounded-xl transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white/70" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold">Login with email or socials</div>
                <div className="text-[10px] text-white/40">zero confirmation trading</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all" />
          </Button>

          <div className="relative my-6 flex items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-[10px] text-white/20 font-medium uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* Popular Wallets */}
          <div className="grid grid-cols-1 gap-2">
            {popularWallets.map((wallet) => (
              <Button
                key={wallet.adapter.name}
                onClick={() => handleWalletSelect(wallet.adapter.name)}
                variant="outline"
                className="w-full h-12 bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10 text-white flex items-center justify-start gap-3 px-4 rounded-xl transition-all duration-200"
              >
                <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-6 h-6" />
                <span className="text-sm font-medium">{wallet.adapter.name}</span>
              </Button>
            ))}
            
            <Button
              onClick={handleMoreWallets}
              variant="outline"
              className="w-full h-12 bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10 text-white flex items-center justify-start gap-3 px-4 rounded-xl transition-all duration-200"
            >
              <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-white/70" />
              </div>
              <span className="text-sm font-medium">More wallets</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
