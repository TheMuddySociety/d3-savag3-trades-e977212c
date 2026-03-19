import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Zap, Shield, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from '@solana/wallet-adapter-react';
import { AccountConnect } from "@/components/auth/AccountConnect";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { useAdminCheck } from "@/hooks/useAdminCheck";

const Landing = () => {
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const { isAdmin } = useAdminCheck(walletAddress);
  
  useEffect(() => {
    if (connected && publicKey) {
      if (isAdmin) {
        toast.success("Admin access granted");
        navigate('/admin');
      } else {
        toast.success("Wallet connected — Welcome");
        navigate('/dashboard');
      }
    }
  }, [connected, publicKey, isAdmin]);

  const handleLaunchApp = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#030303] text-white">
      <HeroGeometric 
        badge="Solana Mainnet"
        title1="Automated Solana"
        title2="Trading Bot"
      >
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
          <p className="text-base sm:text-lg md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
            Sniper, DCA, volume bots and AI-powered strategies. 
            Built for precision on Solana mainnet.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleLaunchApp}
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white rounded-full text-sm h-12 px-8 font-semibold hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(232,31,38,0.3)] hover:shadow-[0_0_30px_rgba(232,31,38,0.5)]"
            >
              Launch Platform
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="scale-110">
              <AccountConnect size="lg" />
            </div>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto pt-8">
            {[
              { icon: <Zap className="h-4 w-4" />, label: "Buy Sniper" },
              { icon: <BarChart3 className="h-4 w-4" />, label: "Volume Bot" },
              { icon: <Shield className="h-4 w-4" />, label: "Auto Strategies" },
            ].map((feat) => (
              <div key={feat.label} className="flex flex-col items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:border-red-500/30 transition-all hover:bg-white/[0.05] group">
                <span className="text-red-500 transition-transform group-hover:scale-110">{feat.icon}</span>
                <span className="text-xs text-white/40 group-hover:text-white/60">{feat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </HeroGeometric>

      {/* Footer */}
      <footer className="absolute bottom-0 w-full border-t border-white/5 py-6 px-6 bg-transparent">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] text-white/20 uppercase tracking-[0.2em] font-mono">
          <span>&copy; {new Date().getFullYear()} SAVAG3BOT</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-green-500" />
              Mainnet Active
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
