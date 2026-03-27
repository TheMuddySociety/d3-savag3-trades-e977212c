export const JUPITER_PLUGIN_SRC = 'https://terminal.jup.ag/main-v3.js';

let jupiterScriptPromise: Promise<void> | null = null;

const hasJupiterInit = (): boolean => {
  const jupiter = (window as Window & { Jupiter?: { init?: unknown } }).Jupiter;
  return typeof jupiter?.init === 'function';
};

export const loadJupiterPluginScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (hasJupiterInit()) return Promise.resolve();
  if (jupiterScriptPromise) return jupiterScriptPromise;

  jupiterScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${JUPITER_PLUGIN_SRC}"]`);

    if (existingScript) {
      if (hasJupiterInit()) {
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
