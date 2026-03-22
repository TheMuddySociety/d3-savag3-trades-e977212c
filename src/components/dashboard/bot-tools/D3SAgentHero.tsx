import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Flame, Shield, Zap, Clock, TrendingUp, Cloud, Loader2 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";

interface D3SAgentHeroProps {
  onHire?: () => void;
  isHired?: boolean;
  isHiring?: boolean;
}

export function D3SAgentHero({ onHire, isHired, isHiring }: D3SAgentHeroProps) {
  const { publicKey } = useWallet();

  return (
    <div className="space-y-4">
      {/* Hero Card with 3D Scene */}
      <Card className="w-full h-[420px] md:h-[500px] bg-black/40 relative overflow-hidden border-border/40 backdrop-blur-md shadow-2xl">
        <Spotlight
          className="-top-40 left-0 md:left-60 md:-top-20"
          fill="hsl(var(--primary))"
        />

        <div className="flex flex-col md:flex-row h-full">
          {/* Left content */}
          <div className="flex-1 p-6 md:p-8 relative z-10 flex flex-col justify-center">
            <Badge className="w-fit mb-3 bg-primary/20 text-primary border-primary/30 text-[10px]">
              <Flame className="h-2.5 w-2.5 mr-1" /> AI AGENT
            </Badge>

            <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 leading-tight">
              D3S AGENT
            </h1>
            <p className="mt-2 text-sm md:text-base text-neutral-400 max-w-md leading-relaxed">
              Your autonomous on-chain trading agent. Hire D3S Agent to trade 24/7,
              snipe launches, and manage your portfolio while you sleep.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-5">
              {[
                { icon: Zap, label: "Jupiter Ultra Swaps" },
                { icon: Shield, label: "Anti-MEV Protection" },
                { icon: Clock, label: "24/7 Cloud Mode" },
                { icon: TrendingUp, label: "Smart DCA" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/5 text-[10px] text-neutral-300 transition-all hover:bg-white/10"
                >
                  <Icon className="h-3 w-3 text-accent" />
                  {label}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-6 flex items-center gap-3">
              {!publicKey ? (
                <p className="text-xs text-neutral-500">Connect wallet to hire D3S Agent</p>
              ) : isHired ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-accent/20 text-accent border-accent/30">
                    <Cloud className="h-3 w-3 mr-1" /> Agent Active
                  </Badge>
                  <span className="text-[10px] text-neutral-500">D3S Agent is watching the markets</span>
                </div>
              ) : (
                <Button
                  onClick={onHire}
                  disabled={isHiring}
                  variant="glass-accent"
                  className="text-sm font-bold gap-2 h-10 px-8 rounded-full border-accent/40 shadow-[0_0_20px_rgba(255,0,0,0.1)]"
                >
                  {isHiring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  {isHiring ? "Deploying Agent..." : "Hire D3S Agent"}
                </Button>
              )}
            </div>
          </div>

          {/* Right: 3D Spline Scene */}
          <div className="flex-1 relative min-h-[200px]">
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          </div>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Swaps Executed", value: "∞", sub: "Jupiter Ultra" },
          { label: "Avg Response", value: "<1s", sub: "Lightning fast" },
          { label: "Strategies", value: "6+", sub: "DCA, Snipe, Grid..." },
          { label: "Background Tasks", value: "24/7", sub: "Cloud Mode" },
        ].map(({ label, value, sub }) => (
          <Card key={label} className="p-3 bg-card/50 border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{value}</p>
            <p className="text-[9px] text-muted-foreground">{sub}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
