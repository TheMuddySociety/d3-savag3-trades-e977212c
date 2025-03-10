
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

// Admin wallet address for direct access to admin dashboard
const ADMIN_WALLET = "Hn1NxCYHwbhVyFbPmxnjdKVYR5BnhyKCvHvAFPBrBkn9";

const Landing = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  
  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      // Simulate wallet connection and verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, randomly generate a wallet address (or use admin)
      // In production, this would come from the actual wallet connection
      const isAdminDemo = Math.random() > 0.7; // 30% chance of simulating admin login
      const walletAddress = isAdminDemo 
        ? ADMIN_WALLET 
        : `So1ana${Math.random().toString(36).substring(2, 10)}`;
      
      console.log("Connected wallet:", walletAddress);
      localStorage.setItem('connectedWallet', walletAddress);
      
      // Simulate checking for NFT or token ownership
      const hasAccess = Math.random() > 0.2; // 80% chance of success for demo
      
      if (hasAccess) {
        // Check if admin wallet
        if (walletAddress === ADMIN_WALLET) {
          toast.success("Admin access granted! Welcome to SAVAG3 D3 Tradez");
          navigate('/admin');
        } else {
          toast.success("Access granted! Welcome to SAVAG3 D3 Tradez");
          navigate('/dashboard');
        }
        
        // Set wallet as connected for authorization purposes
        localStorage.setItem('walletConnected', 'true');
      } else {
        toast.error("Access denied. You need to own our NFT or tokens to access the app.");
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error("Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-3xl mx-auto mb-12 animate-scale-in">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 text-red-600">
          SAVAG3 D3 Tradez
        </h1>
        <p className="text-xl text-white mb-12">
          Exclusive Trading Tool for NFT Collectors and Token Holders
        </p>
        
        <div className="flex flex-col items-center">
          <img 
            src="/lovable-uploads/951ca7c8-2171-4218-af7b-a98046f54e14.png" 
            alt="Demon Bull Logo" 
            className="w-48 h-48 mb-8 animate-pulse-glow" 
          />
          
          <Button 
            onClick={handleConnect}
            disabled={connecting}
            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 rounded-full px-10 py-8 text-xl shadow-lg hover:shadow-red-600/20 transition-all"
          >
            {connecting ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="h-6 w-6" />
                ENTER
              </>
            )}
          </Button>
        </div>
        
        <p className="text-gray-400 mt-6 text-sm">
          Connect your Solana wallet to verify ownership and access the platform
        </p>
      </div>
      
      <div className="text-center mt-auto text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} SAVAG3 D3 Tradez. All rights reserved.
      </div>
    </div>
  );
};

export default Landing;
