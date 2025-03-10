
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clipboard, Save, Plus, Trash } from "lucide-react";

// Admin wallet addresses
const ADMIN_WALLETS = [
  "Hn1NxCYHwbhVyFbPmxnjdKVYR5BnhyKCvHvAFPBrBkn9",
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
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="collections">NFT Collections</TabsTrigger>
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
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
