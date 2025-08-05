/**
 * Environment utilities for IC Notetaker Extension
 * Handles both build-time and runtime environment variables
 */

export const ENV = {
  // Network configuration
  get DFX_NETWORK(): string {
    return import.meta.env.DFX_NETWORK || "ic";
  },

  get IS_LOCAL(): boolean {
    return this.DFX_NETWORK === "local";
  },

  get IS_PRODUCTION(): boolean {
    return this.DFX_NETWORK === "ic";
  },

  // IC Host configuration
  get IC_HOST(): string {
    return (
      import.meta.env.IC_HOST ||
      (this.IS_LOCAL ? "http://127.0.0.1:4943" : "https://icp-api.io")
    );
  },

  // Canister IDs
  get CANISTER_ID_IC_NOTETAKER_BACKEND(): string {
    return import.meta.env.CANISTER_ID_IC_NOTETAKER_BACKEND || "";
  },

  get CANISTER_ID_INTERNET_IDENTITY(): string {
    return (
      import.meta.env.CANISTER_ID_INTERNET_IDENTITY ||
      "rdmx6-jaaaa-aaaaa-aaadq-cai"
    );
  },

  // Development mode
  get IS_DEV(): boolean {
    return import.meta.env.DEV || false;
  },

  get MODE(): string {
    return import.meta.env.MODE || "production";
  },

  // Debug info
  debug(): void {
    console.log("🔧 IC Notetaker Environment:", {
      DFX_NETWORK: this.DFX_NETWORK,
      IS_LOCAL: this.IS_LOCAL,
      IS_PRODUCTION: this.IS_PRODUCTION,
      IC_HOST: this.IC_HOST,
      CANISTER_ID_IC_NOTETAKER_BACKEND: this.CANISTER_ID_IC_NOTETAKER_BACKEND,
      CANISTER_ID_INTERNET_IDENTITY: this.CANISTER_ID_INTERNET_IDENTITY,
      IS_DEV: this.IS_DEV,
      MODE: this.MODE,
    });
  },
};

// Helper to check if we need to fetch root key
export const shouldFetchRootKey = (): boolean => {
  return (
    ENV.IS_LOCAL ||
    ENV.IC_HOST.includes("localhost") ||
    ENV.IC_HOST.includes("127.0.0.1")
  );
};

// Helper to get IC agent options
export const getICAgentOptions = () => {
  return {
    host: ENV.IC_HOST,
  };
};
