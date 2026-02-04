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

// Mini sparkline chart component
const MiniChart = ({ positive }: { positive: boolean }) => {
  const points = React.useMemo(() => {
    const pts = [];
    let y = 20;
    for (let i = 0; i < 20; i++) {
      y += (Math.random() - 0.5) * 8;
      y = Math.max(5, Math.min(35, y));
      pts.push(`${i * 5},${positive ? 40 - y : y}`);
    }
    return pts.join(' ');
  }, [positive]);

  return (
    <svg width="80" height="40" className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
      />
    </svg>
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
            <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              ATH
            </th>
            <SortHeader label="Age" field="timestamp" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="TXNs" field="holders" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="24H Vol" field="volume24h" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="Traders" field="holders" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="5M" field="change24h" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            <SortHeader label="1H" field="change24h" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tokens.map((token, index) => {
            const change5m = (Math.random() - 0.5) * 50;
            const change1h = token.change24h * 0.3;
            const txns = Math.floor(token.holders * 0.8);
            const ath = token.marketCap * (1 + Math.random() * 0.5);
            
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
                  <MiniChart positive={token.change24h >= 0} />
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
                  <ATHBar current={token.marketCap} ath={ath} />
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
