
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Moon, Sun, Shield, LogOut, Image } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Admin wallet addresses for checking admin status
const ADMIN_WALLETS = [
  "Hn1NxCYHwbhVyFbPmxnjdKVYR5BnhyKCvHvAFPBrBkn9",
  "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH"
];

export function Header() {
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { publicKey, connected, disconnect } = useWallet();

  useEffect(() => {
    // Verify wallet connection on mount
    const checkConnection = async () => {
      if (!connected || !publicKey) {
        toast({
          title: "Wallet not connected",
          description: "Please connect your wallet from the landing page",
          variant: "destructive"
        });
        navigate('/');
        return;
      }
      
      // Check if admin
      const walletAddress = publicKey.toString();
      setIsAdmin(ADMIN_WALLETS.includes(walletAddress));
      
      // Update local storage
      localStorage.setItem('connectedWallet', walletAddress);
      localStorage.setItem('walletConnected', 'true');
    };
    
    checkConnection();
  }, [navigate, toast, connected, publicKey]);

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('connectedWallet');
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800">
      <div className="container flex items-center justify-between h-16 px-4 mx-auto">
        <div className="flex items-center space-x-2">
          <img 
            src="/lovable-uploads/bb8128a0-c9a0-4849-8520-af85d4a40e33.png" 
            alt="SAVAG3 D3 Tradez" 
            className="w-10 h-10 animate-float"
          />
          <span className="text-xl font-bold text-red-600">
            SAVAG3 D3 Tradez
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          {connected && (
            <>
              <Link 
                to="/dashboard" 
                className={`text-gray-400 hover:text-white flex items-center gap-1 ${isActive('/dashboard') ? 'text-white font-bold' : ''}`}
              >
                Dashboard
              </Link>
              
              <Link 
                to="/nft-launch" 
                className={`text-gray-400 hover:text-white flex items-center gap-1 ${isActive('/nft-launch') ? 'text-white font-bold' : ''}`}
              >
                <Image className="h-4 w-4" />
                NFT Launch
              </Link>
            </>
          )}
          
          {isAdmin && (
            <Link 
              to="/admin" 
              className={`text-red-500 hover:text-red-400 flex items-center gap-1 ${isActive('/admin') ? 'font-bold' : ''}`}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
              <Moon className="h-5 w-5 text-slate-700" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {connected && publicKey && (
            <div className="flex items-center gap-4">
              <Avatar className="border-2 border-red-600 animate-pulse">
                <AvatarImage src={`https://source.boringavatars.com/beam/40/${publicKey.toString()}?colors=FF4136,222222,FFFFFF`} />
                <AvatarFallback className="bg-gray-900 text-red-600">
                  {publicKey.toString().substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              
              <Button 
                onClick={handleDisconnect}
                variant="ghost"
                className="text-gray-400 hover:text-white flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          )}
          
          {!connected && (
            <WalletMultiButton />
          )}
        </div>
      </div>
    </header>
  );
};
