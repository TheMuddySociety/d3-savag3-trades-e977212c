import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWalletAuth() {
  const { publicKey, connected, signMessage } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authAttemptedRef = useRef<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const sessionWallet = session.user?.user_metadata?.wallet_address;
        const currentWallet = publicKey?.toBase58();
        if (sessionWallet && currentWallet && sessionWallet === currentWallet) {
          setIsAuthenticated(true);
        } else if (session && !currentWallet) {
          // Session exists but no wallet connected — keep session
          setIsAuthenticated(true);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, [publicKey]);

  const authenticate = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return false;

    const walletAddress = publicKey.toBase58();

    // Prevent duplicate auth attempts for same wallet
    if (authAttemptedRef.current === walletAddress) return isAuthenticated;
    authAttemptedRef.current = walletAddress;

    // Check if already authenticated with this wallet
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.user_metadata?.wallet_address === walletAddress) {
      setIsAuthenticated(true);
      return true;
    }

    setIsAuthenticating(true);
    try {
      const nonce = Date.now();
      const message = `Sign in to SAVAG3BOT\nWallet: ${walletAddress}\nNonce: ${nonce}`;
      const messageBytes = new TextEncoder().encode(message);

      // Request wallet signature
      const signatureBytes = await signMessage(messageBytes);

      // Convert signature to base58
      const signature = base58Encode(signatureBytes);

      // Send to edge function for verification
      const { data, error } = await supabase.functions.invoke("wallet-auth", {
        body: { wallet_address: walletAddress, message, signature },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Authentication failed");

      // Set the session
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionErr) throw sessionErr;

      setIsAuthenticated(true);
      return true;
    } catch (err: any) {
      console.error("SIWS auth error:", err);
      authAttemptedRef.current = null; // Allow retry
      if (err.message?.includes("User rejected")) {
        toast.error("Signature rejected — sign the message to access your data");
      } else {
        toast.error("Authentication failed: " + (err.message || "Unknown error"));
      }
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [connected, publicKey, signMessage, isAuthenticated]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    authAttemptedRef.current = null;
    setIsAuthenticated(false);
  }, []);

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (connected && publicKey && signMessage && !isAuthenticated && !isAuthenticating) {
      authenticate();
    }
    if (!connected) {
      authAttemptedRef.current = null;
    }
  }, [connected, publicKey, signMessage, isAuthenticated, isAuthenticating, authenticate]);

  // Heartbeat to clear Supabase session if wallet maliciously or silently disconnects
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!connected && session) {
        console.log("Wallet desync detected: Disconnected in extension but Supabase session active. Signing out.");
        await supabase.auth.signOut();
        setIsAuthenticated(false);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [connected]);

  return { isAuthenticated, isAuthenticating, authenticate, signOut };
}

// Base58 encoder
function base58Encode(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    str += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += ALPHABET[digits[i]];
  }
  return str;
}
