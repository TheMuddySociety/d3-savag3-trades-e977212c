import React, { useEffect, useState } from 'react';
import { Globe } from '@/components/ui/globe';
import { pumpFunService } from '@/services/pumpfun';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';
import { Rocket, TrendingUp } from 'lucide-react';

const GLOBAL_HUBS: [number, number][] = [
  [40.7128, -74.0060],  // NYC
  [51.5074, -0.1278],   // London
  [35.6762, 139.6503],  // Tokyo
  [1.3521, 103.8198],   // Singapore
  [25.2048, 55.2708],   // Dubai
  [-33.8688, 151.2093], // Sydney
  [48.8566, 2.3522],    // Paris
  [37.5665, 126.9780],  // Seoul
  [19.0760, 72.8777],   // Mumbai
  [-23.5505, -46.6333], // Sao Paulo
];

export function TrendingGlobe() {
  const [tokens, setTokens] = useState<MemeToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchTokens = async () => {
      try {
        const trending = await pumpFunService.getTrendingTokens(10);
        if (!cancelled) {
          setTokens(trending);
        }
      } catch (err) {
        console.error('Failed to fetch trending tokens for globe:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTokens();
    const interval = setInterval(fetchTokens, 60000); // Update every minute
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const markers = tokens.map((token, i) => ({
    location: GLOBAL_HUBS[i % GLOBAL_HUBS.length],
    size: 0.05 + (Math.min(token.marketCap / 10000000, 0.1)), // Scale based on Market Cap (max 0.15)
  }));

  return (
    <div className="relative w-full aspect-square max-w-[400px] flex items-center justify-center group">
      {/* Background glow */}
      <div className="absolute inset-0 bg-accent/5 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      
      <Globe 
        className="w-full h-full"
        config={{
          width: 800,
          height: 800,
          onRender: () => {},
          devicePixelRatio: 2,
          phi: 0,
          theta: 0.3,
          dark: 1, // Dark mode globe
          diffuse: 1.2,
          mapSamples: 16000,
          mapBrightness: 1.5,
          baseColor: [0.1, 0.1, 0.1], // Dark gray base
          markerColor: [232 / 255, 31 / 255, 38 / 255], // Red accent
          glowColor: [0.15, 0.15, 0.15],
          markers: markers.length > 0 ? markers : [
            { location: [40.7128, -74.0060], size: 0.05 },
            { location: [35.6762, 139.6503], size: 0.05 }
          ]
        }}
      />

      {/* Overlay info */}
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-accent/20 px-3 py-1 rounded-full">
          <TrendingUp className="h-3 w-3 text-accent animate-pulse" />
          <span className="text-[10px] font-mono text-white tracking-widest uppercase">
            Trending Highlights
          </span>
        </div>
        {tokens.length > 0 && (
          <div className="text-[11px] font-mono text-white/60 animate-in fade-in slide-in-from-bottom-2">
            Top MCap: <span className="text-accent">${(tokens[0].marketCap / 1e6).toFixed(2)}M</span>
          </div>
        )}
      </div>

      {/* Top indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">
          Pump.Fun Network
        </div>
      </div>
    </div>
  );
}
