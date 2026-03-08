
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ACCESS_FEE_SOL = 0.04141;
const TREASURY_WALLET = "GzGuoKXE8Unn7Vcg1DtomwNk5bkt4gETrFeGnHMEApnY";

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
  hasPaid: false,
  isPaymentPending: false,
  isCheckingPayment: false,
  toggleMode: () => {},
  payAccessFee: async () => false,
});

export const useTradingMode = () => useContext(TradingModeContext);

export const TradingModeProvider = ({ children }: { children: ReactNode }) => {
  const { publicKey, sendTransaction } = useWallet();
  const { toast } = useToast();
  const [isLive, setIsLive] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [isPaymentPending, setIsPaymentPending] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Check existing payment on wallet connect
  useEffect(() => {
    const checkPayment = async () => {
      if (!publicKey) {
        setHasPaid(false);
        setIsLive(false);
        return;
      }
      try {
        setIsCheckingPayment(true);
        const { data } = await supabase
          .from('access_payments')
          .select('id')
          .eq('wallet_address', publicKey.toBase58())
          .maybeSingle();
        if (data) {
          setHasPaid(true);
        }
      } catch (err) {
        console.error('Check payment error:', err);
      } finally {
        setIsCheckingPayment(false);
      }
    };
    checkPayment();
  }, [publicKey]);

  const payAccessFee = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !sendTransaction) {
      toast({ title: "Wallet not connected", description: "Connect your wallet to go live", variant: "destructive" });
      return false;
    }

    try {
      setIsPaymentPending(true);
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(TREASURY_WALLET),
          lamports: Math.round(ACCESS_FEE_SOL * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      // Store payment in database
      const { error } = await supabase.from('access_payments').insert({
        wallet_address: publicKey.toBase58(),
        tx_signature: signature,
        sol_amount: ACCESS_FEE_SOL,
      });

      if (error) {
        console.error('Failed to store payment:', error);
        // Payment went through on-chain, still grant access
      }

      setHasPaid(true);
      setIsLive(true);
      toast({
        title: "🔓 Live Trading Unlocked!",
        description: `Paid ${ACCESS_FEE_SOL} SOL. Access persists across sessions.`,
      });
      return true;
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
      return false;
    } finally {
      setIsPaymentPending(false);
    }
  }, [publicKey, sendTransaction, toast]);

  const toggleMode = useCallback(() => {
    if (isLive) {
      setIsLive(false);
      toast({ title: "📄 Paper Mode", description: "Switched back to paper trading" });
    } else if (hasPaid) {
      setIsLive(true);
      toast({ title: "🔴 Live Mode", description: "Now executing real Solana transactions!" });
    }
  }, [isLive, hasPaid, toast]);

  return (
    <TradingModeContext.Provider value={{ isLive, hasPaid, isPaymentPending, isCheckingPayment, toggleMode, payAccessFee }}>
      {children}
    </TradingModeContext.Provider>
  );
};
