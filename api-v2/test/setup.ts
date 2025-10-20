import { webcrypto } from 'crypto';

// Make crypto available globally for Jest tests
if (!global.crypto) {
  (global as any).crypto = webcrypto;
}
