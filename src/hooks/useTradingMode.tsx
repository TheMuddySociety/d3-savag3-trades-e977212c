
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { PLATFORM_CONFIG } from "@/config/platform";

const PLATFORM_WALLET = PLATFORM_CONFIG.WALLET_ADDRESS;
const FEE_FREE_COST = 0.1; // SOL
const RPC_URL = PLATFORM_CONFIG.RPC_URL;

interface TradingModeContextType {
  isLive: boolean;
  hasPaid: boolean;
  hasFreePass: boolean;
  isPaymentPending: boolean;
  isCheckingPayment: boolean;
  toggleMode: () => void;
  payAccessFee: () => Promise<boolean>;
  buyFreePass: () => Promise<boolean>;
}

const TradingModeContext = createContext<TradingModeContextType>({
  isLive: false,
  hasPaid: true,
  hasFreePass: false,
  isPaymentPending: false,
  isCheckingPayment: false,
  toggleMode: () => {},
  payAccessFee: async () => true,
  buyFreePass: async () => false,
});

export const useTradingMode = () => useContext(TradingModeContext);

export const TradingModeProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const { publicKey, signTransaction, connected } = useWallet();
  const [isLive, setIsLive] = useState(true);
  const [hasPaid] = useState(true);
  const [hasFreePass, setHasFreePass] = useState(false);
  const [isPaymentPending, setIsPaymentPending] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Check if wallet has a fee-free pass
  useEffect(() => {
    if (!connected || !publicKey) {
      setHasFreePass(false);
      return;
    }

    const checkPass = async () => {
      setIsCheckingPayment(true);
      try {
        const { data } = await supabase
          .from('access_payments')
          .select('id')
          .eq('wallet_address', publicKey.toString())
          .eq('payment_type', 'fee_free_pass')
          .limit(1);

        setHasFreePass((data?.length || 0) > 0);
      } catch (e) {
        console.error('Check fee-free pass error:', e);
      } finally {
        setIsCheckingPayment(false);
      }
    };

    checkPass();
  }, [connected, publicKey]);

  const payAccessFee = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  const buyFreePass = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signTransaction) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return false;
    }

    try {
      setIsPaymentPending(true);
      const connection = new Connection(RPC_URL);
      const lamports = Math.floor(FEE_FREE_COST * 1e9);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports,
        })
      );

      transaction.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signed = await signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txid);

      // Verify payment on server (on-chain check prevents fake signatures)
      const { data, error: verifyErr } = await supabase.functions.invoke('verify-payment', {
        body: { walletAddress: publicKey.toString(), signature: txid },
      });

      if (verifyErr || data?.error) {
        throw new Error(data?.error || verifyErr?.message || 'Payment verification failed');
      }

      setHasFreePass(true);
      toast({ title: "✨ Fee-Free Pass Activated!", description: "All platform fees removed permanently for this wallet" });
      return true;
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setIsPaymentPending(false);
    }
  }, [publicKey, signTransaction, toast]);

  const toggleMode = useCallback(() => {
    // Always live mode — paper mode removed
    if (!isLive) {
      setIsLive(true);
      toast({ title: "🔴 Live Mode", description: "Executing real Solana transactions" });
    }
  }, [isLive, toast]);

  return (
    <TradingModeContext.Provider value={{ isLive, hasPaid, hasFreePass, isPaymentPending, isCheckingPayment, toggleMode, payAccessFee, buyFreePass }}>
      {children}
    </TradingModeContext.Provider>
  );
};
