import React from 'react';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface TokenTableProps {
  tokens: MemeToken[];
  onTokenClick: (token: MemeToken) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}

const formatValue = (value: number, type: 'currency' | 'number' | 'percent' = 'currency'): string => {
  if (type === 'percent') {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  }
  if (type === 'number') {
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toLocaleString();
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const getAge = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const SortHeader = ({ 
  label, 
  field, 
  sortField, 
  sortDirection, 
  onSort,
  className 
}: { 
  label: string; 
  field: string; 
  sortField: string; 
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}) => (
  <th 
    className={cn(
      "px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors",
      className
    )}
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      )}
    </div>
  </th>
);

// Direction indicator based on real change data
const DirectionIndicator = ({ change }: { change: number }) => {
  const isPositive = change >= 0;
  const absChange = Math.abs(change);
  // Bar height scales with magnitude (capped at 100%)
  const barHeight = Math.min(absChange / 50, 1) * 30 + 5;
  
  return (
    <div className="flex items-end justify-center h-10 w-20 gap-[2px]">
      {[0.4, 0.7, 1, 0.8, 0.5].map((scale, i) => (
        <div
          key={i}
          className={cn(
            "w-2 rounded-sm transition-all",
            isPositive ? "bg-accent" : "bg-destructive"
          )}
          style={{ height: `${barHeight * scale}px` }}
        />
      ))}
    </div>
  );
};

// ATH Progress bar
const ATHBar = ({ current, ath }: { current: number; ath: number }) => {
  const progress = Math.min((current / ath) * 100, 100);
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-accent to-accent/80 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{formatValue(ath)}</span>
    </div>
  );
};

// Bonding Curve Progress indicator
const BondingCurveBar = ({ progress, status }: { progress?: number; status?: string }) => {
  const isGraduated = status === 'graduated' || progress === 100;
  
  if (isGraduated) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-accent">🎓 Graduated</span>
      </div>
    );
  }

  if (progress === undefined || progress === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const progressColor = clampedProgress >= 80
    ? 'from-accent to-accent/80'
    : clampedProgress >= 50
      ? 'from-yellow-500 to-yellow-500/80'
      : 'from-primary to-primary/80';

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Bonding</span>
        <span className="text-[10px] font-mono font-medium text-foreground">{clampedProgress.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all", progressColor)}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export function TokenTable({ tokens, onTokenClick, sortField, sortDirection, onSort }: TokenTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-border bg-card/50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-64">
              Coin
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Graph
            </th>
            <SortHeader label="MCAP" field="marketCap" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="Bonding" field="bondingCurveProgress" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="Age" field="timestamp" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="TXNs" field="holders" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="24H Vol" field="volume24h" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="Traders" field="holders" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="5M" field="change5m" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="1H" field="change1h" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tokens.map((token, index) => {
            const change5m = token.change5m ?? 0;
            const change1h = token.change1h ?? 0;
            const txns = token.holders || 0;
            
            return (
              <tr 
                key={token.id}
                className="hover:bg-muted/30 cursor-pointer transition-colors group"
                onClick={() => onTokenClick(token)}
              >
                <td className="px-3 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm font-medium w-6">
                      #{index + 1}
                    </span>
                    <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-border group-hover:ring-primary/50 transition-all">
                      <img
                        src={token.logoUrl}
                        alt={token.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{token.name}</div>
                      <div className="text-xs text-muted-foreground">{token.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <DirectionIndicator change={token.change24h} />
                </td>
                <td className="px-3 py-4">
                  <span className={cn(
                    "font-mono text-sm",
                    token.change24h >= 0 ? "positive-change" : "text-foreground"
                  )}>
                    {formatValue(token.marketCap)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <BondingCurveBar progress={token.bondingCurveProgress} status={token.status} />
                </td>
                <td className="px-3 py-4">
                  <span className="text-sm text-muted-foreground">
                    {getAge(token.timestamp)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className="text-sm text-muted-foreground font-mono">
                    {formatValue(txns, 'number')}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className="text-sm text-foreground font-mono">
                    {formatValue(token.volume24h)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className="text-sm text-muted-foreground font-mono">
                    {formatValue(token.holders, 'number')}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className={cn(
                    "text-sm font-medium",
                    change5m >= 0 ? "positive-change" : "negative-change"
                  )}>
                    {formatValue(change5m, 'percent')}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className={cn(
                    "text-sm font-medium",
                    change1h >= 0 ? "positive-change" : "negative-change"
                  )}>
                    {formatValue(change1h, 'percent')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
