
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

// Admin wallet addresses
const ADMIN_WALLETS = [
  "Cra8LAvpQAk3hx4By5STHp4xrq7HSAnZLk4Jwzv1wUAH"
];

const Admin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Token Management State
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokens, setTokens] = useState<{address: string, symbol: string}[]>([]);
  
  // NFT Collection Management State
  const [collectionAddress, setCollectionAddress] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [collections, setCollections] = useState<{address: string, name: string}[]>([]);

  // Payments State
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
    // Check if the user is an admin
    const checkAdminAccess = () => {
      // In production, this would verify the connected wallet matches the admin wallet
      // For demo purposes, we'll simulate this check
      const connectedWallet = localStorage.getItem('connectedWallet') || "";
      const isAdminWallet = ADMIN_WALLETS.includes(connectedWallet);
      
      if (!isAdminWallet) {
        toast.error("Admin access denied. You don't have permission to view this page.");
        navigate('/dashboard');
        return;
      }
      
      // Load saved tokens and collections from localStorage
      const savedTokens = localStorage.getItem('adminTokens');
      if (savedTokens) {
        setTokens(JSON.parse(savedTokens));
      }
      
      const savedCollections = localStorage.getItem('adminCollections');
      if (savedCollections) {
        setCollections(JSON.parse(savedCollections));
      }
      
      setIsAdmin(true);
      setLoading(false);
      fetchPayments();
    };
    
    checkAdminAccess();
  }, [navigate]);

  const handleAddToken = () => {
    if (!tokenAddress || !tokenSymbol) {
      toast.error("Please enter both token address and symbol");
      return;
    }
    
    const newToken = { address: tokenAddress, symbol: tokenSymbol };
    const updatedTokens = [...tokens, newToken];
    
    setTokens(updatedTokens);
    localStorage.setItem('adminTokens', JSON.stringify(updatedTokens));
    
    // Reset form
    setTokenAddress("");
    setTokenSymbol("");
    
    toast.success(`Token ${tokenSymbol} added successfully`);
  };

  const handleRemoveToken = (index: number) => {
    const updatedTokens = tokens.filter((_, i) => i !== index);
    setTokens(updatedTokens);
    localStorage.setItem('adminTokens', JSON.stringify(updatedTokens));
    toast.success("Token removed successfully");
  };

  const handleAddCollection = () => {
    if (!collectionAddress || !collectionName) {
      toast.error("Please enter both collection address and name");
      return;
    }
    
    const newCollection = { address: collectionAddress, name: collectionName };
    const updatedCollections = [...collections, newCollection];
    
    setCollections(updatedCollections);
    localStorage.setItem('adminCollections', JSON.stringify(updatedCollections));
    
    // Reset form
    setCollectionAddress("");
    setCollectionName("");
    
    toast.success(`Collection ${collectionName} added successfully`);
  };

  const handleRemoveCollection = (index: number) => {
    const updatedCollections = collections.filter((_, i) => i !== index);
    setCollections(updatedCollections);
    localStorage.setItem('adminCollections', JSON.stringify(updatedCollections));
    toast.success("Collection removed successfully");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <Header />
      
      <main className="container mx-auto pt-24 px-4">
        <div className="flex flex-col gap-8 animate-slide-up">
          <section className="text-center max-w-3xl mx-auto mb-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-red-600">
              Admin Dashboard
            </h1>
            <p className="text-lg text-gray-400">
              Manage tokens and NFT collections for the SAVAG3 D3 Tradez platform
            </p>
          </section>
          
          <Tabs defaultValue="tokens" className="w-full max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="collections">NFT Collections</TabsTrigger>
              <TabsTrigger value="payments">Access Payments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tokens">
              <Card className="border-red-900/20 glass-card">
                <CardHeader>
                  <CardTitle className="text-xl">Token Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label className="text-sm text-gray-400 mb-2 block">Token Address</label>
                        <Input 
                          placeholder="Enter Solana token address" 
                          value={tokenAddress}
                          onChange={(e) => setTokenAddress(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm text-gray-400 mb-2 block">Token Symbol</label>
                        <Input 
                          placeholder="Enter token symbol" 
                          value={tokenSymbol}
                          onChange={(e) => setTokenSymbol(e.target.value)}
                        />
                      </div>
                      <div className="self-end">
                        <Button onClick={handleAddToken} className="bg-red-600 hover:bg-red-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Token
                        </Button>
                      </div>
                    </div>
                    
                    <div className="border rounded-md overflow-hidden border-red-900/20">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-black/50">
                            <th className="text-left p-4 text-gray-400">Token Symbol</th>
                            <th className="text-left p-4 text-gray-400">Token Address</th>
                            <th className="text-center p-4 text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokens.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center p-8 text-gray-500">
                                No tokens added yet
                              </td>
                            </tr>
                          ) : (
                            tokens.map((token, index) => (
                              <tr key={index} className="border-t border-red-900/10">
                                <td className="p-4">{token.symbol}</td>
                                <td className="p-4 font-mono text-sm truncate max-w-[200px]">
                                  {token.address}
                                </td>
                                <td className="p-4 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(token.address)}
                                    className="mr-2 h-8 w-8 p-0"
                                  >
                                    <Clipboard className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveToken(index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="collections">
              <Card className="border-red-900/20 glass-card">
                <CardHeader>
                  <CardTitle className="text-xl">NFT Collection Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label className="text-sm text-gray-400 mb-2 block">Collection Address</label>
                        <Input 
                          placeholder="Enter NFT collection address" 
                          value={collectionAddress}
                          onChange={(e) => setCollectionAddress(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm text-gray-400 mb-2 block">Collection Name</label>
                        <Input 
                          placeholder="Enter collection name" 
                          value={collectionName}
                          onChange={(e) => setCollectionName(e.target.value)}
                        />
                      </div>
                      <div className="self-end">
                        <Button onClick={handleAddCollection} className="bg-red-600 hover:bg-red-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Collection
                        </Button>
                      </div>
                    </div>
                    
                    <div className="border rounded-md overflow-hidden border-red-900/20">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-black/50">
                            <th className="text-left p-4 text-gray-400">Collection Name</th>
                            <th className="text-left p-4 text-gray-400">Collection Address</th>
                            <th className="text-center p-4 text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {collections.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center p-8 text-gray-500">
                                No collections added yet
                              </td>
                            </tr>
                          ) : (
                            collections.map((collection, index) => (
                              <tr key={index} className="border-t border-red-900/10">
                                <td className="p-4">{collection.name}</td>
                                <td className="p-4 font-mono text-sm truncate max-w-[200px]">
                                  {collection.address}
                                </td>
                                <td className="p-4 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(collection.address)}
                                    className="mr-2 h-8 w-8 p-0"
                                  >
                                    <Clipboard className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveCollection(index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card className="border-destructive/20 glass-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Access Fee Payments
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPayments}
                    disabled={paymentsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${paymentsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Summary Stats */}
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
                            {payments.length > 0
                              ? new Date(payments[0].created_at).toLocaleDateString()
                              : 'N/A'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Payments Table */}
                  <div className="border rounded-md overflow-hidden border-border">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-4 text-muted-foreground text-sm">Wallet Address</th>
                          <th className="text-left p-4 text-muted-foreground text-sm">Amount</th>
                          <th className="text-left p-4 text-muted-foreground text-sm">TX Signature</th>
                          <th className="text-left p-4 text-muted-foreground text-sm">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsLoading ? (
                          <tr>
                            <td colSpan={4} className="text-center p-8 text-muted-foreground">
                              Loading payments...
                            </td>
                          </tr>
                        ) : payments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center p-8 text-muted-foreground">
                              No payments recorded yet
                            </td>
                          </tr>
                        ) : (
                          payments.map((payment) => (
                            <tr key={payment.id} className="border-t border-border hover:bg-muted/30">
                              <td className="p-4 font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[120px] md:max-w-[200px]">
                                    {payment.wallet_address}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(payment.wallet_address)}
                                  >
                                    <Clipboard className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant="secondary">{payment.sol_amount} SOL</Badge>
                              </td>
                              <td className="p-4 font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[80px] md:max-w-[150px]">
                                    {payment.tx_signature}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(payment.tx_signature)}
                                  >
                                    <Clipboard className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {new Date(payment.created_at).toLocaleString()}
                              </td>
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
