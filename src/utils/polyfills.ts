
/**
 * Polyfills for Node.js globals in browser environments
 * This helps browser-compatibility with libraries that expect Node.js globals
 */

import { Buffer as BufferPolyfill } from 'buffer';

// Polyfill for 'global'
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  // @ts-ignore - Intentionally adding to window
  window.global = window;
}

// Polyfill for 'Buffer' if needed
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  // @ts-ignore - Intentionally adding to window
  window.Buffer = BufferPolyfill;
}

// Polyfill for process.env
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  // @ts-ignore - Intentionally adding to window
  window.process = { env: {} };
}

export {};
