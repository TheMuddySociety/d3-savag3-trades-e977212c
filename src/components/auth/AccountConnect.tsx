
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
          "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-transparent hover:bg-white/5 transition-all duration-200 active:scale-95",
          className
        )}
      >
        {/* D3 Logo */}
        <img
          src="/d3-icon.png"
          alt="D3"
          className="w-6 h-6 object-contain group-hover:scale-110 transition-transform duration-200"
        />
        <span className="text-xs font-bold text-white/80 group-hover:text-white tracking-tight">
          Connect
        </span>
      </button>

      <PumpLoginModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
