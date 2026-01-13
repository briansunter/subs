/**
 * Mock Cloudflare Turnstile service for testing
 */

import type { TurnstileVerifyResponse } from "../../src/services/turnstile";

interface VerificationCall {
  token: string;
  secretKey: string;
  timestamp: number;
}

let mockCalls: VerificationCall[] = [];
let mockNextResult: TurnstileVerifyResponse | null = null;
let mockError: Error | null = null;

/**
 * Mock Turnstile service for testing
 */
export const mockTurnstileService = {
  /**
   * Reset all mock state
   */
  reset(): void {
    mockCalls = [];
    mockNextResult = null;
    mockError = null;
  },

  /**
   * Set the next verification call to return success
   * @param hostname - Optional hostname to include in the response
   */
  setSuccess(hostname?: string): void {
    mockNextResult = {
      success: true,
      hostname,
    };
  },

  /**
   * Set the next verification call to return failure
   * @param error - Error message describing the failure
   * @param hostname - Optional hostname to include in the response
   */
  setError(error: string, hostname?: string): void {
    mockNextResult = {
      success: false,
      hostname,
      error,
    };
  },

  /**
   * Set an error to be thrown on the next call
   * @param error - Error to throw
   */
  setException(error: Error): void {
    mockError = error;
  },

  /**
   * Clear the next result configuration (reverts to default success behavior)
   */
  clearNextResult(): void {
    mockNextResult = null;
    mockError = null;
  },

  /**
   * Get all verification calls made to the mock
   */
  getCalls(): VerificationCall[] {
    return mockCalls;
  },

  /**
   * Get the number of times verifyTurnstileToken was called
   */
  getCallCount(): number {
    return mockCalls.length;
  },

  /**
   * Get the last verification call
   */
  getLastCall(): VerificationCall | undefined {
    return mockCalls[mockCalls.length - 1];
  },

  /**
   * Get all tokens that were verified
   */
  getTokens(): string[] {
    return mockCalls.map((call) => call.token);
  },

  /**
   * Get all secret keys that were used
   */
  getSecretKeys(): string[] {
    return mockCalls.map((call) => call.secretKey);
  },

  /**
   * Check if a specific token was verified
   * @param token - Token to check
   */
  wasTokenVerified(token: string): boolean {
    return mockCalls.some((call) => call.token === token);
  },

  /**
   * Count how many times a specific token was verified
   * @param token - Token to count
   */
  countTokenVerifications(token: string): number {
    return mockCalls.filter((call) => call.token === token).length;
  },

  /**
   * Mock implementation of verifyTurnstileToken
   * @param token - The Turnstile token to verify
   * @param secretKey - The Turnstile secret key
   * @returns Verification result
   */
  verifyTurnstileToken: async (
    token: string,
    secretKey: string,
  ): Promise<TurnstileVerifyResponse> => {
    // Track the call
    mockCalls.push({
      token,
      secretKey,
      timestamp: Date.now(),
    });

    // If an exception is configured, throw it
    if (mockError) {
      throw mockError;
    }

    // If a specific result is configured, return it
    if (mockNextResult) {
      return mockNextResult;
    }

    // Default behavior: return success
    return {
      success: true,
    };
  },
};

// Export internal state for advanced testing scenarios
export { mockCalls, mockNextResult, mockError };
