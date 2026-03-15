import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Shield, Lock, DollarSign, Coins } from "lucide-react";
import { WithdrawalHistory } from "./WithdrawalHistory";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";

const PLATFORM_WALLET = "ETz1CboRkEJZDZcstd6bjHtjhRsydHQNHPEYMuhcYK2Z";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface Budget {
  id: string;
  wallet_address: string;
  currency: string;
  budget_mode: string;
  deposit_amount: number;
  spent_amount: number;
  remaining_amount: number;
  spending_limit: number | null;
  escrow_amount: number;
  is_active: boolean;
}

export const BudgetManager = () => {
  const { toast } = useToast();
  const { publicKey, signTransaction, connected } = useWallet();
  const [currency, setCurrency] = useState<"SOL" | "USDC">("SOL");
  const [depositAmount, setDepositAmount] = useState("0.5");
  const [limitAmount, setLimitAmount] = useState("1.0");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const walletAddress = publicKey?.toBase58() || null;

  // Fetch existing budget
  const fetchBudget = useCallback(async () => {
    if (!walletAddress) return;
    setFetching(true);
    try {
      const { data } = await supabase
        .from("auto_trade_budgets")
        .select("*")
        .eq("wallet_address", walletAddress)
        .eq("currency", currency)
        .eq("is_active", true)
        .limit(1);

      setBudget((data && data.length > 0) ? data[0] as Budget : null);
    } catch (e) {
      console.error("Fetch budget error:", e);
    } finally {
      setFetching(false);
    }
  }, [walletAddress, currency]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  // Deposit SOL to platform wallet
  const handleDeposit = async () => {
    if (!publicKey || !signTransaction) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (currency === "SOL") {
        const connection = new Connection(RPC_URL);
        const lamports = Math.floor(amount * 1e9);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(PLATFORM_WALLET),
            lamports,
          })
        );

        transaction.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        const signed = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(txid);

        // Record in DB
        const newDeposit = (budget?.deposit_amount || 0) + amount;
        const newRemaining = (budget?.remaining_amount || 0) + amount;

        if (budget) {
          await supabase
            .from("auto_trade_budgets")
            .update({
              deposit_amount: newDeposit,
              remaining_amount: newRemaining,
              updated_at: new Date().toISOString(),
            })
            .eq("id", budget.id);
        } else {
          await supabase.from("auto_trade_budgets").insert({
            wallet_address: publicKey.toBase58(),
            currency,
            budget_mode: "deposit",
            deposit_amount: amount,
            remaining_amount: amount,
          });
        }

        toast({ title: `✅ Deposited ${amount} SOL`, description: `TX: ${txid.slice(0, 12)}...` });
      } else {
        // USDC: SPL token transfer — requires @solana/spl-token
        toast({ title: "USDC Deposit", description: "USDC deposit requires SPL token transfer. Coming soon for direct deposits — use Spending Limit mode instead.", variant: "destructive" });
        setLoading(false);
        return;
      }

      await fetchBudget();
    } catch (e: any) {
      toast({ title: "Deposit Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Set spending limit
  const handleSetLimit = async () => {
    if (!walletAddress) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    const limit = parseFloat(limitAmount);
    if (isNaN(limit) || limit <= 0) {
      toast({ title: "Invalid limit", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (budget) {
        await supabase
          .from("auto_trade_budgets")
          .update({
            spending_limit: limit,
            budget_mode: "limit",
            remaining_amount: limit,
            updated_at: new Date().toISOString(),
          })
          .eq("id", budget.id);
      } else {
        await supabase.from("auto_trade_budgets").insert({
          wallet_address: walletAddress,
          currency,
          budget_mode: "limit",
          spending_limit: limit,
          remaining_amount: limit,
        });
      }

      toast({ title: `✅ Spending Limit Set`, description: `Max ${limit} ${currency} per trade` });
      await fetchBudget();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Withdraw remaining deposit via edge function
  const handleWithdraw = async () => {
    if (!budget || budget.remaining_amount <= 0) {
      toast({ title: "Nothing to withdraw", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      toast({
        title: "⏳ Processing Withdrawal",
        description: `Sending ${budget.remaining_amount.toFixed(4)} ${currency} back to your wallet...`,
      });

      const { data, error } = await supabase.functions.invoke("withdraw", {
        body: {
          budget_id: budget.id,
          wallet_address: walletAddress,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Withdrawal Complete",
        description: `${data.amount.toFixed(4)} ${data.currency} sent. TX: ${data.tx_signature?.slice(0, 12)}...`,
      });

      setBudget(null);
    } catch (e: any) {
      toast({ title: "Withdrawal Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const spentPercent = budget
    ? budget.deposit_amount > 0
      ? (budget.spent_amount / budget.deposit_amount) * 100
      : budget.spending_limit
        ? (budget.spent_amount / budget.spending_limit) * 100
        : 0
    : 0;

  if (!connected) {
    return (
      <div className="p-3 rounded-lg bg-muted/10 border border-border text-center">
        <Wallet className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">Connect wallet to set up auto-trade budget</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Currency Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Currency:</Label>
        <div className="flex gap-1">
          <Button
            variant={currency === "SOL" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setCurrency("SOL")}
          >
            <Coins className="h-3 w-3 mr-1" />
            SOL
          </Button>
          <Button
            variant={currency === "USDC" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setCurrency("USDC")}
          >
            <DollarSign className="h-3 w-3 mr-1" />
            USDC
          </Button>
        </div>
      </div>

      {/* Budget Summary */}
      {budget && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">
              {budget.budget_mode === "deposit" ? "Deposited Budget" : "Spending Limit"}
            </span>
            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30">
              {budget.currency} • Active
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-foreground">
                {(budget.deposit_amount || budget.spending_limit || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Spent</p>
              <p className="text-sm font-bold text-destructive">{budget.spent_amount.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Remaining</p>
              <p className="text-sm font-bold text-accent">{budget.remaining_amount.toFixed(4)}</p>
            </div>
          </div>

          <Progress value={Math.min(spentPercent, 100)} className="h-2 mb-2" />
          <p className="text-[10px] text-muted-foreground text-center">{spentPercent.toFixed(1)}% used</p>

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px]"
              onClick={() => {
                // Top up = go to deposit tab
                toast({ title: "Use the Deposit tab below to top up" });
              }}
            >
              <ArrowDownToLine className="h-3 w-3 mr-1" />
              Top Up
            </Button>
            {budget.budget_mode === "deposit" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleWithdraw}
              >
                <ArrowUpFromLine className="h-3 w-3 mr-1" />
                Withdraw
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Budget Method Tabs */}
      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-muted/30 h-7">
          <TabsTrigger value="deposit" className="text-[10px] data-[state=active]:bg-primary/20">
            <ArrowDownToLine className="h-3 w-3 mr-1" />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="limit" className="text-[10px] data-[state=active]:bg-accent/20">
            <Shield className="h-3 w-3 mr-1" />
            Limit
          </TabsTrigger>
          <TabsTrigger value="escrow" className="text-[10px] data-[state=active]:bg-muted/40">
            <Lock className="h-3 w-3 mr-1" />
            Escrow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="mt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Send {currency} to the platform wallet. Bot trades from this deposited balance.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="bg-muted/30 border-border text-sm flex-1"
              min="0.01"
              step="0.1"
              placeholder={`Amount in ${currency}`}
            />
            <Button
              size="sm"
              className="h-10 px-4"
              onClick={handleDeposit}
              disabled={loading}
            >
              {loading ? "..." : "Deposit"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="limit" className="mt-2 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Set a max {currency} the bot can spend per trade. Funds stay in your wallet.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              className="bg-muted/30 border-border text-sm flex-1"
              min="0.01"
              step="0.1"
              placeholder={`Max per trade (${currency})`}
            />
            <Button
              size="sm"
              className="h-10 px-4"
              onClick={handleSetLimit}
              disabled={loading}
            >
              {loading ? "..." : "Set Limit"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="escrow" className="mt-2">
          <div className="p-4 rounded-lg bg-muted/10 border border-border text-center">
            <Lock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-xs font-medium text-foreground">Smart Contract Escrow</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Lock funds in an on-chain escrow program for maximum security. Requires custom Solana program deployment.
            </p>
            <Badge variant="outline" className="mt-2 text-[10px]">Coming Soon</Badge>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
