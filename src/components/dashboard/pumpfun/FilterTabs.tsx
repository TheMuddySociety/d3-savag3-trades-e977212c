import React, { useState } from 'react';
import { Sparkles, Radio, Trophy, Coins, ChevronDown, Filter, Grid3X3, List, Settings, Flame, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

export type FilterType = 'movers' | 'live' | 'new' | 'marketcap' | 'volume' | 'gainers' | 'oldest';

export interface FilterOptions {
  minMarketCap: number | null;
  minVolume: number | null;
  onlyPositive: boolean;
  bondingCurveRange: 'any' | '0-25' | '25-50' | '50-80' | '80-99' | 'graduated';
}

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  filterOptions?: FilterOptions;
  onFilterOptionsChange?: (options: FilterOptions) => void;
}

const primaryFilters = [
  { id: 'movers' as FilterType, label: 'Movers', icon: Sparkles, color: 'text-accent' },
  { id: 'live' as FilterType, label: 'Live', icon: Radio, color: 'text-accent' },
  { id: 'new' as FilterType, label: 'New', icon: Trophy, color: 'text-accent' },
  { id: 'marketcap' as FilterType, label: 'Market cap', icon: Coins, color: 'text-accent' },
];

const moreFilters = [
  { id: 'volume' as FilterType, label: 'Volume', icon: BarChart3 },
  { id: 'gainers' as FilterType, label: 'Top Gainers', icon: TrendingUp },
  { id: 'oldest' as FilterType, label: 'Oldest', icon: Clock },
];

const defaultFilterOptions: FilterOptions = {
  minMarketCap: null,
  minVolume: null,
  onlyPositive: false,
  bondingCurveRange: 'any',
};

export function FilterTabs({ 
  activeFilter, 
  onFilterChange, 
  viewMode, 
  onViewModeChange,
  filterOptions = defaultFilterOptions,
  onFilterOptionsChange,
}: FilterTabsProps) {
  const isMoreActive = moreFilters.some(f => f.id === activeFilter);
  const activeMoreLabel = moreFilters.find(f => f.id === activeFilter)?.label;

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        {primaryFilters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? 'glass-accent' : 'glass'}
            size="sm"
            className={cn(
              "rounded-full gap-2 transition-all duration-300",
              activeFilter !== filter.id && "opacity-70 hover:opacity-100"
            )}
            onClick={() => onFilterChange(filter.id)}
          >
            <filter.icon className={cn("h-4 w-4", activeFilter === filter.id ? "text-accent" : "text-muted-foreground")} />
            {filter.label}
          </Button>
        ))}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isMoreActive ? 'glass-accent' : 'glass'}
              size="sm"
              className={cn(
                "rounded-full gap-2 transition-all duration-300",
                !isMoreActive && "opacity-70 hover:opacity-100"
              )}
            >
              {isMoreActive ? activeMoreLabel : 'More'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
            {moreFilters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                className={cn(
                  "gap-2 cursor-pointer",
                  activeFilter === filter.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => onFilterChange(filter.id)}
              >
                <filter.icon className="h-4 w-4" />
                {filter.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={(filterOptions.onlyPositive || filterOptions.minMarketCap || filterOptions.minVolume || filterOptions.bondingCurveRange !== 'any') ? 'glass-accent' : 'glass'}
              size="sm"
              className={cn(
                "rounded-full gap-2 transition-all duration-300",
                !(filterOptions.onlyPositive || filterOptions.minMarketCap || filterOptions.minVolume || filterOptions.bondingCurveRange !== 'any') && "opacity-70 hover:opacity-100"
              )}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Filter tokens</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={filterOptions.onlyPositive}
              onCheckedChange={(checked) =>
                onFilterOptionsChange?.({ ...filterOptions, onlyPositive: !!checked })
              }
            >
              Only positive 24h
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Min Market Cap</DropdownMenuLabel>
            {[null, 10000, 100000, 1000000].map((val) => (
              <DropdownMenuItem
                key={String(val)}
                className={cn("cursor-pointer", filterOptions.minMarketCap === val && "bg-accent text-accent-foreground")}
                onClick={() => onFilterOptionsChange?.({ ...filterOptions, minMarketCap: val })}
              >
                {val === null ? 'Any' : val >= 1e6 ? `$${val / 1e6}M` : `$${val / 1e3}K`}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Min Volume</DropdownMenuLabel>
            {[null, 5000, 50000, 500000].map((val) => (
              <DropdownMenuItem
                key={String(val)}
                className={cn("cursor-pointer", filterOptions.minVolume === val && "bg-accent text-accent-foreground")}
                onClick={() => onFilterOptionsChange?.({ ...filterOptions, minVolume: val })}
              >
                {val === null ? 'Any' : val >= 1e6 ? `$${val / 1e6}M` : `$${val / 1e3}K`}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Bonding Curve</DropdownMenuLabel>
            {([
              { value: 'any' as const, label: 'Any' },
              { value: '0-25' as const, label: '0–25% (Early)' },
              { value: '25-50' as const, label: '25–50%' },
              { value: '50-80' as const, label: '50–80%' },
              { value: '80-99' as const, label: '80–99% (Near Grad)' },
              { value: 'graduated' as const, label: '🎓 Graduated' },
            ]).map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                className={cn("cursor-pointer", filterOptions.bondingCurveRange === opt.value && "bg-accent text-accent-foreground")}
                onClick={() => onFilterOptionsChange?.({ ...filterOptions, bondingCurveRange: opt.value })}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex rounded-full border border-border/40 bg-black/40 backdrop-blur-md p-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full transition-all duration-300",
              viewMode === 'grid' ? "bg-accent/20 text-accent shadow-lg" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onViewModeChange('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full transition-all duration-300",
              viewMode === 'list' ? "bg-accent/20 text-accent shadow-lg" : "text-muted-foreground hover:text-foreground"
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
