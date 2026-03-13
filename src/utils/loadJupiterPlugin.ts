export const JUPITER_PLUGIN_SRC = 'https://plugin.jup.ag/plugin-v1.js';

declare global {
  interface Window {
    Jupiter?: {
      init: (config: Record<string, unknown>) => void;
    };
  }
}

let jupiterScriptPromise: Promise<void> | null = null;

export const loadJupiterPluginScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Jupiter?.init) return Promise.resolve();
  if (jupiterScriptPromise) return jupiterScriptPromise;

  jupiterScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${JUPITER_PLUGIN_SRC}"]`);

    if (existingScript) {
      if (window.Jupiter?.init) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Jupiter plugin script')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = JUPITER_PLUGIN_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jupiter plugin script'));
    document.head.appendChild(script);
  });

  return jupiterScriptPromise;
};
