
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ChevronLeft, Rocket, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';

interface NFTLaunchSummaryProps {
  onLaunch: () => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export const NFTLaunchSummary: React.FC<NFTLaunchSummaryProps> = ({ 
  onLaunch, 
  onBack,
  isLoading
}) => {
  const { publicKey } = useWallet();
  const [assets, setAssets] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  
  // Load data from localStorage
  useEffect(() => {
    try {
      const savedAssets = localStorage.getItem('nftAssets');
      const savedMetadata = localStorage.getItem('nftMetadata');
      
      if (savedAssets) {
        setAssets(JSON.parse(savedAssets));
      }
      
      if (savedMetadata) {
        setMetadata(JSON.parse(savedMetadata));
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
      toast.error("Error loading data", {
        description: "Could not load your NFT configuration"
      });
    }
  }, []);
  
  // Calculate estimated cost
  useEffect(() => {
    if (assets.length > 0) {
      // Estimate cost at 0.01 SOL per NFT plus 0.1 SOL base fee
      const baseFee = 0.1;
      const perNftFee = 0.01;
      const total = baseFee + (assets.length * perNftFee);
      setEstimatedCost(total);
    }
  }, [assets]);
  
  const handleLaunch = async () => {
    // Extra validation could be done here
    try {
      await onLaunch();
    } catch (error) {
      console.error('Launch error:', error);
    }
  };

  // Format wallet address for display
  const formatAddress = (address?: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Launch Summary</h2>
        <p className="text-gray-400 mb-4">
          Review your NFT collection details before launching
        </p>
      </div>
      
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-gray-800 bg-black/30">
          <CardContent className="p-4">
            <h3 className="font-semibold text-white mb-2">Collection Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white font-medium">{metadata?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Symbol</span>
                <span className="text-white font-medium">{metadata?.symbol || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Royalty</span>
                <span className="text-white font-medium">{metadata?.royaltyPercentage || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Creator</span>
                <span className="text-white font-medium">
                  {formatAddress(publicKey?.toString())}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-800 bg-black/30">
          <CardContent className="p-4">
            <h3 className="font-semibold text-white mb-2">Assets</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Total NFTs</span>
                <Badge variant="success" className="text-white">
                  {assets.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Metadata</span>
                <span className="text-white font-medium">
                  {metadata?.useSameMetadataForAll ? 'Shared' : 'Individual'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Attributes</span>
                <span className="text-white font-medium">
                  {metadata?.attributes?.length || 0} traits
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Cost estimate */}
      <Card className="border-gray-800 bg-black/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white">Estimated Cost</h3>
            <Badge variant="warning" className="bg-yellow-500/20 text-yellow-500">
              {estimatedCost.toFixed(2)} SOL
            </Badge>
          </div>
          <p className="text-sm text-gray-400">
            This includes network fees and storage costs on Solana
          </p>
        </CardContent>
      </Card>
      
      {/* Checklist */}
      <div className="space-y-3">
        <h3 className="font-semibold text-white">Pre-Launch Checklist</h3>
        <div className="space-y-2">
          <div className="flex items-center text-green-500">
            <Check className="h-5 w-5 mr-2" />
            <span>Wallet connected: {formatAddress(publicKey?.toString())}</span>
          </div>
          <div className="flex items-center text-green-500">
            <Check className="h-5 w-5 mr-2" />
            <span>{assets.length} NFT images uploaded</span>
          </div>
          <div className="flex items-center text-green-500">
            <Check className="h-5 w-5 mr-2" />
            <span>Metadata and attributes configured</span>
          </div>
          <div className="flex items-start text-yellow-500">
            <AlertTriangle className="h-5 w-5 mr-2 mt-0.5" />
            <span className="flex-1">
              Once launched, some details cannot be changed. Please review carefully.
            </span>
          </div>
        </div>
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onBack}
          className="border-gray-700"
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <Button 
          onClick={handleLaunch} 
          disabled={isLoading}
          className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
        >
          {isLoading ? (
            <>Processing...</>
          ) : (
            <>
              Launch NFT Collection <Rocket className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      
      {/* Security disclaimer */}
      <div className="mt-4 px-4 py-3 border border-gray-800 rounded-lg bg-blue-950/20">
        <div className="flex items-start">
          <ShieldCheck className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
          <p className="text-sm text-gray-400">
            Your NFTs will be launched on the Solana blockchain and cannot be deleted once minted. 
            Metadata will be stored on-chain and via Arweave for permanent decentralized storage.
          </p>
        </div>
      </div>
    </div>
  );
};
