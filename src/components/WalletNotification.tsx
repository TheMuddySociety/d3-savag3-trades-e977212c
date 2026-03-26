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
  onConnect: ({ shortAddress, walletName }: IWalletNotification) => {
    toast.success(`Connected to ${walletName}`, {
      description: `Wallet: ${shortAddress}`,
    });
  },
  onConnecting: ({ walletName }: IWalletNotification) => {
    toast.info(`Connecting to ${walletName}...`);
  },
  onDisconnect: ({ walletName }: IWalletNotification) => {
    toast.info(`Disconnected from ${walletName}`);
  },
  onError: ({ walletName }: IWalletNotification) => {
    toast.error(`Failed to connect to ${walletName}`);
  },
  onNotInstalled: ({ walletName }: IWalletNotification) => {
    toast.error(`${walletName} is not installed`, {
      description: "Please install the extension to continue.",
    });
  },
};

export default WalletNotification;
