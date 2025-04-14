
import React, { useState } from 'react';
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Image, Upload, CheckCircle2, FileImage, AlertCircle, Info, Rocket } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { NFTUploader } from "@/components/nft/NFTUploader";
import { NFTMetadataForm } from "@/components/nft/NFTMetadataForm";
import { NFTLaunchSummary } from "@/components/nft/NFTLaunchSummary";
import { NFTService } from "@/services/NFTService";

const MetaplexLaunch = () => {
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Check wallet connection on mount
  React.useEffect(() => {
    if (!connected) {
      toast.error("Wallet not connected", {
        description: "Please connect your wallet to launch NFTs",
      });
      navigate('/');
    }
  }, [connected, navigate]);

  // Handle step navigation
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

  // Handle NFT launch
  const handleLaunch = async () => {
    setIsLoading(true);
    try {
      toast.info("Launching NFT collection", {
        description: "Please approve the transaction in your wallet",
      });
      
      // Launch the NFT collection
      await NFTService.launchCollection();
      
      toast.success("NFT collection launched", {
        description: "Your NFT collection has been successfully launched",
      });
    } catch (error) {
      console.error("Error launching NFT collection:", error);
      toast.error("Failed to launch NFT collection", {
        description: "An error occurred while launching your NFT collection",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black to-gray-900">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-20 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Launch Metaplex Core NFTs</h1>
            <p className="text-gray-400">Create and launch your NFT collection on Solana</p>
          </div>

          {/* Progress indicator */}
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

          {/* Content based on current step */}
          <Card className="border-gray-800 bg-black/50 backdrop-blur-sm shadow-lg">
            <CardContent className="p-6">
              {currentStep === 1 && <NFTUploader onComplete={nextStep} />}
              {currentStep === 2 && <NFTMetadataForm onComplete={nextStep} onBack={prevStep} />}
              {currentStep === 3 && (
                <NFTLaunchSummary onLaunch={handleLaunch} onBack={prevStep} isLoading={isLoading} />
              )}
            </CardContent>
          </Card>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card className="border-gray-800 bg-black/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  No-Code Solution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  Launch NFTs without writing any code. Our intuitive interface makes it easy.
                </p>
              </CardContent>
            </Card>
            <Card className="border-gray-800 bg-black/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Low Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  Metaplex Core offers minimal fees compared to other NFT standards on Solana.
                </p>
              </CardContent>
            </Card>
            <Card className="border-gray-800 bg-black/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  Fast Deployment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  NFTs deploy within seconds on the Solana blockchain with instant confirmation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MetaplexLaunch;
