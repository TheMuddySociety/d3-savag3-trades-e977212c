
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TrendingCoins } from "@/components/dashboard/TrendingCoins";
import { ProfitSimulator } from "@/components/dashboard/ProfitSimulator";
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { LaunchCalendar } from "@/components/dashboard/LaunchCalendar";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { BlockchainAnalytics } from "@/components/dashboard/BlockchainAnalytics";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Index = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for authorization based on wallet ownership and NFT/token holdings
    const checkAuth = async () => {
      const walletConnected = localStorage.getItem('walletConnected') === 'true';
      
      if (!walletConnected) {
        navigate('/');
        return;
      }
      
      const connectedWallet = localStorage.getItem('connectedWallet');
      
      if (!connectedWallet) {
        toast.error("Wallet not found. Please reconnect.");
        navigate('/');
        return;
      }
      
      console.log("Dashboard accessed by wallet:", connectedWallet);
      
      // In a real app, we would check if the wallet owns any of the approved NFTs or tokens
      // For now, we'll use the tokens and collections added by the admin
      const adminTokens = JSON.parse(localStorage.getItem('adminTokens') || '[]');
      const adminCollections = JSON.parse(localStorage.getItem('adminCollections') || '[]');
      
      console.log("Approved tokens:", adminTokens);
      console.log("Approved NFT collections:", adminCollections);
      
      // For demo purposes, we'll set authorized to true
      setIsAuthorized(true);
    };
    
    checkAuth();
  }, [navigate]);

  if (!isAuthorized) {
    return null; // Don't render anything while checking auth
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      
      <main className="container mx-auto pt-24 px-4">
        <div className="flex flex-col gap-8 animate-slide-up">
          <section className="text-center max-w-3xl mx-auto mb-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-red-600">
              SAVAG3 D3 Tradez
            </h1>
            <p className="text-lg text-gray-400">
              Discover trending Solana memecoins, analyze on-chain data, and maximize potential returns
            </p>
          </section>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PerformanceMetrics />
            
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-6">
              <TrendingCoins />
              
              <BlockchainAnalytics />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProfitSimulator />
                <MemeScanner />
              </div>
              
              <LaunchCalendar />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
