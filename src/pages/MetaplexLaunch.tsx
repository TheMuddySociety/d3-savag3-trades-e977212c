
import React, { useState } from 'react';
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Image, CheckCircle2, AlertCircle, Info, Rocket, Terminal, Code, GitMerge, PackageCheck } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { NFTUploader } from "@/components/nft/NFTUploader";
import { NFTMetadataForm } from "@/components/nft/NFTMetadataForm";
import { NFTLaunchSummary } from "@/components/nft/NFTLaunchSummary";
import { NFTService } from "@/services/nft";
import { NFTMintResult } from "@/types/nft";

/**
 * MetaplexLaunch - Front-end alternative to Metaplex Sugar CLI
 * Provides a web UI for:
 * - Uploading assets (like "sugar upload")
 * - Setting metadata (like "sugar create-config")
 * - Launching collection (like "sugar deploy" + "sugar mint" + "sugar verify")
 */
const MetaplexLaunch = () => {
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [launchProgress, setLaunchProgress] = useState<string[]>([]);
  const [launchStage, setLaunchStage] = useState<string>("");

  React.useEffect(() => {
    if (!connected) {
      toast.error("Wallet not connected", {
        description: "Please connect your wallet to launch NFTs",
      });
      navigate('/');
    }
  }, [connected, navigate]);

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLaunch = async () => {
    if (!publicKey) {
      toast.error("Wallet not connected", {
        description: "Please connect your wallet to launch NFTs",
      });
      return;
    }
    
    setIsLoading(true);
    setLaunchProgress([]);
    
    try {
      // Show Sugar-like console output
      addProgressLog("🔧 Initializing launch process (Sugar alternative)");
      setLaunchStage("initializing");
      
      // Load configuration
      addProgressLog("📝 Loading configuration...");
      
      // Image and metadata upload stage
      setLaunchStage("uploading");
      addProgressLog("🖼️ Uploading images to decentralized storage...");
      
      // Collection creation stage
      await new Promise(resolve => setTimeout(resolve, 800));
      setLaunchStage("creating");
      addProgressLog("🏗️ Creating collection structure...");
      
      // Minting stage
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLaunchStage("minting");
      addProgressLog("🔨 Minting NFTs to wallet...");
      
      // Launch collection using the NFT Service
      const result = await NFTService.launchCollection();
      
      // Verification stage
      setLaunchStage("verifying");
      addProgressLog("✅ Verifying collection membership...");
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Success stage
      setLaunchStage("complete");
      addProgressLog(`✨ Success! Collection ${result.collectionMint} created with ${result.nftMints.length} NFTs`);
      
      // Save mint address to localStorage and state
      if (result.collectionMint) {
        localStorage.setItem('lastCollectionMint', result.collectionMint);
        setTxSignature(result.collectionMint);
      }
    } catch (error) {
      console.error("Error launching NFT collection:", error);
      setLaunchStage("error");
      addProgressLog("❌ Error: Failed to launch collection");
      
      toast.error("Failed to launch NFT collection", {
        description: "An error occurred while launching your collection",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const addProgressLog = (message: string) => {
    setLaunchProgress(prev => [...prev, message]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-gray-900">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-20 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Terminal className="h-6 w-6 text-red-500" />
              <h1 className="text-3xl font-bold text-white">Sugar Web Launchpad</h1>
            </div>
            <p className="text-gray-400">Create and launch your NFT collection on Solana - browser alternative to Metaplex Sugar CLI</p>
          </div>

          <div className="mb-8">
            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-red-600 to-red-400 h-full rounded-full transition-all duration-300" 
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <div className={`flex flex-col items-center ${currentStep >= 1 ? 'text-red-500' : ''}`}>
                <Badge variant={currentStep >= 1 ? "success" : "outline"}>1</Badge>
                <span>Upload Assets</span>
              </div>
              <div className={`flex flex-col items-center ${currentStep >= 2 ? 'text-red-500' : ''}`}>
                <Badge variant={currentStep >= 2 ? "success" : "outline"}>2</Badge>
                <span>Metadata</span>
              </div>
              <div className={`flex flex-col items-center ${currentStep >= 3 ? 'text-red-500' : ''}`}>
                <Badge variant={currentStep >= 3 ? "success" : "outline"}>3</Badge>
                <span>Launch</span>
              </div>
            </div>
          </div>

          <Card className="border-gray-800 bg-black/50 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              {currentStep === 1 && <NFTUploader onComplete={nextStep} />}
              {currentStep === 2 && <NFTMetadataForm onComplete={nextStep} onBack={prevStep} />}
              {currentStep === 3 && (
                <NFTLaunchSummary onLaunch={handleLaunch} onBack={prevStep} isLoading={isLoading} />
              )}
            </CardContent>
          </Card>
          
          {/* Launch progress terminal (similar to Sugar CLI output) */}
          {currentStep === 3 && launchProgress.length > 0 && (
            <Card className="border-gray-800 bg-black/50 backdrop-blur-sm shadow-lg mt-6 overflow-hidden">
              <CardHeader className="py-3 px-4 bg-gray-900 border-b border-gray-800">
                <CardTitle className="text-sm font-mono flex items-center">
                  <Code className="h-4 w-4 mr-2 text-red-500" />
                  Sugar Launch Terminal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-gray-950 font-mono text-sm p-4 max-h-60 overflow-y-auto">
                  {launchProgress.map((log, index) => (
                    <div key={index} className="pb-1 text-gray-300">
                      <span className="text-gray-500">{`$ `}</span>
                      {log}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="animate-pulse text-gray-500">▋</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card className="border-gray-800 bg-black/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-green-500" />
                  Sugar Alternative
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  Launch NFTs in your browser with similar steps to Metaplex Sugar CLI but without needing command-line skills.
                </p>
              </CardContent>
            </Card>
            <Card className="border-gray-800 bg-black/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-yellow-500" />
                  Metaplex Core
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  Based on the same Metaplex Core standard used by Sugar CLI for on-chain metadata and collection verification.
                </p>
              </CardContent>
            </Card>
            <Card className="border-gray-800 bg-black/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-blue-500" />
                  User-Friendly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  Simple step-by-step process with visual feedback instead of complex command-line parameters.
                </p>
              </CardContent>
            </Card>
          </div>

          {txSignature && (
            <div className="mt-6 p-4 border border-green-800 rounded-lg bg-green-950/20">
              <h3 className="font-semibold text-green-500 mb-2 flex items-center">
                <Rocket className="h-5 w-5 mr-2" />
                Launch Complete!
              </h3>
              <p className="text-sm text-gray-400">
                Collection mint: <span className="font-mono text-green-400">{txSignature}</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                View your collection on Solana Explorer or compatible NFT marketplaces.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MetaplexLaunch;
