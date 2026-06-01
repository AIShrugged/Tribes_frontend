import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// Polyfill for next/cache and other server APIs imported transitively via feature indexes
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does not implement CSS.supports — provide a no-op stub.
// Check both typeof and the .supports method since jsdom may define CSS as an
// empty object without the supports() API.
if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
  globalThis.CSS = {
    supports: () => {
      return false;
    },
  };
}

// Prevent @/shared/lib/config from throwing when API modules are imported via feature indexes
if (!process.env.API_URL) {
  process.env.API_URL = 'https://test.local';
}
