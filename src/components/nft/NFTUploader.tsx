import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Image, X, Plus, FileImage } from "lucide-react";

interface NFTUploaderProps {
  onComplete: () => void;
}

interface NFTAsset {
  id: string;
  file: File;
  preview: string;
  name: string;
}

export const NFTUploader: React.FC<NFTUploaderProps> = ({ onComplete }) => {
  const [assets, setAssets] = useState<NFTAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [collectionImage, setCollectionImage] = useState<{ file: File; preview: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const newFiles = Array.from(e.target.files);
    
    // Validate file type and size
    const validFiles = newFiles.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      
      if (!isImage) {
        toast.error("Invalid file type", { description: `${file.name} is not an image file` });
      }
      
      if (!isValidSize) {
        toast.error("File too large", { description: `${file.name} exceeds the 10MB limit` });
      }
      
      return isImage && isValidSize;
    });
    
    // Create asset objects
    const newAssets = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, "") // Remove file extension
    }));
    
    setAssets(prev => [...prev, ...newAssets]);
  };

  const handleCollectionImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
    // Validate file type and size
    const isImage = file.type.startsWith('image/');
    const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
    
    if (!isImage) {
      toast.error("Invalid file type", { description: "Please upload an image file" });
      return;
    }
    
    if (!isValidSize) {
      toast.error("File too large", { description: "Image exceeds the 10MB limit" });
      return;
    }
    
    setCollectionImage({
      file,
      preview: URL.createObjectURL(file)
    });
  };

  const removeAsset = (id: string) => {
    setAssets(prev => {
      const assetToRemove = prev.find(asset => asset.id === id);
      if (assetToRemove) {
        URL.revokeObjectURL(assetToRemove.preview);
      }
      return prev.filter(asset => asset.id !== id);
    });
  };

  const removeCollectionImage = () => {
    if (collectionImage) {
      URL.revokeObjectURL(collectionImage.preview);
    }
    setCollectionImage(null);
  };

  const handleContinue = () => {
    if (assets.length === 0) {
      toast.error("No NFT assets", { description: "Please upload at least one NFT image" });
      return;
    }
    
    if (!collectionImage) {
      toast.error("No collection image", { description: "Please upload a collection image" });
      return;
    }
    
    // Save assets to NFTService or context
    // For now, we'll just show a success message and continue
    localStorage.setItem('nftAssets', JSON.stringify(assets.map(a => ({ id: a.id, name: a.name }))));
    localStorage.setItem('collectionImage', JSON.stringify({ name: collectionImage.file.name }));
    
    toast.success("Assets uploaded", { description: `${assets.length} NFT images ready for minting` });
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Upload NFT Assets</h2>
        <p className="text-gray-400 mb-4">
          Upload the images for your NFT collection. You can upload multiple images at once.
        </p>
      </div>
      
      {/* Collection image uploader */}
      <div className="space-y-2">
        <Label htmlFor="collection-image" className="text-white">Collection Image</Label>
        <p className="text-sm text-gray-400 mb-2">
          This image will be used as the collection thumbnail and logo
        </p>
        
        {collectionImage ? (
          <div className="relative w-40 h-40 rounded-lg overflow-hidden border border-gray-700">
            <img 
              src={collectionImage.preview} 
              alt="Collection" 
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={removeCollectionImage}
              className="absolute top-2 right-2 bg-black/70 rounded-full p-1 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Label 
            htmlFor="collection-image" 
            className="flex flex-col items-center justify-center w-40 h-40 border-2 border-dashed border-gray-700 rounded-lg hover:border-red-500 transition-colors cursor-pointer bg-black/30"
          >
            <FileImage className="h-10 w-10 text-gray-500 mb-2" />
            <span className="text-sm text-gray-400">Collection Image</span>
          </Label>
        )}
        
        <Input
          id="collection-image"
          type="file"
          accept="image/*"
          onChange={handleCollectionImageChange}
          className="hidden"
        />
      </div>
      
      {/* NFT Assets uploader */}
      <div className="space-y-2">
        <Label htmlFor="nft-images" className="text-white">NFT Images</Label>
        <p className="text-sm text-gray-400 mb-2">
          Upload the individual NFT images (max 10MB per image, JPG, PNG, or GIF)
        </p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {/* Existing assets */}
          {assets.map(asset => (
            <div key={asset.id} className="relative rounded-lg overflow-hidden border border-gray-700 aspect-square">
              <img 
                src={asset.preview} 
                alt={asset.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs truncate">{asset.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAsset(asset.id)}
                className="absolute top-2 right-2 bg-black/70 rounded-full p-1 text-white hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {/* Upload button */}
          <Label 
            htmlFor="nft-images" 
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg hover:border-red-500 transition-colors cursor-pointer bg-black/30 aspect-square"
          >
            <Plus className="h-8 w-8 text-gray-500 mb-2" />
            <span className="text-sm text-gray-400">Add Images</span>
          </Label>
        </div>
        
        <Input
          id="nft-images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleContinue} 
          className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600"
        >
          {assets.length > 0 ? `Continue with ${assets.length} NFTs` : "Continue"}
          <Rocket className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
