import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, Rocket, Plus, Minus, Tag, Globe, Database } from "lucide-react";
import { useWallet } from '@solana/wallet-adapter-react';
import { NFTCollection, NFTAttribute, NFTCreator } from '@/types/nft';

interface NFTMetadataFormProps {
  onComplete: () => void;
  onBack: () => void;
}

interface FormMetadata extends NFTCollection {
  royaltyPercentage: number;
}

export const NFTMetadataForm: React.FC<NFTMetadataFormProps> = ({ onComplete, onBack }) => {
  const { publicKey } = useWallet();
  const [metadata, setMetadata] = useState<FormMetadata>({
    name: '',
    symbol: '',
    description: '',
    externalUrl: '',
    royaltyPercentage: 5,
    creators: [],
    sellerFeeBasisPoints: 500, // 5%
  });
  
  const [attributes, setAttributes] = useState<NFTAttribute[]>([
    { trait_type: '', value: '' }
  ]);
  
  const [useSameMetadataForAll, setUseSameMetadataForAll] = useState(true);

  useEffect(() => {
    if (publicKey) {
      setMetadata(prev => ({
        ...prev,
        creators: [{ address: publicKey.toString(), share: 100 }]
      }));
    }
  }, [publicKey]);

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const handleRoyaltyChange = (value: number) => {
    if (value >= 0 && value <= 100) {
      setMetadata(prev => ({ 
        ...prev, 
        royaltyPercentage: value,
        sellerFeeBasisPoints: value * 100 // Convert percentage to basis points
      }));
    }
  };

  const handleAttributeChange = (index: number, field: 'trait_type' | 'value', value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    if (attributes.length > 1) {
      const newAttributes = [...attributes];
      newAttributes.splice(index, 1);
      setAttributes(newAttributes);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!metadata.name.trim()) {
      toast.error("Missing name", { description: "Please enter a collection name" });
      return;
    }
    
    if (!metadata.symbol.trim()) {
      toast.error("Missing symbol", { description: "Please enter a collection symbol" });
      return;
    }
    
    const filteredAttributes = attributes.filter(attr => 
      typeof attr.trait_type === 'string' && 
      attr.trait_type.trim() !== '' && 
      typeof attr.value === 'string' && 
      attr.value.trim() !== ''
    );
    
    localStorage.setItem('nftMetadata', JSON.stringify({
      ...metadata,
      attributes: filteredAttributes,
      useSameMetadataForAll
    }));
    
    toast.success("Metadata saved", { description: "NFT collection metadata has been saved" });
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Collection Metadata</h2>
        <p className="text-gray-400 mb-4">
          Add metadata information for your NFT collection
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">Collection Name</Label>
            <Input
              id="name"
              name="name"
              value={metadata.name}
              onChange={handleMetadataChange}
              placeholder="My Awesome NFT Collection"
              className="bg-black/40 border-gray-700 focus:border-red-500"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="symbol" className="text-white">Collection Symbol</Label>
            <Input
              id="symbol"
              name="symbol"
              value={metadata.symbol}
              onChange={handleMetadataChange}
              placeholder="AWESOME"
              className="bg-black/40 border-gray-700 focus:border-red-500 uppercase"
              maxLength={10}
            />
            <p className="text-xs text-gray-500">Max 10 characters</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description" className="text-white">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={metadata.description}
            onChange={handleMetadataChange}
            placeholder="Describe your NFT collection..."
            className="bg-black/40 border-gray-700 focus:border-red-500 resize-none"
            rows={3}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="externalUrl" className="text-white">External URL (Optional)</Label>
          <Input
            id="externalUrl"
            name="externalUrl"
            value={metadata.externalUrl}
            onChange={handleMetadataChange}
            placeholder="https://yourwebsite.com"
            className="bg-black/40 border-gray-700 focus:border-red-500"
          />
        </div>
      </div>
      
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="royaltyPercentage" className="text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-red-500" />
            Royalty Percentage
          </Label>
          <Badge variant="outline" className="text-red-500 border-red-500">
            {metadata.royaltyPercentage}%
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => handleRoyaltyChange(metadata.royaltyPercentage - 1)}
            disabled={metadata.royaltyPercentage <= 0}
            className="h-8 w-8 p-0 flex items-center justify-center border-gray-700"
          >
            <Minus className="h-3 w-3" />
          </Button>
          
          <Input
            type="range"
            min="0"
            max="100"
            step="1"
            value={metadata.royaltyPercentage}
            onChange={(e) => handleRoyaltyChange(parseInt(e.target.value))}
            className="flex-1"
          />
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => handleRoyaltyChange(metadata.royaltyPercentage + 1)}
            disabled={metadata.royaltyPercentage >= 100}
            className="h-8 w-8 p-0 flex items-center justify-center border-gray-700"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        
        <p className="text-xs text-gray-500">
          You'll receive {metadata.royaltyPercentage}% of secondary sales
        </p>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-white flex items-center gap-2">
            <Tag className="h-4 w-4 text-red-500" />
            NFT Attributes
          </Label>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="use-same-metadata"
              checked={useSameMetadataForAll}
              onCheckedChange={setUseSameMetadataForAll}
            />
            <Label htmlFor="use-same-metadata" className="text-sm text-gray-400">
              Use same metadata for all NFTs
            </Label>
          </div>
        </div>
        
        <div className="space-y-3">
          {attributes.map((attr, index) => (
            <div key={index} className="grid grid-cols-5 gap-2">
              <Input
                placeholder="Trait name"
                value={attr.trait_type}
                onChange={(e) => handleAttributeChange(index, 'trait_type', e.target.value)}
                className="col-span-2 bg-black/40 border-gray-700"
              />
              <Input
                placeholder="Value"
                value={attr.value}
                onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                className="col-span-2 bg-black/40 border-gray-700"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => removeAttribute(index)}
                disabled={attributes.length <= 1}
                className="border-gray-700 hover:bg-red-900/20 hover:text-red-500"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={addAttribute}
            className="w-full border-dashed border-gray-700 hover:border-red-500"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Attribute
          </Button>
        </div>
      </div>
      
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
          type="submit" 
          className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
        >
          Continue <Rocket className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};
