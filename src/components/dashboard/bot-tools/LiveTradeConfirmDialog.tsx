import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LiveTradeConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  action: string;
  tokenSymbol: string;
  solAmount: number;
}

export const LiveTradeConfirmDialog = ({
  open,
  onConfirm,
  onCancel,
  action,
  tokenSymbol,
  solAmount,
}: LiveTradeConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="bg-card border-destructive/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            ⚠️ Confirm Live Trade
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="text-foreground font-medium">
              You are about to execute a <span className="text-destructive font-bold">REAL</span> {action} on Solana mainnet.
            </p>
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Action</span>
                <span className="text-foreground font-mono">{action}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Token</span>
                <span className="text-foreground font-mono">{tokenSymbol || "Unknown"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground font-mono">{solAmount} SOL</span>
              </div>
            </div>
            <p className="text-destructive text-xs font-medium">
              This transaction is irreversible. Real SOL will be spent from your wallet.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Execute Live Trade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
