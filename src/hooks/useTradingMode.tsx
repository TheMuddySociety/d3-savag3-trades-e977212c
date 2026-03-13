
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface TradingModeContextType {
  isLive: boolean;
  hasPaid: boolean;
  isPaymentPending: boolean;
  isCheckingPayment: boolean;
  toggleMode: () => void;
  payAccessFee: () => Promise<boolean>;
}

const TradingModeContext = createContext<TradingModeContextType>({
  isLive: false,
  hasPaid: true,
  isPaymentPending: false,
  isCheckingPayment: false,
  toggleMode: () => {},
  payAccessFee: async () => true,
});

export const useTradingMode = () => useContext(TradingModeContext);

export const TradingModeProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [isLive, setIsLive] = useState(false);
  const [hasPaid] = useState(true); // Open access — no payment required
  const [isPaymentPending] = useState(false);
  const [isCheckingPayment] = useState(false);

  const payAccessFee = useCallback(async (): Promise<boolean> => {
    // No payment required — always return true
    return true;
  }, []);

  const toggleMode = useCallback(() => {
    if (isLive) {
      setIsLive(false);
      toast({ title: "📄 Paper Mode", description: "Switched back to paper trading" });
    } else {
      setIsLive(true);
      toast({ title: "🔴 Live Mode", description: "Now executing real Solana transactions!" });
    }
  }, [isLive, toast]);

  return (
    <TradingModeContext.Provider value={{ isLive, hasPaid, isPaymentPending, isCheckingPayment, toggleMode, payAccessFee }}>
      {children}
    </TradingModeContext.Provider>
  );
};
