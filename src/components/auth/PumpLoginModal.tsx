import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UnifiedWalletButton, useUnifiedWallet } from "@jup-ag/wallet-adapter";
import { ChevronRight, Zap, Flame, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface PumpLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PumpLoginModal({ open, onOpenChange }: PumpLoginModalProps) {
  const { setShowWallets }: any = useUnifiedWallet();

  const handleSocialLogin = () => {
    onOpenChange(false);
    if (setShowWallets) setShowWallets(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-[#0A0A0B] border-white/5 p-0 overflow-hidden rounded-[32px] shadow-2xl">
        <div className="relative p-8 flex flex-col items-center">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/20 blur-[80px] rounded-full pointer-events-none" />

          <h2 className="text-xl font-bold text-white mb-8 tracking-tight">Connect or create</h2>

          {/* Central Pill/Capsule Icon (Pump.fun style) */}
          <div className="relative w-24 h-24 mb-10 group">
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [-45, -45, -45] 
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full h-full flex items-center justify-center transform rotate-[-45deg]"
            >
              <div className="w-14 h-7 bg-white rounded-l-full shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
              <div className="w-14 h-7 bg-primary rounded-r-full shadow-[0_0_30px_rgba(var(--primary),0.4)]" />
            </motion.div>
            <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150 opacity-50" />
          </div>

          <div className="w-full">
            {/* Unified Wallet Button */}
            <div className="bg-[#1A1B1E] p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex justify-center">
              <UnifiedWalletButton />
            </div>
          </div>

          {/* Feature Highlights Footer */}
          <div className="w-full mt-10 pt-8 border-t border-white/5">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-primary/60" />
                </div>
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Sniper</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--fun-yellow))]/5 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[hsl(var(--fun-yellow))]/60" />
                </div>
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Auto 24/7</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-[hsl(var(--fun-purple))]/5 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[hsl(var(--fun-purple))]/60" />
                </div>
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Signals</span>
              </div>
            </div>
          </div>

          {/* Powered by Jupiter */}
          <div className="mt-6 flex items-center gap-1.5 opacity-30 hover:opacity-50 transition-opacity">
            <span className="text-[10px] font-medium text-white/50 uppercase tracking-tighter">Powered by</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Jupiter</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
