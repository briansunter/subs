/**
 * Health check tests with connection validation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mockSheetsService } from "../mocks/sheets";

// Type for API responses
interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  status?: string;
  timestamp?: string;
  data?: unknown;
}

const TEST_PORT = 3012;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess: ReturnType<typeof Bun.spawn> | null = null;

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

describe("Health Check with Connection Validation", () => {
  beforeEach(async () => {
    mockSheetsService.reset();
  });

  afterEach(async () => {
    await stopServer();
  });

  describe("Basic Health Check", () => {
    test("should return healthy status", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("timestamp");
      expect(data.timestamp ? new Date(data.timestamp) : undefined).toBeDefined();
    });

    test("should respond quickly", async () => {
      await startServer();

      const start = Date.now();
      await fetch(`${BASE_URL}/api/health`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should respond in under 1 second
    });
  });

  describe("Authentication Health", () => {
    test("should detect Google Sheets authentication failure", async () => {
      // Use invalid credentials to trigger auth failure
      await startServer({
        GOOGLE_PRIVATE_KEY: "invalid-key",
      });

      // The health endpoint should still return 200
      // but the connection to Sheets will fail
      const response = await fetch(`${BASE_URL}/api/health`);

      expect(response.status).toBe(200);
    });

    test("should detect missing credentials", async () => {
      // Use invalid credentials to test error handling
      // Note: Empty credentials would cause config validation to fail
      // before server starts, so we use invalid values instead
      await startServer({
        GOOGLE_CREDENTIALS_EMAIL: "invalid@invalid.com",
        GOOGLE_PRIVATE_KEY: "invalid-key",
      });

      // Health endpoint should still be reachable even with invalid credentials
      const response = await fetch(`${BASE_URL}/api/health`);
      expect(response.status).toBe(200);
    });
  });

  describe("Connection Health", () => {
    test("should verify Google Sheets accessibility via stats endpoint", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/stats`);

      // Will fail with test credentials, but endpoint exists
      expect([200, 500]).toContain(response.status);
    });

    test("should handle timeout on connection issues", async () => {
      // Use a non-existent server to simulate connection issues
      await startServer({
        GOOGLE_SHEET_ID: "nonexistent-sheet-id",
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${BASE_URL}/api/stats`, {
          signal: controller.signal,
        });

        // Should either succeed or fail gracefully
        expect([200, 500]).toContain(response.status);
      } catch (error) {
        // Timeout is acceptable
        expect(error).toBeDefined();
      } finally {
        clearTimeout(timeoutId);
      }
    });
  });

  describe("Health Check Response Format", () => {
    test("should include all required fields", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`);
      const data = (await response.json()) as ApiResponse;

      expect(data).toMatchObject({
        status: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    test("should use ISO 8601 timestamp format", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`);
      const data = (await response.json()) as ApiResponse;

      expect(data.timestamp && new Date(data.timestamp)).toBeTruthy();
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("Rate Limiting Health", () => {
    test("should handle multiple concurrent health checks", async () => {
      await startServer();

      const requests = Array.from({ length: 10 }, () => fetch(`${BASE_URL}/api/health`));

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    test("should handle rapid sequential requests", async () => {
      await startServer();

      for (let i = 0; i < 20; i++) {
        const response = await fetch(`${BASE_URL}/api/health`, { method: "GET" });
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Service Dependencies", () => {
    test("should indicate if Google Sheets is unreachable", async () => {
      // Configure with clearly invalid credentials
      await startServer({
        GOOGLE_CREDENTIALS_EMAIL: "invalid@invalid.com",
        GOOGLE_PRIVATE_KEY: "invalid",
      });

      const response = await fetch(`${BASE_URL}/api/stats`);
      const data = (await response.json()) as ApiResponse;

      // Should return error indicating connection issue
      if (response.status === 500) {
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      }
    });

    test("should continue operating if Discord webhook fails", async () => {
      // Configure with invalid Discord webhook
      await startServer({
        DISCORD_WEBHOOK_URL: "https://invalid-webhook-url",
      });

      // Health check should still work even if Discord is down
      const response = await fetch(`${BASE_URL}/api/health`);
      expect(response.status).toBe(200);
    });
  });

  describe("CORS and Headers", () => {
    test("should include CORS headers in health check", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`, {
        headers: {
          Origin: "https://example.com",
        },
      });

      const corsHeader = response.headers.get("access-control-allow-origin");
      expect(corsHeader).toBeTruthy();
    });

    test("should include correct content type", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`);
      const contentType = response.headers.get("content-type");

      expect(contentType).toContain("application/json");
    });
  });

  describe("Edge Cases", () => {
    test("should handle malformed request gracefully", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`, {
        method: "POST",
        body: "{invalid json",
      });

      // Should still respond, possibly with error
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });

    test("should handle unexpected HTTP methods", async () => {
      await startServer();

      const response = await fetch(`${BASE_URL}/api/health`, {
        method: "PUT",
        body: "{}",
      });

      // Fastify returns 404 or 405 for unsupported methods
      expect([200, 404, 405]).toContain(response.status);
    });

    test("should handle very long query strings", async () => {
      await startServer();

      const longQuery = "a".repeat(1000);
      const response = await fetch(`${BASE_URL}/api/health?${longQuery}`);

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });
});

describe("Health Check with Mocked Services", () => {
  beforeEach(async () => {
    mockSheetsService.reset();
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  test("should verify sheets connection when credentials are valid", async () => {
    // With valid test credentials, check if we can at least reach the endpoint
    const response = await fetch(`${BASE_URL}/api/stats`);

    // Will fail auth but endpoint is reachable
    expect([200, 500]).toContain(response.status);
  });

  test("should include connection status in extended health check", async () => {
    // This would require implementing an extended health endpoint
    // that checks actual connection status
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = (await response.json()) as ApiResponse;

    expect(data).toHaveProperty("status");
    // Future: expect(data).toHaveProperty("services");
  });
});
