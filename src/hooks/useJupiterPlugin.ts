import { useRef, useEffect, useCallback, useState } from 'react';

declare global {
  interface Window {
    Jupiter?: any;
  }
}

export const useJupiterPlugin = (outputMint: string | null, containerId: string = "jupiter-plugin-container") => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(() => {
    if (containerRef.current) containerRef.current.style.display = 'block';
  }, []);

  const hide = useCallback(() => {
    if (containerRef.current) containerRef.current.style.display = 'none';
  }, []);

  useEffect(() => {
    let mounted = true;

    // If JupiverseKit (or previous init) already manages Jupiter, just update it
    if (window.Jupiter && outputMint) {
      try {
        if (typeof window.Jupiter.setFormProps === 'function') {
          window.Jupiter.setFormProps({ initialOutputMint: outputMint });
        } else if (typeof window.Jupiter.update === 'function') {
          window.Jupiter.update({ formProps: { initialOutputMint: outputMint } });
        }
        
        if (mounted) {
          setIsReady(true);
          show();
        }
        // If we successfully updated/reused, we can skip fresh script load
        return () => { mounted = false; hide(); };
      } catch (e) {
        console.warn('Jupiter update failed, falling back to manual init', e);
      }
    }

    // Only manual load if truly needed
    const J3_URL = 'https://terminal.jup.ag/main-v3.js';
    const existingScript = document.querySelector(`script[src="${J3_URL}"]`);
    
    if (existingScript) {
      if (mounted) setIsReady(true);
    } else {
      const script = document.createElement('script');
      script.src = J3_URL;
      script.async = true;
      script.setAttribute('data-preload', 'true');

      script.onload = () => {
        if (mounted) setIsReady(true);
      };

      script.onerror = () => {
        if (mounted) setError('Failed to load Jupiter Terminal');
      };

      document.head.appendChild(script);
    }

    return () => {
      mounted = false;
      hide();
    };
  }, [outputMint, show, hide]);

  return { containerRef, isReady, error, show, hide };
};
