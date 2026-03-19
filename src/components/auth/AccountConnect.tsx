
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PumpLoginModal } from "./PumpLoginModal";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet } from "lucide-react";
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
      <Button
        onClick={() => setModalOpen(true)}
        className={cn(
          "bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(var(--primary),0.3)]",
          className
        )}
        size={size}
      >
        <Wallet className="w-3.5 h-3.5 mr-2" />
        Connect or Create
      </Button>

      <PumpLoginModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
