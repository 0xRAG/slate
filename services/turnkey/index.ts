import { hexToNumber, serializeSignature, signatureToHex } from "viem";
import type { WalletService, ServiceResult } from "../index.js";
import { Turnkey, TurnkeyApiClient } from "@turnkey/sdk-server";

// Must export as default for auto-discovery
export default class TurnkeyWalletService implements WalletService {
  private turnkeyClient?: TurnkeyApiClient;
  private isInitialized = false;
  private ethereumWalletAddress?: string;
  private solanaWalletAddress?: string;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Load credentials from environment variables
    const organizationId = process.env.TURNKEY_ORGANIZATION_ID;
    const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;
    const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    this.ethereumWalletAddress = process.env.TURNKEY_ETHEREUM_WALLET_ADDRESS;
    this.solanaWalletAddress = process.env.TURNKEY_SOLANA_WALLET_ADDRESS;

    // Validate required configuration
    if (!organizationId || !apiPrivateKey || !apiPublicKey) {
      throw new Error(
        "Missing required env vars: TURNKEY_ORGANIZATION_ID, TURNKEY_API_PRIVATE_KEY, TURNKEY_API_PUBLIC_KEY"
      );
    }

    if (!this.ethereumWalletAddress) {
      throw new Error(
        "Missing TURNKEY_ETHEREUM_WALLET_ADDRESS - required for signature verification"
      );
    }

    try {
      this.turnkeyClient = new Turnkey({
        defaultOrganizationId: organizationId,
        apiBaseUrl: "https://api.turnkey.com",
        apiPrivateKey,
        apiPublicKey,
      }).apiClient({
        apiPrivateKey,
        apiPublicKey,
      });
      this.isInitialized = true;
    } catch (error: any) {
      throw new Error(`Turnkey initialization failed: ${error.message}`);
    }
  }

  async signMessageEthereum(message: string): Promise<ServiceResult> {
    if (!this.isInitialized || !this.turnkeyClient) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    if (!this.ethereumWalletAddress) {
      throw new Error(
        "Missing TURNKEY_ETHEREUM_WALLET_ADDRESS - required for signature verification"
      );
    }

    try {
      // Time ONLY the API call - exclude message prep and response parsing
      const apiStart = performance.now();
      const result = await this.turnkeyClient.signRawPayload({
        signWith: this.ethereumWalletAddress,
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
        payload: message,
        hashFunction: "HASH_FUNCTION_KECCAK256",
      });
      const apiEnd = performance.now();

      const signature = signatureToHex({
        r: `0x${result.r}`,
        s: `0x${result.s}`,
        v: 27n,
      });

      // Return signature and timing - runner will use these for benchmarking
      const serviceResult: ServiceResult = {
        signature,
        apiLatencyMs: apiEnd - apiStart,
        walletAddress: this.ethereumWalletAddress, // Required for signature verification
      };

      return serviceResult;
    } catch (error: any) {
      throw new Error(`Turnkey Ethereum signing failed: ${error.message}`);
    }
  }

  async signMessageSolana(message: string): Promise<ServiceResult> {
    if (!this.isInitialized || !this.turnkeyClient) {
      throw new Error("Not initialized. Call initialize() first.");
    }

    if (!this.solanaWalletAddress) {
      throw new Error(
        "Missing TURNKEY_SOLANA_WALLET_ADDRESS - required for signature verification"
      );
    }

    try {
      // Time ONLY the API call
      const apiStart = performance.now();
      const result = await this.turnkeyClient.signRawPayload({
        signWith: this.solanaWalletAddress,
        encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
        payload: message,
        hashFunction: "HASH_FUNCTION_NO_OP",
      });
      const apiEnd = performance.now();

      // Return signature as-is
      const serviceResult: ServiceResult = {
        signature: result.r + result.s + result.v,
        apiLatencyMs: apiEnd - apiStart,
        walletAddress: this.solanaWalletAddress, // Required for signature verification
      };

      return serviceResult;
    } catch (error: any) {
      throw new Error(`Turnkey Solana signing failed: ${error.message}`);
    }
  }
}
