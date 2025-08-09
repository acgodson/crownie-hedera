if (typeof global === 'undefined') {
  (globalThis as any).global = globalThis;
}

if (typeof process === 'undefined') {
  (globalThis as any).process = {
    env: {},
    platform: 'browser',
    version: 'v16.0.0',
    nextTick: (fn: () => void) => Promise.resolve().then(fn)
  };
}

if (typeof window === 'undefined') {
  (globalThis as any).window = {
    location: { 
      href: 'chrome-extension://background',
      search: '',
      pathname: '/',
      hostname: 'background'
    },
    navigator: { userAgent: 'Chrome Extension Service Worker' },
    document: {
      title: 'Background Script',
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      getElementsByTagName: () => [],
      getElementsByClassName: () => [],
      createElement: (tag: string) => ({
        tagName: tag.toUpperCase(),
        setAttribute: () => {},
        appendChild: () => {},
        removeChild: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        style: {}
      }),
      documentElement: {
        style: {},
        setAttribute: () => {},
        appendChild: () => {},
        removeChild: () => {}
      },
      head: { 
        appendChild: () => {},
        removeChild: () => {}
      },
      body: {
        appendChild: () => {},
        removeChild: () => {}
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 16),
    cancelAnimationFrame: (id: number) => clearTimeout(id)
  };
}

if (typeof document === 'undefined') {
  (globalThis as any).document = (globalThis as any).window?.document || {
    title: 'Background Script',
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      setAttribute: () => {},
      appendChild: () => {},
      removeChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {}
    }),
    documentElement: {
      style: {},
      setAttribute: () => {},
      appendChild: () => {},
      removeChild: () => {}
    },
    head: { 
      appendChild: () => {},
      removeChild: () => {}
    },
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true
  };
}

if (typeof crypto !== 'undefined' && crypto.subtle) {
  console.log('✅ Native crypto.subtle available in service worker');
} else {
  console.warn('⚠️ Crypto availability check:', {
    cryptoExists: typeof crypto !== 'undefined',
    subtleExists: typeof crypto !== 'undefined' && crypto.subtle !== undefined,
    globalThis: typeof globalThis,
    self: typeof self
  });
  
  if (typeof self !== 'undefined' && self.crypto && self.crypto.subtle) {
    if (typeof (globalThis as any).crypto === 'undefined') {
      (globalThis as any).crypto = self.crypto;
    }
    console.log('✅ Using self.crypto.subtle via globalThis');
  } else {
    if (typeof (globalThis as any).crypto === 'undefined') {
      console.warn('⚠️ Creating minimal crypto polyfill - Hedera operations may fail');
      (globalThis as any).crypto = {
        subtle: {
          digest: async () => {
            throw new Error('crypto.subtle.digest not available - please ensure extension runs in proper service worker context');
          },
          sign: async () => {
            throw new Error('crypto.subtle.sign not available - please ensure extension runs in proper service worker context');
          },
          verify: async () => {
            throw new Error('crypto.subtle.verify not available - please ensure extension runs in proper service worker context');
          }
        },
        getRandomValues: (array: Uint8Array) => {
          for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
          }
          return array;
        }
      };
    }
  }
}

if (typeof Buffer === 'undefined') {
  try {
    const BufferPolyfill = require('buffer').Buffer;
    (globalThis as any).Buffer = BufferPolyfill;
  } catch {
    (globalThis as any).Buffer = {
      from: (data: any) => new Uint8Array(data),
      isBuffer: () => false
    };
  }
}

export {};