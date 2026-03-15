import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdminCheck(walletAddress: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-admin", {
          body: { wallet_address: walletAddress },
        });
        if (!cancelled) {
          setIsAdmin(data?.isAdmin === true);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [walletAddress]);

  return { isAdmin, isLoading };
}
