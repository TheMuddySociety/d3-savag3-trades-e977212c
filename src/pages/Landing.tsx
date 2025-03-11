
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Admin wallet addresses for direct access to admin dashboard
const ADMIN_WALLETS = [
  "Hn1NxCYHwbhVyFbPmxnjdKVYR5BnhyKCvHvAFPBrBkn9",
  "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH"
];

const Landing = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const { publicKey, connected } = useWallet();
  
  // Check if wallet is connected
  useEffect(() => {
    if (connected && publicKey) {
      handleWalletConnected(publicKey.toString());
    }
  }, [connected, publicKey]);
  
  const handleWalletConnected = async (walletAddress: string) => {
    setConnecting(true);
    
    try {
      console.log("Connected wallet:", walletAddress);
      localStorage.setItem('connectedWallet', walletAddress);
      
      // Simulate checking for NFT or token ownership
      const hasAccess = Math.random() > 0.2; // 80% chance of success for demo
      
      if (hasAccess) {
        // Check if admin wallet
        if (ADMIN_WALLETS.includes(walletAddress)) {
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
          <div className="w-48 h-48 mb-8 relative">
            <img 
              src="/lovable-uploads/034236bf-7a4a-4d94-b426-562b05b5288a.png" 
              alt="SAVAG3 Bull Logo" 
              className="w-full h-full object-contain animate-pulse-glow" 
            />
          </div>
          
          <div className="flex flex-col items-center">
            <WalletMultiButton className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 rounded-full px-10 py-6 text-xl shadow-lg hover:shadow-red-600/20 transition-all" />
          </div>
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
