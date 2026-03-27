/**
 * Polyfills for Node.js globals in browser environments
 * This helps browser-compatibility with libraries that expect Node.js globals
 */

import { Buffer as BufferPolyfill } from 'buffer';

// Polyfill for 'global'
if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

// Polyfill for 'Buffer' if needed
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  (window as any).Buffer = BufferPolyfill;
}

// Polyfill for process.env
if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

export {};
