
/**
 * Polyfills for Node.js globals in browser environments
 * This helps browser-compatibility with libraries that expect Node.js globals
 */

// Polyfill for 'global'
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  // @ts-ignore - Intentionally adding to window
  window.global = window;
}

// Polyfill for 'Buffer' if needed
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  // @ts-ignore - Intentionally adding to window
  window.Buffer = require('buffer').Buffer;
}

// Polyfill for process.env
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  // @ts-ignore - Intentionally adding to window
  window.process = { env: {} };
}

export {};
