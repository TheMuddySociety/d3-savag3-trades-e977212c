import { useNavigate, useLocation, Link } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { useTradingMode } from '@/hooks/useTradingMode';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useToast } from "@/components/ui/use-toast";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountConnect } from '@/components/auth/AccountConnect';

// Shared Sub-components
import { NavLogo } from "./header/NavLogo";
import { FeeBadge } from "./header/FeeBadge";
import { WalletUserMenu } from "./header/WalletUserMenu";

/**
 * Shared hook to manage common header logic
 */
function useHeaderLogic() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { publicKey, connected, disconnect } = useWallet();
  const { hasFreePass, buyFreePass, isPaymentPending } = useTradingMode();
  const { signOut } = useWalletAuth();

  const handleDisconnect = async () => {
    await signOut();
    disconnect();
    toast({
      title: "Disconnected",
      description: "Wallet disconnected successfully",
    });
    navigate('/');
  };

  return {
    publicKey,
    connected,
    handleDisconnect,
    hasFreePass,
    buyFreePass,
    isPaymentPending
  };
}

export function Header() {
  const logic = useHeaderLogic();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <NavLogo />
        </div>

        <div className="flex items-center gap-2">
          <FeeBadge 
            connected={logic.connected}
            hasFreePass={logic.hasFreePass}
            isPaymentPending={logic.isPaymentPending}
            onBuyPass={logic.buyFreePass}
          />

          {logic.connected && logic.publicKey ? (
            <WalletUserMenu 
              publicKey={logic.publicKey}
              onDisconnect={logic.handleDisconnect}
            />
          ) : (
            <AccountConnect />
          )}
        </div>
      </div>
    </header>
  );
}

// Full header for Landing page with Dashboard/Admin links
export function LandingHeader() {
  const logic = useHeaderLogic();
  const location = useLocation();
  const walletAddress = logic.publicKey?.toBase58() || null;
  const { isAdmin } = useAdminCheck(walletAddress);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <NavLogo />
        </div>
        
        <div className="flex items-center gap-2">
          <FeeBadge 
            connected={logic.connected}
            hasFreePass={logic.hasFreePass}
            isPaymentPending={logic.isPaymentPending}
            onBuyPass={logic.buyFreePass}
          />

          {logic.connected && (
            <Link to="/dashboard">
              <Button
                variant={isActive('/dashboard') ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8"
              >
                Dashboard
              </Button>
            </Link>
          )}
          
          {isAdmin && (
            <Link to="/admin">
              <Button
                variant={isActive('/admin') ? "secondary" : "ghost"}
                size="sm"
                className="text-xs h-8 text-primary"
              >
                <Shield className="h-3.5 w-3.5 mr-1" />
                Admin
              </Button>
            </Link>
          )}
          
          {logic.connected && logic.publicKey ? (
            <WalletUserMenu 
              publicKey={logic.publicKey}
              onDisconnect={logic.handleDisconnect}
            />
          ) : (
            <AccountConnect />
          )}
        </div>
      </div>
    </header>
  );
}

