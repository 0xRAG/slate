import { CdpClient } from "@coinbase/cdp-sdk";
import type { WalletService, ServiceResult } from '../index.js';

// Must export as default for auto-discovery
export default class CdpWalletService implements WalletService {
  private cdpClient?: CdpClient;
  private isInitialized = false;
  private ethereumWalletAddress?: string;
  private solanaWalletAddress?: string;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Load credentials from environment variables
    const apiKeyId = process.env.CDP_API_KEY_ID;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;
    const walletSecret = process.env.CDP_WALLET_SECRET;
    this.ethereumWalletAddress = process.env.CDP_ETHEREUM_WALLET_ADDRESS;
    this.solanaWalletAddress = process.env.CDP_SOLANA_WALLET_ADDRESS;

    // Validate required configuration
    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      throw new Error('Missing required env vars: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET');
    }

    if (!this.ethereumWalletAddress) {
      throw new Error('Missing CDP_ETHEREUM_WALLET_ADDRESS - required for signature verification');
    }

    try {
      // Initialize CDP SDK client
      this.cdpClient = new CdpClient({
        apiKeyId,
        apiKeySecret,
        walletSecret,
      });
      this.isInitialized = true;

    } catch (error: any) {
      throw new Error(`CDP initialization failed: ${error.message}`);
    }
  }

  async signMessageEthereum(message: string): Promise<ServiceResult> {
    if (!this.isInitialized || !this.cdpClient) {
      throw new Error('Not initialized. Call initialize() first.');
    }

    if (!this.ethereumWalletAddress) {
      throw new Error('Missing CDP_ETHEREUM_WALLET_ADDRESS - required for signature verification');
    }

    try {
      // Time ONLY the API call - exclude message prep and response parsing
      const apiStart = performance.now();
      const result = await this.cdpClient.evm.signMessage({
        address: this.ethereumWalletAddress,
        message,
      });
      const apiEnd = performance.now();

      // Return signature and timing - runner will use these for benchmarking
      const serviceResult: ServiceResult = {
        signature: result.signature,
        apiLatencyMs: apiEnd - apiStart,
        walletAddress: this.ethereumWalletAddress, // Required for signature verification
      };

      return serviceResult;

    } catch (error: any) {
      throw new Error(`CDP Ethereum signing failed: ${error.message}`);
    }
  }

  async signMessageSolana(message: string): Promise<ServiceResult> {
    if (!this.isInitialized || !this.cdpClient) {
      throw new Error('Not initialized. Call initialize() first.');
    }

    if (!this.solanaWalletAddress) {
      throw new Error('Missing CDP_SOLANA_WALLET_ADDRESS - required for signature verification');
    }

    try {
      // Time ONLY the API call
      const apiStart = performance.now();
      const result = await this.cdpClient.solana.signMessage({
        address: this.solanaWalletAddress,
        message,
      });
      const apiEnd = performance.now();

      // Return signature as-is
      const serviceResult: ServiceResult = {
        signature: result.signature,
        apiLatencyMs: apiEnd - apiStart,
        walletAddress: this.solanaWalletAddress, // Required for signature verification
      };

      return serviceResult;

    } catch (error: any) {
      throw new Error(`CDP Solana signing failed: ${error.message}`);
    }
  }
}