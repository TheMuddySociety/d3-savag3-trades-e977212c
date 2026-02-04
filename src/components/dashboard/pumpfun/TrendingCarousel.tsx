import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';

interface TrendingCarouselProps {
  tokens: MemeToken[];
  onTokenClick: (token: MemeToken) => void;
}

const formatMarketCap = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

export function TrendingCarousel({ tokens, onTokenClick }: TrendingCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Trending coins</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-border bg-card hover:bg-muted"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-border bg-card hover:bg-muted"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tokens.slice(0, 8).map((token) => (
          <div
            key={token.id}
            className={cn(
              "flex-shrink-0 w-72 h-48 rounded-xl overflow-hidden cursor-pointer",
              "relative group transition-all duration-300",
              "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20"
            )}
            onClick={() => onTokenClick(token)}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src={token.logoUrl}
                alt={token.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            </div>

            {/* Content Overlay */}
            <div className="absolute inset-0 p-4 flex flex-col justify-end">
              <div className="mb-2">
                <span className="text-2xl font-bold text-white">
                  {formatMarketCap(token.marketCap)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{token.name}</span>
                <span className="text-white/60 text-sm">{token.symbol}</span>
              </div>
            </div>

            {/* Hover effect */}
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
}
