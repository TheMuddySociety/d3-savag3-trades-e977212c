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
export const WalletNotification = {
  onConnect: (params: IWalletNotification) => {
    toast.success(`Connected to ${params.walletName || 'Wallet'}`, {
      description: `Wallet: ${params.shortAddress || 'Connected'}`,
    });
  },
  onConnecting: (params: IWalletNotification) => {
    toast.info(`Connecting to ${params.walletName || 'Wallet'}...`);
  },
  onDisconnect: (params: IWalletNotification) => {
    toast.info(`Disconnected from ${params.walletName || 'Wallet'}`);
  },
  onNotInstalled: (params: IWalletNotification) => {
    toast.error(`${params.walletName || 'Wallet'} is not installed`, {
      description: "Please install the extension to continue.",
    });
  },
  onError: (params: IWalletNotification) => {
    toast.error(`Failed to connect to ${params.walletName || 'Wallet'}`);
  }
};

export default WalletNotification;
