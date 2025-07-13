import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Moon, Sun, Shield, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Admin wallet addresses for checking admin status
const ADMIN_WALLETS = [
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
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect backdrop-blur-xl border-b border-white/10">
      <div className="container flex items-center justify-between h-18 px-6 mx-auto">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img 
              src="/lovable-uploads/bb8128a0-c9a0-4849-8520-af85d4a40e33.png" 
              alt="SAVAG3 D3 Tradez" 
              className="w-12 h-12 animate-float drop-shadow-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-purple-500/20 rounded-full blur-xl"></div>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-red-500 via-purple-500 to-green-400 bg-clip-text text-transparent neon-glow">
            SAVAG3 D3 Tradez
          </span>
        </div>
        
        <div className="flex items-center space-x-6">
          {connected && (
            <div className="glass-effect px-4 py-2 rounded-full">
              <Link 
                to="/dashboard" 
                className={`text-gray-300 hover:text-white transition-all duration-300 flex items-center gap-2 ${
                  isActive('/dashboard') ? 'text-white font-bold neon-glow' : 'hover:neon-glow'
                }`}
              >
                Dashboard
              </Link>
            </div>
          )}
          
          {isAdmin && (
            <div className="glass-effect px-4 py-2 rounded-full neon-border">
              <Link 
                to="/admin" 
                className={`text-red-400 hover:text-red-300 transition-all duration-300 flex items-center gap-2 ${
                  isActive('/admin') ? 'font-bold neon-glow' : 'hover:neon-glow'
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="glass-effect rounded-full w-12 h-12 hover:neon-border transition-all duration-300"
          >
            {theme === "dark" ? (
              <Sun className="h-6 w-6 text-yellow-400 neon-glow" />
            ) : (
              <Moon className="h-6 w-6 text-slate-300 neon-glow" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {connected && publicKey && (
            <div className="flex items-center gap-4">
              <div className="glass-effect p-1 rounded-full neon-border">
                <Avatar className="border-2 border-gradient-to-r from-red-500 to-purple-500 w-12 h-12">
                  <AvatarImage src={`https://source.boringavatars.com/beam/48/${publicKey.toString()}?colors=FF4136,673AB7,14F195`} />
                  <AvatarFallback className="bg-gradient-to-r from-red-500/20 to-purple-500/20 text-red-400 font-bold">
                    {publicKey.toString().substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <Button 
                onClick={handleDisconnect}
                className="glass-effect hover:neon-border transition-all duration-300 text-gray-300 hover:text-white px-4 py-2 rounded-full"
                variant="ghost"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          )}
          
          {!connected && (
            <div className="btn-shiny rounded-full overflow-hidden">
              <WalletMultiButton className="!bg-transparent !rounded-full" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
