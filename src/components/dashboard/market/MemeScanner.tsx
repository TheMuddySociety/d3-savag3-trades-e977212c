import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Search, Check, X, AlertTriangle, Shield, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

interface ShieldResult {
  name: string;
  symbol: string;
  safe: boolean;
  holders: number;
  liquidity: number;
  pairAge: string;
  flags: {
    freezeAuthority: boolean;
    mintAuthority: boolean;
    lowLiquidity: boolean;
    lowHolders: boolean;
    warnings: string[];
  };
}

export function MemeScanner() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ShieldResult | null>(null);
  const { toast } = useToast();

  const handleScan = async () => {
    const addr = tokenAddress.trim();
    if (!addr) {
      toast({ title: "Error", description: "Please enter a token address", variant: "destructive" });
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('token-prices', {
        body: { action: 'shield_check', address: addr },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Shield check failed');

      const result = data.data as ShieldResult;
      setScanResult(result);

      toast({
        title: result.safe ? "Token Looks Safe" : "Potential Risks Detected",
        description: result.safe
          ? "No major risk flags found on-chain"
          : "Be careful! This token has potential risks",
        variant: result.safe ? "default" : "destructive",
      });
    } catch (err) {
      console.error('Shield check error:', err);
      toast({
        title: "Scan Failed",
        description: "Could not analyze this token. Check the address and try again.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const formatLiquidity = (v: number) => {
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  const getAge = (pairAge: string) => {
    if (!pairAge) return 'Unknown';
    const created = new Date(pairAge);
    const diffMs = Date.now() - created.getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days > 30) return `${Math.floor(days / 30)} months`;
    if (days > 0) return `${days} days`;
    const hours = Math.floor(diffMs / 3600000);
    return `${hours} hours`;
  };

  return (
    <Card className="memecoin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Shield className="h-5 w-5 text-solana" />
          Meme Scanner
        </CardTitle>
        <CardDescription>
          On-chain safety analysis powered by Jupiter Shield
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Enter Solana token address..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="bg-background/50 font-mono text-xs"
          />
          <Button
            onClick={handleScan}
            disabled={isScanning}
            className="bg-solana hover:bg-solana-dark text-primary-foreground"
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
          </Button>
        </div>

        {scanResult && (
          <div className="mt-4 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{scanResult.name || 'Unknown Token'}</h3>
                <p className="text-sm text-muted-foreground">{scanResult.symbol || '—'}</p>
              </div>
              <Badge
                variant={scanResult.safe ? "default" : "destructive"}
                className={`${scanResult.safe ? 'bg-green-500 hover:bg-green-600' : ''} flex items-center gap-1`}
              >
                {scanResult.safe ? (
                  <><Check className="h-3 w-3" /> Safe</>
                ) : (
                  <><AlertTriangle className="h-3 w-3" /> Risky</>
                )}
              </Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Token Age</p>
                <p className="font-medium">{getAge(scanResult.pairAge)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Holders</p>
                <p className="font-medium">{scanResult.holders > 0 ? scanResult.holders.toLocaleString() : 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Liquidity</p>
                <p className="font-medium">{formatLiquidity(scanResult.liquidity)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Explorer</p>
                <a
                  href={`https://solscan.io/token/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-solana flex items-center gap-1 hover:underline"
                >
                  View <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-2">Risk Flags</h4>
              <div className="flex flex-wrap gap-2">
                {scanResult.flags.freezeAuthority && (
                  <Badge variant="outline" className="border-red-500 text-red-500">
                    <X className="h-3 w-3 mr-1" /> Freeze Authority
                  </Badge>
                )}
                {scanResult.flags.mintAuthority && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Mint Authority
                  </Badge>
                )}
                {scanResult.flags.lowLiquidity && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Low Liquidity
                  </Badge>
                )}
                {scanResult.flags.lowHolders && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Few Holders
                  </Badge>
                )}
                {scanResult.flags.warnings?.map((w, i) => (
                  <Badge key={i} variant="outline" className="border-red-500 text-red-500">
                    <X className="h-3 w-3 mr-1" /> {w}
                  </Badge>
                ))}
                {!scanResult.flags.freezeAuthority && !scanResult.flags.mintAuthority &&
                  !scanResult.flags.lowLiquidity && !scanResult.flags.lowHolders &&
                  (!scanResult.flags.warnings || scanResult.flags.warnings.length === 0) && (
                  <Badge variant="outline" className="border-green-500 text-green-500">
                    <Check className="h-3 w-3 mr-1" /> No Major Flags
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-center text-muted-foreground">
        Real on-chain analysis. Always DYOR before investing.
      </CardFooter>
    </Card>
  );
}
