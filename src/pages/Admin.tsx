import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clipboard, RefreshCw, DollarSign, Wallet, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { DevTokenTracker } from "@/components/admin/DevTokenTracker";
import { NFTCollectionTracker } from "@/components/admin/NFTCollectionTracker";

interface PaymentRecord {
  id: string;
  wallet_address: string;
  tx_signature: string;
  sol_amount: number;
  created_at: string;
}

const ADMIN_WALLETS = [
  "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH",
  "BQefQgbpAqPjoGKLTmAA2haZh9pEURYNefPFwsTotgem"
];

const Admin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      toast.error("Failed to load payments");
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    const connectedWallet = localStorage.getItem('connectedWallet') || "";
    const isAdminWallet = ADMIN_WALLETS.includes(connectedWallet);
    if (!isAdminWallet) {
      toast.error("Admin access denied.");
      navigate('/dashboard');
      return;
    }
    setIsAdmin(true);
    setLoading(false);
    fetchPayments();
  }, [navigate]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Cross-reference: compute wallets appearing in both trackers
  const { devCrossRef, nftCrossRef } = useMemo(() => {
    const devWallets: string[] = [];
    const nftWallets: string[] = [];
    try {
      const devData = JSON.parse(localStorage.getItem("trackedDevs") || "[]");
      devWallets.push(...devData.map((d: any) => d.walletAddress));
    } catch {}
    try {
      const nftData = JSON.parse(localStorage.getItem("trackedNFTCollections") || "[]");
      for (const c of nftData) {
        nftWallets.push(c.address);
        if (c.devWallet) nftWallets.push(c.devWallet);
      }
    } catch {}
    // Dev wallets that also appear as NFT collection addresses or dev wallets
    const devCrossRef = devWallets.filter(w => nftWallets.includes(w));
    // NFT addresses/devWallets that also appear in dev tracker
    const nftCrossRef = [...new Set(nftWallets)].filter(w => devWallets.includes(w));
    return { devCrossRef, nftCrossRef };
  }, [isAdmin]); // re-compute when admin loads

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      <main className="container mx-auto pt-24 px-4">
        <div className="flex flex-col gap-8 animate-slide-up">
          <section className="text-center max-w-3xl mx-auto mb-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-destructive">Admin Dashboard</h1>
            <p className="text-lg text-muted-foreground">Track scam developers, fraudulent NFT collections, and platform payments</p>
          </section>

          <Tabs defaultValue="tokens" className="w-full max-w-5xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="tokens">Dev Token Tracker</TabsTrigger>
              <TabsTrigger value="collections">NFT Scam Tracker</TabsTrigger>
              <TabsTrigger value="payments">Access Payments</TabsTrigger>
            </TabsList>

            <TabsContent value="tokens">
              <DevTokenTracker crossRefWallets={devCrossRef} />
            </TabsContent>

            <TabsContent value="collections">
              <NFTCollectionTracker crossRefWallets={nftCrossRef} />
            </TabsContent>

            <TabsContent value="payments">
              <Card className="border-destructive/20 bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Access Fee Payments
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchPayments} disabled={paymentsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${paymentsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Wallet className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Payments</p>
                          <p className="text-2xl font-bold text-foreground">{payments.length}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-4 flex items-center gap-3">
                        <DollarSign className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Revenue</p>
                          <p className="text-2xl font-bold text-foreground">
                            {payments.reduce((sum, p) => sum + p.sol_amount, 0).toFixed(5)} SOL
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-4 flex items-center gap-3">
                        <Clock className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Latest Payment</p>
                          <p className="text-sm font-bold text-foreground">
                            {payments.length > 0 ? new Date(payments[0].created_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="border rounded-md overflow-x-auto border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-4 text-muted-foreground">Wallet Address</th>
                          <th className="text-left p-4 text-muted-foreground">Amount</th>
                          <th className="text-left p-4 text-muted-foreground">TX Signature</th>
                          <th className="text-left p-4 text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsLoading ? (
                          <tr><td colSpan={4} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
                        ) : payments.length === 0 ? (
                          <tr><td colSpan={4} className="text-center p-8 text-muted-foreground">No payments yet</td></tr>
                        ) : (
                          payments.map((payment) => (
                            <tr key={payment.id} className="border-t border-border hover:bg-muted/30">
                              <td className="p-4 font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[120px] md:max-w-[200px]">{payment.wallet_address}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(payment.wallet_address)}>
                                    <Clipboard className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-4"><Badge variant="secondary">{payment.sol_amount} SOL</Badge></td>
                              <td className="p-4 font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[80px] md:max-w-[150px]">{payment.tx_signature}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(payment.tx_signature)}>
                                    <Clipboard className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-4 text-muted-foreground">{new Date(payment.created_at).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
