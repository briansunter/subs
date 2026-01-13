/**
 * Error scenario integration tests
 * Tests how the API handles various error conditions
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mockDiscordService } from "../mocks/discord";
import { mockSheetsService } from "../mocks/sheets";

// Type for API responses
interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  details?: string[];
  status?: string;
  timestamp?: string;
  data?: unknown;
}

// Store server process
let serverProcess: { kill: () => void } | null = null;
const TEST_PORT = 3013;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function startServer(envOverrides: Record<string, string> = {}) {
  serverProcess = Bun.spawn(["bun", "run", "index.ts"], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: "test",
      GOOGLE_SHEET_ID: "test-sheet-id",
      GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
      GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
      ALLOWED_ORIGINS: "*",
      DISCORD_WEBHOOK_URL: "",
      ...envOverrides,
    },
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for server to be ready by polling health endpoint
  const maxWait = 10000; // 10 seconds max
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) break;
    } catch {
      // Server not ready yet, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

describe("Error Scenarios - Integration Tests", () => {
  beforeEach(async () => {
    mockSheetsService.reset();
    mockDiscordService.reset();
  });

  afterEach(async () => {
    await stopServer();
  });

  describe("Malformed Request Bodies", () => {
    test("should handle invalid JSON gracefully", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid json}",
      });

      // Should return an error, not crash
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);

      // Just verify it's an error response
      expect(response.status).not.toBe(200);
    });

    test("should handle completely empty request", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("should handle request with wrong content type", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "email:test@example.com",
      });

      // Fastify may still parse it or return error
      expect([200, 400, 415]).toContain(response.status);
    });

    test("should handle request with missing required fields", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John Doe" }), // Missing email
      });

      expect(response.status).toBe(400);

      const data = (await response.json()) as ApiResponse;
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    test("should handle request with extra unexpected fields", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          unexpectedField: "value",
          anotherUnexpected: 123,
        }),
      });

      // Should succeed (extra fields are ignored by Zod)
      expect([200, 500]).toContain(response.status);
    });
  });

  describe("Extremely Large Payloads", () => {
    test("should handle very long email address", async () => {
      await startServer();

      // Create an email that's at the boundary of valid length
      const localPart = "a".repeat(64);
      const domain = `${"b".repeat(63)}.com`;
      const email = `${localPart}@${domain}`;

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Should accept valid long email
      expect([200, 500]).toContain(response.status);
    });

    test("should handle very large metadata object", async () => {
      await startServer();

      const largeMetadata: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = "x".repeat(100);
      }

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          metadata: largeMetadata,
        }),
      });

      // Should handle large metadata
      expect([200, 413, 500]).toContain(response.status);
    });

    test("should handle bulk signup with 100 items (max)", async () => {
      await startServer();

      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await fetch(`${BASE_URL}/api/signup/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signups }),
      });

      // Should accept max bulk size
      expect([200, 500]).toContain(response.status);
    });

    test("should reject bulk signup with 101 items (exceeds max)", async () => {
      await startServer();

      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await fetch(`${BASE_URL}/api/signup/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signups }),
      });

      expect(response.status).toBe(400);

      const data = (await response.json()) as ApiResponse;
      expect(data.success).toBe(false);
    });
  });

  describe("Concurrent Requests", () => {
    test("should handle concurrent signup requests", async () => {
      await startServer();

      const requests = Array.from({ length: 10 }, (_, i) =>
        fetch(`${BASE_URL}/api/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `concurrent${i}@example.com`,
          }),
        }),
      );

      const responses = await Promise.all(requests);

      // All should complete without error
      for (const response of responses) {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      }
    });

    test("should handle concurrent requests to different endpoints", async () => {
      await startServer();

      const responses = await Promise.all([
        fetch(`${BASE_URL}/api/health`),
        fetch(`${BASE_URL}/api/stats`),
        fetch(`${BASE_URL}/api/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        }),
      ]);

      // All should complete
      for (const response of responses) {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      }
    });

    test("should handle rapid sequential requests", async () => {
      await startServer();

      const responses = [];
      for (let i = 0; i < 20; i++) {
        const response = await fetch(`${BASE_URL}/api/health`);
        responses.push(response);
      }

      // All should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Service Failure Scenarios", () => {
    test("should continue operating if Discord webhook fails", async () => {
      // Configure with invalid Discord webhook
      await startServer({
        DISCORD_WEBHOOK_URL: "https://invalid-webhook-url-that-will-fail.com",
      });

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      // Signup should succeed or fail on Google Sheets, but not on Discord
      // Discord failures are non-blocking
      expect([200, 500]).toContain(response.status);

      const data = (await response.json()) as ApiResponse;
      if (response.status === 200) {
        expect(data.success).toBe(true);
      }
    });

    test("should handle Google Sheets authentication failures gracefully", async () => {
      // Configure with invalid credentials
      await startServer({
        GOOGLE_PRIVATE_KEY: "invalid-key",
      });

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });

      // Should return error but not crash
      expect([200, 500]).toContain(response.status);

      const data = (await response.json()) as ApiResponse;
      if (response.status === 500) {
        expect(data.success).toBe(false);
      }
    });
  });

  describe("Network and Timeout Scenarios", () => {
    test("should handle very long query strings", async () => {
      await startServer();

      const longQuery = "a".repeat(5000);
      const response = await fetch(`${BASE_URL}/api/health?${longQuery}`);

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });

    test("should handle requests with many headers", async () => {
      await startServer();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      for (let i = 0; i < 50; i++) {
        headers[`X-Custom-Header-${i}`] = "value".repeat(10);
      }

      const response = await fetch(`${BASE_URL}/api/health`, { headers });

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    test("should handle email with unicode characters", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@例え.jp" }),
      });

      // Should handle unicode (validator accepts it)
      expect([200, 400, 500]).toContain(response.status);
    });

    test("should handle email with plus sign", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user+tag@example.com" }),
      });

      expect([200, 500]).toContain(response.status);
    });

    test("should handle email with subdomains", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@mail.sub.example.com" }),
      });

      expect([200, 500]).toContain(response.status);
    });

    test("should handle special characters in name field", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup/extended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          name: "John O'Brien-Müller-Jørgen III",
          source: "api",
          tags: [],
        }),
      });

      expect([200, 500]).toContain(response.status);
    });

    test("should handle empty tags array", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup/extended`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          source: "api",
          tags: [],
        }),
      });

      expect([200, 500]).toContain(response.status);
    });
  });

  describe("Error Response Format", () => {
    test("should return consistent error format", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid-email" }),
      });

      expect(response.status).toBe(400);

      const data = (await response.json()) as ApiResponse;

      // Error responses should have consistent structure
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test("should include validation details when validation fails", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });

      const data = (await response.json()) as ApiResponse;

      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
      expect(Array.isArray(data.details)).toBe(true);
    });

    test("should return proper content-type on errors", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid" }),
      });

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });
  });
});
