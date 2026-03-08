import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { MemeToken } from '@/types/memeToken';
import { cn } from '@/lib/utils';

interface CreateAlertDialogProps {
  token: MemeToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAlert: (params: {
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    targetPrice: number;
    direction: 'above' | 'below';
    currentPrice: number;
  }) => Promise<any>;
}

const PRESET_PERCENTAGES = [5, 10, 25, 50, 100];

export function CreateAlertDialog({ token, open, onOpenChange, onCreateAlert }: CreateAlertDialogProps) {
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [creating, setCreating] = useState(false);

  if (!token) return null;

  const handlePreset = (pct: number) => {
    const multiplier = direction === 'above' ? 1 + pct / 100 : 1 - pct / 100;
    setTargetPrice((token.price * multiplier).toPrecision(4));
  };

  const handleCreate = async () => {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0 || !token.tokenAddress) return;

    setCreating(true);
    await onCreateAlert({
      tokenAddress: token.tokenAddress,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      targetPrice: price,
      direction,
      currentPrice: token.price,
    });
    setCreating(false);
    onOpenChange(false);
    setTargetPrice('');
  };

  const fmt = (v: number) => {
    if (v < 0.001 && v > 0) return v.toExponential(2);
    return v.toFixed(6);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-accent" />
            Set Price Alert
            <Badge variant="outline" className="text-xs font-mono">{token.symbol}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Current Price */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Current Price</p>
            <p className="text-lg font-bold font-mono text-foreground">${fmt(token.price)}</p>
          </div>

          {/* Direction Toggle */}
          <div className="flex gap-2">
            <Button
              variant={direction === 'above' ? 'default' : 'outline'}
              className={cn(
                "flex-1 gap-1.5",
                direction === 'above' && "bg-accent text-accent-foreground"
              )}
              onClick={() => { setDirection('above'); setTargetPrice(''); }}
            >
              <TrendingUp className="h-4 w-4" /> Price Goes Up
            </Button>
            <Button
              variant={direction === 'below' ? 'default' : 'outline'}
              className={cn(
                "flex-1 gap-1.5",
                direction === 'below' && "bg-destructive text-destructive-foreground"
              )}
              onClick={() => { setDirection('below'); setTargetPrice(''); }}
            >
              <TrendingDown className="h-4 w-4" /> Price Goes Down
            </Button>
          </div>

          {/* Preset Percentages */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Quick {direction === 'above' ? '↑' : '↓'} presets
            </p>
            <div className="flex gap-1.5">
              {PRESET_PERCENTAGES.map(pct => (
                <Button
                  key={pct}
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs h-8 font-mono border-border/50 hover:border-primary/50"
                  onClick={() => handlePreset(pct)}
                >
                  {direction === 'above' ? '+' : '-'}{pct}%
                </Button>
              ))}
            </div>
          </div>

          {/* Target Price Input */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Target price (USD)</p>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Enter target price..."
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="font-mono text-sm bg-muted/50 border-border/50"
            />
            {targetPrice && !isNaN(parseFloat(targetPrice)) && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {direction === 'above' ? '↑' : '↓'}{' '}
                {Math.abs(((parseFloat(targetPrice) - token.price) / token.price) * 100).toFixed(1)}% from current
              </p>
            )}
          </div>

          {/* Create Button */}
          <Button
            className="w-full gap-2"
            disabled={!targetPrice || isNaN(parseFloat(targetPrice)) || parseFloat(targetPrice) <= 0 || creating}
            onClick={handleCreate}
          >
            <Bell className="h-4 w-4" />
            {creating ? 'Creating...' : `Alert when ${direction} $${targetPrice || '...'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
