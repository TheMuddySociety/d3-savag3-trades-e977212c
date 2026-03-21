
import React, { useState } from "react";
import { PumpLoginModal } from "./PumpLoginModal";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";

interface AccountConnectProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export function AccountConnect({ className, size = "sm" }: AccountConnectProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { connected } = useWallet();

  if (connected) return null;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          "group relative flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A0A0B] border border-white/10 hover:border-primary/40 transition-all duration-300 active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.15)] hover:shadow-[0_0_30px_rgba(var(--primary),0.3)]",
          className
        )}
      >
        {/* Pill capsule icon */}
        <div className="relative flex items-center transform rotate-[-30deg] scale-75">
          <div className="w-4 h-2.5 bg-white rounded-l-full" />
          <div className="w-4 h-2.5 bg-primary rounded-r-full shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
        </div>

        {/* Text */}
        <span className="text-xs font-bold text-white/90 group-hover:text-white tracking-tight whitespace-nowrap">
          Connect
        </span>

        {/* Subtle glow behind pill */}
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </button>

      <PumpLoginModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
