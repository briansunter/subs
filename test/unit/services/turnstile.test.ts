/**
 * Unit tests for Turnstile verification service
 * Tests PRODUCTION code (src/services/turnstile.ts) with mocked fetch
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { verifyTurnstileToken } from "../../../src/services/turnstile";
import { getRequestBody, mockGlobalFetch } from "../../helpers/test-app-elysia";

// Store original fetch
const originalFetch = global.fetch;

// Use globalThis to avoid closure capture issues
interface FetchCall {
  url: string;
  options: RequestInit;
}

declare global {
  var __testFetchCalls: FetchCall[] | undefined;
}

function getFetchCalls(): FetchCall[] {
  if (!globalThis.__testFetchCalls) {
    globalThis.__testFetchCalls = [];
  }
  return globalThis.__testFetchCalls;
}

function resetFetchCalls(): void {
  globalThis.__testFetchCalls = [];
}

function createMockFetch(response: Response): typeof fetch {
  const fetchImpl = (url: string | Request, options?: RequestInit) => {
    // Always get fresh reference to fetchCalls
    const fetchCalls = getFetchCalls();
    fetchCalls.push({ url: url.toString(), options: options || {} });

    // Return the provided response
    return Promise.resolve(response);
  };
  mockGlobalFetch(fetchImpl);
  return fetchImpl as typeof fetch;
}

describe("Turnstile Service - Unit Tests", () => {
  const mockToken = "valid_turnstile_token";
  const mockSecret = "test_secret_key";

  beforeEach(() => {
    resetFetchCalls();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clear fetch calls
    globalThis.__testFetchCalls = undefined;
  });

  describe("verifyTurnstileToken - Success", () => {
    test("should verify valid token and return success with hostname", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          hostname: "example.com",
          challenge_ts: "2024-01-12T12:00:00Z",
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(true);
      expect(result.hostname).toBe("example.com");
      expect(result.error).toBeUndefined();

      // Verify fetch was called correctly
      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0]?.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      expect(fetchCalls[0]?.options.method).toBe("POST");
      expect(fetchCalls[0]?.options.headers).toEqual({
        "Content-Type": "application/json",
      });

      const body = getRequestBody(fetchCalls[0]?.options);
      expect(body["secret"]).toBe(mockSecret);
      expect(body["response"]).toBe(mockToken);
    });

    test("should handle successful verification without hostname", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          challenge_ts: "2024-01-12T12:00:00Z",
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(true);
      expect(result.hostname).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe("verifyTurnstileToken - Verification Failure", () => {
    test("should handle invalid token response", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-response"],
          hostname: "example.com",
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.hostname).toBe("example.com");
      expect(result.error).toBe("invalid-input-response");
    });

    test("should handle multiple error codes", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-response", "timeout-or-duplicate"],
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid-input-response, timeout-or-duplicate");
    });

    test("should handle verification failure without error codes", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Verification failed");
    });

    test("should handle specific error codes", async () => {
      const errorCodes = [
        "invalid-input-secret",
        "invalid-input-response",
        "timeout-or-duplicate",
        "bad-request",
        "internal-error",
      ];

      for (const errorCode of errorCodes) {
        resetFetchCalls();

        const mockResponse = {
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            "error-codes": [errorCode],
          }),
        } as Response;

        global.fetch = createMockFetch(mockResponse);

        const result = await verifyTurnstileToken(mockToken, mockSecret);

        expect(result.success).toBe(false);
        expect(result.error).toBe(errorCode);
      }
    });
  });

  describe("verifyTurnstileToken - HTTP Errors", () => {
    test("should handle 500 Internal Server Error", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Internal Server Error",
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API returned error: 500 Internal Server Error");
      expect(result.hostname).toBeUndefined();
    });

    test("should handle 400 Bad Request", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Invalid request",
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API returned error: 400 Bad Request");
    });

    test("should handle 401 Unauthorized", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid secret key",
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API returned error: 401 Unauthorized");
    });

    test("should handle 429 Rate Limit", async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API returned error: 429 Too Many Requests");
    });
  });

  describe("verifyTurnstileToken - Network Errors", () => {
    test("should handle network connection error", async () => {
      mockGlobalFetch(() => Promise.reject(new Error("Network connection failed")));

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network connection failed");
      expect(result.hostname).toBeUndefined();
    });

    test("should handle timeout error", async () => {
      global.fetch = (() =>
        Promise.reject(new Error("Request timeout"))) as unknown as typeof fetch;

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
    });

    test("should handle DNS resolution error", async () => {
      globalThis.fetch = (() =>
        Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("ECONNREFUSED");
    });

    test("should handle generic error", async () => {
      globalThis.fetch = (() => Promise.reject("Some string error")) as unknown as typeof fetch;

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("verifyTurnstileToken - Request Formatting", () => {
    test("should send correct request format", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          hostname: "test.com",
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      await verifyTurnstileToken("test_token", "test_secret");

      const fetchCalls = getFetchCalls();
      const body = getRequestBody(fetchCalls[0]?.options);

      expect(body).toEqual({
        secret: "test_secret",
        response: "test_token",
      });
    });

    test("should include correct headers", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      await verifyTurnstileToken(mockToken, mockSecret);

      const fetchCalls = getFetchCalls();
      expect(fetchCalls[0]?.options.headers).toEqual({
        "Content-Type": "application/json",
      });
    });

    test("should use correct API endpoint", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      await verifyTurnstileToken(mockToken, mockSecret);

      const fetchCalls = getFetchCalls();
      expect(fetchCalls[0]?.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    });
  });

  describe("verifyTurnstileToken - Edge Cases", () => {
    test("should handle empty token", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken("", mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid-input-response");
    });

    test("should handle special characters in token", async () => {
      const specialToken = "token.with-special_chars_and.123";

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          hostname: "example.com",
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(specialToken, mockSecret);

      expect(result.success).toBe(true);

      const fetchCalls = getFetchCalls();
      const body = getRequestBody(fetchCalls[0]?.options);
      expect(body["response"]).toBe(specialToken);
    });

    test("should handle empty secret key", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-secret"],
        }),
      } as Response;

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, "");

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid-input-secret");
    });

    test("should handle malformed JSON response", async () => {
      // Create a mock Response object that throws on json()
      const mockResponse = new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("invalid json"));
            controller.close();
          },
        }),
      );
      // Override json() method to throw
      Object.defineProperty(mockResponse, "json", {
        value: async () => {
          throw new SyntaxError("Unexpected token");
        },
      });

      global.fetch = createMockFetch(mockResponse);

      const result = await verifyTurnstileToken(mockToken, mockSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected token");
    });
  });
});
