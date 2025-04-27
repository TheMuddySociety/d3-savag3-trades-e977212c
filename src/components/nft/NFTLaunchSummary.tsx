
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ChevronLeft, Rocket, Check, AlertTriangle, ShieldCheck, Terminal, Code, GitBranch } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { NFTService } from "@/services/nft";
import { NFTAsset, NFTCollection } from '@/types/nft';

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
  const [assets, setAssets] = useState<NFTAsset[]>([]);
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
      // Calculate cost based on Metaplex Core operations
      // Storage cost + mint cost + collection creation cost
      const baseFee = 0.1;  // Collection creation and storage
      const perNftFee = 0.01; // Per-NFT minting fee
      const storageFee = 0.005 * assets.length; // Arweave storage (estimate)
      const total = baseFee + (assets.length * perNftFee) + storageFee;
      setEstimatedCost(Number(total.toFixed(3)));
    }
  }, [assets]);
  
  const handleLaunch = async () => {
    if (!publicKey) {
      toast.error("Wallet not connected", { 
        description: "Please connect your wallet to launch NFTs" 
      });
      return;
    }
    
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
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Terminal className="h-5 w-5 text-red-500" />
          Sugar Launch Summary
        </h2>
        <p className="text-gray-400 mb-4">
          Review your NFT collection details before launching with our Sugar CLI alternative
        </p>
      </div>
      
      {/* Sugar CLI comparison */}
      <Card className="border-gray-800 bg-gray-900/30">
        <CardContent className="p-4">
          <h3 className="font-semibold text-white mb-2 flex items-center">
            <Code className="h-4 w-4 text-red-500 mr-2" />
            Equivalent Sugar Commands
          </h3>
          <div className="space-y-2 font-mono text-xs text-gray-400">
            <div className="p-2 bg-gray-950 rounded">
              <span className="text-gray-500">$ </span>
              sugar create-config
            </div>
            <div className="p-2 bg-gray-950 rounded">
              <span className="text-gray-500">$ </span>
              sugar upload
            </div>
            <div className="p-2 bg-gray-950 rounded">
              <span className="text-gray-500">$ </span>
              sugar deploy
            </div>
            <div className="p-2 bg-gray-950 rounded">
              <span className="text-gray-500">$ </span>
              sugar mint
            </div>
            <div className="p-2 bg-gray-950 rounded">
              <span className="text-gray-500">$ </span>
              sugar verify
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            This web interface performs the same steps as the Sugar CLI commands shown above.
          </p>
        </CardContent>
      </Card>
      
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
                <span className="text-gray-400">Standard</span>
                <span className="text-white font-medium">
                  Metaplex Core
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
              {estimatedCost.toFixed(3)} SOL
            </Badge>
          </div>
          <p className="text-sm text-gray-400">
            This includes network fees, storage costs, and Metaplex Core operations
          </p>
        </CardContent>
      </Card>
      
      {/* Sugar CLI feature comparison */}
      <Card className="border-gray-800 bg-black/30">
        <CardContent className="p-4">
          <h3 className="font-semibold text-white mb-2 flex items-center">
            <GitBranch className="h-4 w-4 text-red-500 mr-2" />
            Sugar Web Launchpad Features
          </h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              <span>Visual interface for all Sugar CLI steps</span>
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              <span>Metaplex Core standard with on-chain metadata</span>
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              <span>Browser-based alternative to command line</span>
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 text-green-500 mr-2" />
              <span>Collection verification for authenticity</span>
            </div>
          </div>
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
          <div className="flex items-center text-green-500">
            <Check className="h-5 w-5 mr-2" />
            <span>Metaplex Core integration ready</span>
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
          disabled={isLoading || !publicKey}
          className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
        >
          {isLoading ? (
            <>Processing...</>
          ) : (
            <>
              Launch with Sugar Web <Terminal className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      
      {/* Security disclaimer */}
      <div className="mt-4 px-4 py-3 border border-gray-800 rounded-lg bg-blue-950/20">
        <div className="flex items-start">
          <ShieldCheck className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
          <p className="text-sm text-gray-400">
            This web interface provides the same functionality as Metaplex Sugar CLI but in a user-friendly browser experience.
            Your NFTs will be launched on the Solana blockchain using Metaplex Core standards.
          </p>
        </div>
      </div>
    </div>
  );
};
