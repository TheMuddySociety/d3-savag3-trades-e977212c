
import { BlockchainAnalytics } from "@/components/dashboard/BlockchainAnalytics";
import { TrendingCoins } from "@/components/dashboard/TrendingCoins";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { ProfitSimulator } from "@/components/dashboard/ProfitSimulator";
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { LaunchCalendar } from "@/components/dashboard/LaunchCalendar";
import { TokenSwap } from "@/components/dashboard/TokenSwap";
import { Header } from "@/components/layout/Header";
import { useMobile } from "@/hooks/use-mobile";

const Index = () => {
  const isMobile = useMobile();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">
          SAVAG3 D3 Tradez Dashboard
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <BlockchainAnalytics />
            <TrendingCoins />
          </div>
          
          <div className="space-y-4 md:space-y-6">
            <PerformanceMetrics />
            {isMobile ? null : <TokenSwap />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-6">
          <div className="lg:col-span-1">
            <ProfitSimulator />
          </div>
          
          <div className="lg:col-span-1">
            {isMobile ? <TokenSwap /> : null}
            <MemeScanner />
          </div>
          
          <div className="lg:col-span-1">
            <LaunchCalendar />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
