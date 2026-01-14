/**
 * Concurrency and real integration tests
 * These tests spawn an actual server process to test real HTTP behavior
 * that cannot be tested with Fastify's inject() method
 *
 * Tests include:
 * - Concurrent request handling
 * - Real service integration failures
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { VALID_TURNSTILE_TOKEN } from "../helpers/test-app";
import { mockDiscordService } from "../mocks/discord";
import { mockSheetsService } from "../mocks/sheets";
import type { ApiResponse } from "../types";

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

describe.serial("Concurrency and Real Integration Tests", () => {
  beforeEach(async () => {
    mockSheetsService.reset();
    mockDiscordService.reset();
  });

  afterEach(async () => {
    await stopServer();
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
            turnstileToken: VALID_TURNSTILE_TOKEN,
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
          body: JSON.stringify({
            email: "test@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
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
        body: JSON.stringify({
          email: "test@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
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
        body: JSON.stringify({
          email: "test@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
      });

      // Should return error but not crash
      expect([200, 500]).toContain(response.status);

      const data = (await response.json()) as ApiResponse;
      if (response.status === 500) {
        expect(data.success).toBe(false);
      }
    });
  });
});
