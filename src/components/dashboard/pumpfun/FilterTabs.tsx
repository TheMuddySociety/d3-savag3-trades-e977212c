import React from 'react';
import { Sparkles, Radio, Trophy, Coins, ChevronDown, Filter, Grid3X3, List, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FilterType = 'movers' | 'live' | 'new' | 'marketcap';

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

const filters = [
  { id: 'movers' as FilterType, label: 'Movers', icon: Sparkles, color: 'text-yellow-400' },
  { id: 'live' as FilterType, label: 'Live', icon: Radio, color: 'text-red-500' },
  { id: 'new' as FilterType, label: 'New', icon: Trophy, color: 'text-amber-400' },
  { id: 'marketcap' as FilterType, label: 'Market cap', icon: Coins, color: 'text-green-400' },
];

export function FilterTabs({ activeFilter, onFilterChange, viewMode, onViewModeChange }: FilterTabsProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "rounded-full gap-2 transition-all",
              activeFilter === filter.id 
                ? "bg-card border-2 border-primary text-primary shadow-lg shadow-primary/20" 
                : "bg-card/50 border border-border hover:bg-card hover:border-primary/50"
            )}
            onClick={() => onFilterChange(filter.id)}
          >
            <filter.icon className={cn("h-4 w-4", filter.color)} />
            {filter.label}
          </Button>
        ))}
        
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-2 bg-card/50 border border-border hover:bg-card"
        >
          More
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-2 bg-card/50 border border-border hover:bg-card"
        >
          <Filter className="h-4 w-4" />
          Filter
        </Button>

        <div className="flex rounded-full border border-border bg-card/50 p-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full",
              viewMode === 'grid' && "bg-primary text-primary-foreground"
            )}
            onClick={() => onViewModeChange('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full",
              viewMode === 'list' && "bg-primary text-primary-foreground"
            )}
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-card/50 border border-border hover:bg-card"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
