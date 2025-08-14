
import { BlockchainAnalytics } from "@/components/dashboard/BlockchainAnalytics";
import { TopMemecoins } from "@/components/dashboard/TopMemecoins";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { ProfitSimulator } from "@/components/dashboard/ProfitSimulator";
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { LaunchCalendar } from "@/components/dashboard/LaunchCalendar";
import { TokenSwap } from "@/components/dashboard/TokenSwap";
import { BotAccess } from "@/components/dashboard/BotAccess";
import { Header } from "@/components/layout/Header";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Retro PC Header */}
        <div className="retro-terminal p-2 mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-primary font-mono tracking-wider">
                &gt; MEMEFLOW.EXE
              </h1>
              <span className="bg-primary/20 text-primary border border-primary/50 font-mono text-xs px-1">
                v1.0
              </span>
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              [{new Date().toLocaleTimeString()}]
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* Main Trading Section */}
          <div className="space-y-2">
            <TokenSwap />
            <TopMemecoins />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-2">
            <MemeScanner />
            <PerformanceMetrics />
            <BotAccess />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
