/**
 * Crypto polyfill for Chrome extension service worker context
 * Uses @peculiar/webcrypto for proper WebCrypto API support
 */

import { Crypto } from "@peculiar/webcrypto";

export interface CryptoPolyfillOptions {
  enableLogging?: boolean;
}

export function setupCryptoPolyfill(options: CryptoPolyfillOptions = {}): void {
  const enableLogging = options.enableLogging ?? true;

  const log = (...args: any[]) => {
    if (enableLogging) {
      console.log(...args);
    }
  };

  log("🔧 Setting up WebCrypto polyfill for service worker context");

  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    log(
      "⚠️ Native crypto.subtle not available, using @peculiar/webcrypto polyfill"
    );

    const webCrypto = new Crypto();

    if (!globalThis.crypto) {
      (globalThis as any).crypto = webCrypto;
    } else {
      (globalThis as any).crypto.subtle = webCrypto.subtle;
    }

    if (typeof self !== "undefined") {
      if (!(self as any).crypto) {
        (self as any).crypto = webCrypto;
      } else if (!(self as any).crypto.subtle) {
        (self as any).crypto.subtle = webCrypto.subtle;
      }
    }

    if (typeof window !== "undefined") {
      if (!(window as any).crypto) {
        (window as any).crypto = webCrypto;
      } else if (!(window as any).crypto.subtle) {
        (window as any).crypto.subtle = webCrypto.subtle;
      }
    }

    log("✅ @peculiar/webcrypto polyfill installed");
  } else {
    try {
      const testData = new TextEncoder().encode("test");
      globalThis.crypto.subtle.digest("SHA-256", testData);
      log("✅ Native crypto.subtle available and functional");

      if (typeof self !== "undefined" && !(self as any).crypto) {
        (self as any).crypto = globalThis.crypto;
      }

      if (typeof window !== "undefined" && !(window as any).crypto) {
        (window as any).crypto = globalThis.crypto;
      }
    } catch (error) {
      log(
        "⚠️ Native crypto.subtle exists but is not functional, using polyfill"
      );

      const webCrypto = new Crypto();

      if (!globalThis.crypto) {
        (globalThis as any).crypto = webCrypto;
      } else {
        (globalThis as any).crypto.subtle = webCrypto.subtle;
      }

      if (typeof self !== "undefined") {
        if (!(self as any).crypto) {
          (self as any).crypto = webCrypto;
        } else if (!(self as any).crypto.subtle) {
          (self as any).crypto.subtle = webCrypto.subtle;
        }
      }

      if (typeof window !== "undefined") {
        if (!(window as any).crypto) {
          (window as any).crypto = webCrypto;
        } else if (!(window as any).crypto.subtle) {
          (window as any).crypto.subtle = webCrypto.subtle;
        }
      }

      log("✅ @peculiar/webcrypto polyfill installed");
    }
  }

  log("🔧 Final crypto state:", {
    globalThis: !!globalThis.crypto,
    subtle: !!globalThis.crypto.subtle,
    methods: globalThis.crypto.subtle
      ? Object.keys(globalThis.crypto.subtle)
      : [],
  });
}

export async function testCryptoPolyfill(): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
      return {
        success: false,
        error: "Crypto.subtle not available after polyfill setup",
      };
    }

    const testData = new TextEncoder().encode("Hello, World!");
    const hash = await globalThis.crypto.subtle.digest("SHA-256", testData);

    return {
      success: true,
      details: {
        cryptoAvailable: !!globalThis.crypto,
        subtleAvailable: !!globalThis.crypto.subtle,
        digestLength: hash.byteLength,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Crypto test failed",
    };
  }
}

export function isCryptoAvailable(): boolean {
  return !!(globalThis.crypto && globalThis.crypto.subtle);
}

export async function testHederaCompatibility(): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    setupCryptoPolyfill();

    const { Client } = await import("@hashgraph/sdk");

    const client = Client.forTestnet();

    return {
      success: true,
      details: {
        clientCreated: !!client,
        cryptoAvailable: isCryptoAvailable(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Hedera compatibility test failed",
      details: {
        cryptoAvailable: isCryptoAvailable(),
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      },
    };
  }
}
