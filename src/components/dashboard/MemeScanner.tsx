
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Search, Check, X, AlertTriangle, Shield, ArrowUpRight } from "lucide-react";

export function MemeScanner() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<null | {
    safe: boolean;
    name: string;
    symbol: string;
    age: string;
    holders: number;
    liquidity: string;
    flags: {
      honeypot: boolean;
      rugpull: boolean;
      mintable: boolean;
      proxy: boolean;
      hasBlacklist: boolean;
      hasTaxes: boolean;
    }
  }>(null);
  const { toast } = useToast();

  const handleScan = () => {
    if (!tokenAddress.trim()) {
      toast({
        title: "Error",
        description: "Please enter a token address",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    // Simulate API call with a delay
    setTimeout(() => {
      // This is mock data - in a real app, you would call an API
      const isSafe = Math.random() > 0.3;
      
      setScanResult({
        safe: isSafe,
        name: isSafe ? "Dogecoin" : "ScamToken",
        symbol: isSafe ? "DOGE" : "SCAM",
        age: isSafe ? "3 months" : "2 days",
        holders: isSafe ? 12500 : 23,
        liquidity: isSafe ? "$2.4M" : "$12K",
        flags: {
          honeypot: !isSafe && Math.random() > 0.5,
          rugpull: !isSafe && Math.random() > 0.5,
          mintable: Math.random() > 0.7,
          proxy: Math.random() > 0.8,
          hasBlacklist: !isSafe && Math.random() > 0.6,
          hasTaxes: Math.random() > 0.5,
        }
      });
      
      setIsScanning(false);
      
      toast({
        title: isSafe ? "Token Looks Safe" : "Potential Risks Detected",
        description: isSafe 
          ? "This token passes basic safety checks"
          : "Be careful! This token has potential risks",
        variant: isSafe ? "default" : "destructive",
      });
    }, 2000);
  };

  return (
    <Card className="memecoin-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Shield className="h-5 w-5 text-solana" />
          Meme Scanner
        </CardTitle>
        <CardDescription>
          Check token contracts for potential scams and risks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Enter token address (0x...)"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="bg-background/50"
          />
          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            className="bg-solana hover:bg-solana-dark text-primary-foreground"
          >
            {isScanning ? "Scanning..." : "Scan"}
          </Button>
        </div>
        
        {scanResult && (
          <div className="mt-4 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{scanResult.name}</h3>
                <p className="text-sm text-muted-foreground">{scanResult.symbol}</p>
              </div>
              <Badge 
                variant={scanResult.safe ? "default" : "destructive"}
                className={`${scanResult.safe ? 'bg-green-500 hover:bg-green-600' : ''} flex items-center gap-1`}
              >
                {scanResult.safe ? (
                  <>
                    <Check className="h-3 w-3" /> Safe
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Risky
                  </>
                )}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Token Age</p>
                <p className="font-medium">{scanResult.age}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Holders</p>
                <p className="font-medium">{scanResult.holders.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Liquidity</p>
                <p className="font-medium">{scanResult.liquidity}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Explorer</p>
                <a href="#" className="font-medium text-solana flex items-center gap-1 hover:underline">
                  View <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="text-sm font-medium mb-2">Risk Flags</h4>
              <div className="flex flex-wrap gap-2">
                {scanResult.flags.honeypot && (
                  <Badge variant="outline" className="border-red-500 text-red-500">
                    <X className="h-3 w-3 mr-1" /> Honeypot Risk
                  </Badge>
                )}
                {scanResult.flags.rugpull && (
                  <Badge variant="outline" className="border-red-500 text-red-500">
                    <X className="h-3 w-3 mr-1" /> Rugpull Risk
                  </Badge>
                )}
                {scanResult.flags.mintable && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Mintable
                  </Badge>
                )}
                {scanResult.flags.proxy && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Proxy Contract
                  </Badge>
                )}
                {scanResult.flags.hasBlacklist && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Has Blacklist
                  </Badge>
                )}
                {scanResult.flags.hasTaxes && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Has Taxes
                  </Badge>
                )}
                {!Object.values(scanResult.flags).some(flag => flag) && (
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
        Always do your own research before investing. This tool provides basic analysis only.
      </CardFooter>
    </Card>
  );
}
