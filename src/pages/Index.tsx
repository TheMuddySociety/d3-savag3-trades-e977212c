
import { TopMemecoins } from "@/components/dashboard/TopMemecoins";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { MemeScanner } from "@/components/dashboard/MemeScanner";
import { TokenSwap } from "@/components/dashboard/TokenSwap";
import { BotAccess } from "@/components/dashboard/BotAccess";
import { MiniChart } from "@/components/dashboard/MiniChart";
import { LiveSignalFeed } from "@/components/dashboard/LiveSignalFeed";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen bg-background p-3 md:p-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Cute Bubbly Header */}
        <div className="retro-terminal p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🚀</div>
              <h1 className="text-base font-bold text-primary tracking-wide">
                MEMEFLOW
              </h1>
              <span className="bg-primary/20 text-primary border-2 border-primary/50 font-semibold text-xs px-2 py-0.5 rounded-full">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Main Trading Section */}
          <div className="lg:col-span-2 space-y-3">
            <TokenSwap />
            <TopMemecoins />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <MiniChart title="SOL/USD" currentValue={67.4} change={12.3} />
              <MiniChart title="MEME INDEX" currentValue={234.8} change={-5.2} />
            </div>
            <LiveSignalFeed />
            <MemeScanner />
            <BotAccess />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
