import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, Trash2, TrendingUp, TrendingDown, Volume2 } from 'lucide-react';
import { usePriceAlerts, PriceAlert } from '@/hooks/usePriceAlerts';
import { cn } from '@/lib/utils';

interface PriceAlertsProps {
  walletAddress: string | null;
}

const fmt = (v: number) => {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  if (v < 0.001 && v > 0) return `$${v.toExponential(2)}`;
  return `$${v.toFixed(4)}`;
};

export function PriceAlerts({ walletAddress }: PriceAlertsProps) {
  const { activeAlerts, triggeredAlerts, loading, deleteAlert } = usePriceAlerts(walletAddress);

  if (!walletAddress) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-accent" />
            Price Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Connect your wallet to set price alerts
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-5 w-5 text-accent" />
            Price Alerts
            {activeAlerts.length > 0 && (
              <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                {activeAlerts.length} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Volume2 className="h-3 w-3" /> Sound on
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
          {activeAlerts.length === 0 && triggeredAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No alerts yet. Click the bell icon on any token to add one.
            </p>
          )}

          {activeAlerts.map(alert => (
            <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
          ))}

          {triggeredAlerts.length > 0 && (
            <>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider pt-2 pb-1">
                Triggered
              </div>
              {triggeredAlerts.slice(0, 5).map(alert => (
                <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} triggered />
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert, onDelete, triggered }: { alert: PriceAlert; onDelete: (id: string) => void; triggered?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg border p-2.5 transition-all",
      triggered
        ? "border-border/30 bg-muted/20 opacity-60"
        : "border-border/50 bg-muted/30 hover:bg-muted/50"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn(
          "p-1 rounded-md",
          alert.direction === 'above' ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
        )}>
          {alert.direction === 'above' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground truncate">
            {alert.token_symbol}
            <span className="text-muted-foreground font-normal ml-1">
              {alert.direction === 'above' ? '≥' : '≤'} {fmt(alert.target_price)}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Set at {fmt(alert.current_price_at_creation)}
            {triggered && alert.triggered_at && (
              <span className="ml-1 text-accent">
                • Triggered {new Date(alert.triggered_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(alert.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
