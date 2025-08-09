/**
 * Window polyfill for Chrome extension service worker context
 * Provides window object when not available (like in service workers)
 */

export interface WindowPolyfillOptions {
  enableLogging?: boolean;
}

export class WindowPolyfill {
  private static instance: WindowPolyfill;
  private isInitialized = false;
  private enableLogging: boolean;

  constructor(options: WindowPolyfillOptions = {}) {
    this.enableLogging = options.enableLogging ?? true;
  }

  static getInstance(options?: WindowPolyfillOptions): WindowPolyfill {
    if (!WindowPolyfill.instance) {
      WindowPolyfill.instance = new WindowPolyfill(options);
    }
    return WindowPolyfill.instance;
  }

  setup(): void {
    if (this.isInitialized) {
      this.log("Window polyfill already initialized");
      return;
    }

    // Provide window polyfill for background script context
    if (typeof window === 'undefined') {
      this.log("🔧 Creating window polyfill for background script");
      
      (globalThis as any).window = {
        location: { 
          href: 'chrome-extension://background',
          search: ''
        },
        navigator: { userAgent: 'Chrome Extension' },
        document: {
          title: 'Background Script',
          querySelector: () => null,
          querySelectorAll: () => [],
          getElementById: () => null,
          getElementsByTagName: () => [],
          getElementsByClassName: () => [],
          createElement: () => ({}),
          documentElement: {},
          head: {},
          body: {},
        }
      };

      // Also set document globally
      if (typeof document === 'undefined') {
        (globalThis as any).document = (globalThis as any).window.document;
      }
      
      this.log("✅ Window polyfill created for background script");
    } else {
      this.log("✅ Native window object available");
    }

    this.isInitialized = true;
  }

  private log(...args: any[]): void {
    if (this.enableLogging) {
      console.log(...args);
    }
  }
}

// Export a convenience function
export function setupWindowPolyfill(options?: WindowPolyfillOptions): void {
  WindowPolyfill.getInstance(options).setup();
} 