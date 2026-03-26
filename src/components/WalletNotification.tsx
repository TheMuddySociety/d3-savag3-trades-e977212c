"use client";

import { toast } from "sonner";

interface IWalletNotification {
  publicKey?: string;
  shortAddress?: string;
  walletName?: string;
  metadata?: {
    name: string;
    url: string;
    icon: string;
    supportedTransactionVersions?: any;
  };
}

// Using Sonner for consistent app-wide look
export const WalletNotification = (params: any) => {
  const { type, walletName, shortAddress } = params;

  switch (type) {
    case 'onConnect':
      toast.success(`Connected to ${walletName}`, {
        description: `Wallet: ${shortAddress || 'Connected'}`,
      });
      break;
    case 'onConnecting':
      toast.info(`Connecting to ${walletName}...`);
      break;
    case 'onDisconnect':
      toast.info(`Disconnected from ${walletName}`);
      break;
    case 'onError':
      toast.error(`Failed to connect to ${walletName}`);
      break;
    case 'onNotInstalled':
      toast.error(`${walletName} is not installed`, {
        description: "Please install the extension to continue.",
      });
      break;
    default:
      console.log("Wallet Notification:", params);
      break;
  }
};

export default WalletNotification;
