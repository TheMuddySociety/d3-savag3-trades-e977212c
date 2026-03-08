import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const BotAccess = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  const PAYMENT_AMOUNT = 0.04141; // SOL
  const PAYMENT_DESTINATION = "11111111111111111111111111111112"; // System program (placeholder)

  const handlePayment = async () => {
    if (!publicKey || !connected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PAYMENT_DESTINATION),
          lamports: PAYMENT_AMOUNT * LAMPORTS_PER_SOL,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      setHasAccess(true);
      toast({
        title: "Payment successful!",
        description: "You now have access to bot trading tools",
      });
    } catch (error) {
      console.error("Payment failed:", error);
      toast({
        title: "Payment failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle>Bot Trading Access</CardTitle>
          {hasAccess && (
            <Badge variant="default" className="ml-auto">
              <Unlock className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Access advanced trading bots and automated strategies
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!connected ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Connect wallet to access bot features</span>
            </div>
            <WalletMultiButton className="!bg-primary hover:!bg-primary/90" />
          </div>
        ) : !hasAccess ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium mb-2">Premium Bot Features Include:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Automated trading strategies</li>
                <li>• Real-time market analysis</li>
                <li>• Risk management tools</li>
                <li>• Portfolio optimization</li>
              </ul>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <div>
                <span className="font-medium">One-time access fee</span>
                <p className="text-sm text-muted-foreground">Lifetime access to all bot features</p>
              </div>
              <Badge variant="secondary" className="font-mono">
                {PAYMENT_AMOUNT} SOL
              </Badge>
            </div>

            <Button 
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Unlock Bot Access
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Unlock className="h-4 w-4" />
              <span className="font-medium">Bot trading tools activated!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              You now have access to all premium trading features
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};