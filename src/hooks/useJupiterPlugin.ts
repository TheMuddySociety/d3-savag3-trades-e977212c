import { useRef, useEffect, useState, useCallback } from 'react';
import { PLATFORM_CONFIG } from "@/config/platform";

declare global {
  interface Window {
    Jupiter: {
      init: (props: any) => Promise<void> | void;
      update?: (props: any) => void;
      setFormProps?: (props: any) => void;
      resume?: () => void;
      close?: () => void;
      _instance?: any;
    } | null;
  }
}

let scriptLoaded = false;
let initializationPromise: Promise<void> | null = null;
let isJupiterGloballyInitialized = false;

export const useJupiterPlugin = (outputMint: string | null = null, containerId: string = "jupiter-plugin-container") => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScript = useCallback(() => {
    if (scriptLoaded) return Promise.resolve();
    
    return new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector('script[src="https://plugin.jup.ag/plugin-v1.js"]');
      if (existingScript) {
        scriptLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://plugin.jup.ag/plugin-v1.js';
      script.async = true;
      script.setAttribute('data-preload', 'true');

      script.onload = () => {
        scriptLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Jupiter Plugin script'));
      
      document.head.appendChild(script);
    });
  }, []);

  const initializeJupiter = useCallback(async () => {
    if (isJupiterGloballyInitialized) return;
    if (initializationPromise) return initializationPromise;
    if (!window.Jupiter) return;

    initializationPromise = (async () => {
      try {
        await window.Jupiter?.init({
          displayMode: 'integrated',
          integratedTargetId: containerId,
          endpoint: import.meta.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com',
          enableWalletPassthrough: true,
          formProps: {
            initialOutputMint: outputMint || PLATFORM_CONFIG.USDC_MINT,
            initialInputMint: PLATFORM_CONFIG.SOL_MINT,
            referralAccount: PLATFORM_CONFIG.REFERRAL_ACCOUNT,
            referralFee: 150, // 1.5% default for platform
          },
          branding: {
            name: "SAVAG3 D3 Tradez",
            logoUri: "https://i.ibb.co/QvtDd1yY/image-6483441-4.jpg",
          },
        });
        isJupiterGloballyInitialized = true;
        setIsReady(true);
        setError(null);
      } catch (err) {
        setError('Failed to initialize Jupiter Plugin');
        console.error(err);
      }
    })();

    return initializationPromise;
  }, [containerId, outputMint]);

  // Main effect: load once + update on outputMint change
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await loadScript();
        if (mounted) {
          if (!isJupiterGloballyInitialized) {
            await initializeJupiter();
          } else if (window.Jupiter && outputMint && isReady) {
            // Hot swap tokens without reloading the iframe
            window.Jupiter.setFormProps?.({ initialOutputMint: outputMint });
            setIsReady(true);
          }
        }
      } catch (err) {
        if (mounted) setError('Jupiter Plugin failed to load');
      }
    })();

    return () => {
      mounted = false;
      // Hide container on unmount (do NOT destroy global instance)
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
      }
    };
  }, [outputMint, loadScript, initializeJupiter, isReady]);

  // Show/hide helper
  const show = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.display = 'block';
    }
  }, []);

  const hide = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.display = 'none';
    }
  }, []);

  return {
    containerRef,
    isReady,
    error,
    show,
    hide,
  };
};
